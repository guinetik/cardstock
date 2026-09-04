-- Lane rework (tracker #10).
--
-- Ordering is presentation, and presentation belongs to the board owner.
-- The kind guards that used to live in move_work_lane are gone, archive
-- included: the seed called archive "the hard right edge of the visible
-- workflow", but that was a guess about what people want, enforced as a
-- constraint. The only surviving invariant is that the caller must name
-- every lane on the board exactly once, which is what makes a dense
-- 0..n renumber safe.
create or replace function public.reorder_lanes(
  p_board_id uuid,
  p_ordered_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  perform 1 from public.lanes where board_id = p_board_id for update;

  select count(*) into v_count from public.lanes where board_id = p_board_id;
  if v_count = 0 then raise exception 'Board has no lanes'; end if;

  if v_count <> coalesce(array_length(p_ordered_ids, 1), 0) then
    raise exception 'Lane order must list every lane on this board';
  end if;

  if (select count(distinct id) from unnest(p_ordered_ids) as u(id)) <> v_count
  then
    raise exception 'Lane order repeats a lane';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) as u(id)
    where not exists (
      select 1 from public.lanes
      where lanes.id = u.id and lanes.board_id = p_board_id
    )
  ) then
    raise exception 'Lane order names a lane from another board';
  end if;

  update public.lanes l
  set position = ordered.position
  from (
    select id, ordinality::int - 1 as position
    from unnest(p_ordered_ids) with ordinality as u(id, ordinality)
  ) ordered
  where l.id = ordered.id;
end;
$$;

drop function if exists public.move_work_lane(uuid, int);

create or replace function public.delete_work_lane(
  p_lane_id uuid,
  p_destination_lane_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_board_id uuid;
  v_source_key text;
  v_source_kind text;
  v_destination_key text;
  v_destination_kind text;
  v_rank double precision;
  v_card record;
  v_moved jsonb := '[]'::jsonb;
  v_settings jsonb;
  v_entry record;
begin
  select board_id, key, kind
  into v_board_id, v_source_key, v_source_kind
  from public.lanes where id = p_lane_id;
  if not found then raise exception 'Lane not found'; end if;
  -- Was: if v_source_kind <> 'work' then
  --        raise exception 'Only work lanes can be removed';
  --      end if;
  --
  -- Deletion is the one thing kind still gates, and it gates the three
  -- roles resolved by kind lookup at runtime. archiveCard walks the lane
  -- list for kind = 'archive' and for the inbox on restore, so removing
  -- one does not produce an error — it produces a feature that silently
  -- stops working.
  if v_source_kind in ('inbox', 'done', 'archive') then
    raise exception 'inbox, done and archive lanes cannot be removed';
  end if;

  perform 1 from public.lanes where board_id = v_board_id for update;
  select key, kind into v_destination_key, v_destination_kind
  from public.lanes
  where id = p_destination_lane_id and board_id = v_board_id;
  if not found or p_destination_lane_id = p_lane_id then
    raise exception 'Choose another lane on this board';
  end if;
  if v_destination_kind = 'archive' then
    raise exception 'Archive cannot be a removal destination';
  end if;

  select coalesce(max(rank), 0) into v_rank
  from public.cards where lane_id = p_destination_lane_id;

  for v_card in
    select id from public.cards
    where lane_id = p_lane_id
    order by rank, id
    for update
  loop
    v_rank := v_rank + 1;
    update public.cards
    set lane_id = p_destination_lane_id, rank = v_rank
    where id = v_card.id;
    insert into public.card_events (card_id, actor, kind, payload)
    values (
      v_card.id,
      public.current_email()::text,
      'moved',
      jsonb_build_object(
        'from_lane', p_lane_id,
        'to_lane', p_destination_lane_id,
        'rank', v_rank,
        'reason', 'lane_removed'
      )
    );
    v_moved := v_moved || jsonb_build_array(
      jsonb_build_object('id', v_card.id, 'rank', v_rank)
    );
  end loop;

  select settings into v_settings
  from public.boards where id = v_board_id for update;

  if jsonb_typeof(v_settings -> 'status_to_lane') = 'object' then
    for v_entry in select key, value from jsonb_each_text(v_settings -> 'status_to_lane')
    loop
      if v_entry.value = v_source_key then
        v_settings := jsonb_set(
          v_settings,
          array['status_to_lane', v_entry.key],
          to_jsonb(v_destination_key),
          true
        );
      end if;
    end loop;
  end if;
  if v_settings ->> 'needs_lane' = v_source_key then
    v_settings := jsonb_set(v_settings, '{needs_lane}', to_jsonb(v_destination_key), true);
  end if;
  if jsonb_typeof(v_settings -> 'lane_aliases') = 'object' then
    for v_entry in select key, value from jsonb_each_text(v_settings -> 'lane_aliases')
    loop
      if v_entry.value = v_source_key then
        v_settings := jsonb_set(
          v_settings,
          array['lane_aliases', v_entry.key],
          to_jsonb(v_destination_key),
          true
        );
      end if;
    end loop;
  end if;
  update public.boards set settings = v_settings where id = v_board_id;

  delete from public.lanes where id = p_lane_id;
  with ordered as (
    select id, row_number() over (order by position, id)::int - 1 as position
    from public.lanes where board_id = v_board_id
  )
  update public.lanes l set position = ordered.position
  from ordered where l.id = ordered.id;

  return jsonb_build_object('moved_cards', v_moved);
end;
$$;

create or replace function public.create_board(
  p_project_id uuid,
  p_slug text,
  p_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_id uuid;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'Project not found' using errcode = '42501';
  end if;
  if not public.is_project_admin(p_project_id) then
    raise exception 'Only an owner or project admin can create a board'
      using errcode = '42501';
  end if;

  insert into public.boards (project_id, slug, name)
  values (p_project_id, p_slug, p_name)
  returning id into v_board_id;

  -- Four lanes, not five. The keys are deliberately unchanged from the
  -- previous default: a card's frontmatter keeps saying `lane: done`,
  -- because `done` is the clearer word for a file another tool or another
  -- person may read. The flavour lives in `name` and never leaves the
  -- database — nothing in the import or export path learns "zenbox".
  insert into public.lanes (board_id, key, name, position, kind)
  values
    (v_board_id, 'unsorted', 'Icebox', 0, 'inbox'),
    (v_board_id, 'now', 'Doing', 1, 'work'),
    (v_board_id, 'done', 'Zenbox', 2, 'done'),
    (v_board_id, 'archive', 'Archive', 3, 'archive');

  return v_board_id;
end;
$$;
