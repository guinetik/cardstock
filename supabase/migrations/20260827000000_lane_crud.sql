-- Atomic operations used by the inline work-lane editor.

create or replace function public.create_work_lane(
  p_board_id uuid,
  p_key text,
  p_name text
) returns public.lanes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_insert_at int;
  v_lane public.lanes;
begin
  -- Lock the accessible board and its lanes so concurrent creates cannot claim
  -- the same position or key.
  perform 1 from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found'; end if;
  perform 1 from public.lanes where board_id = p_board_id for update;

  if exists (
    select 1 from public.lanes
    where board_id = p_board_id and key = p_key
  ) then
    raise exception 'A lane with this key already exists';
  end if;

  select coalesce(
    min(position) filter (where kind in ('done', 'archive')),
    max(position) + 1,
    0
  ) into v_insert_at
  from public.lanes
  where board_id = p_board_id;

  update public.lanes
  set position = position + 1
  where board_id = p_board_id and position >= v_insert_at;

  insert into public.lanes (board_id, key, name, position, kind)
  values (p_board_id, p_key, p_name, v_insert_at, 'work')
  returning * into v_lane;

  return v_lane;
end;
$$;

create or replace function public.move_work_lane(
  p_lane_id uuid,
  p_delta int
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_board_id uuid;
  v_kind text;
  v_ids uuid[];
  v_index int;
  v_target int;
  v_swap uuid;
begin
  if p_delta not in (-1, 1) then
    raise exception 'Lane movement must be -1 or 1';
  end if;

  select board_id, kind into v_board_id, v_kind
  from public.lanes where id = p_lane_id;
  if not found then raise exception 'Lane not found'; end if;
  if v_kind <> 'work' then raise exception 'Only work lanes can be moved'; end if;

  perform 1 from public.lanes where board_id = v_board_id for update;
  select array_agg(id order by position, id) into v_ids
  from public.lanes where board_id = v_board_id;

  v_index := array_position(v_ids, p_lane_id);
  v_target := v_index + p_delta;
  if v_target < 1 or v_target > array_length(v_ids, 1) then return; end if;
  -- Archive is intentionally the hard right edge of the visible workflow.
  if exists (
    select 1 from public.lanes
    where id = v_ids[v_target] and kind = 'archive'
  ) then return; end if;

  v_swap := v_ids[v_target];
  v_ids[v_target] := v_ids[v_index];
  v_ids[v_index] := v_swap;

  update public.lanes l
  set position = ordered.position
  from (
    select id, ordinality::int - 1 as position
    from unnest(v_ids) with ordinality as u(id, ordinality)
  ) ordered
  where l.id = ordered.id;
end;
$$;

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
  if v_source_kind <> 'work' then
    raise exception 'Only work lanes can be removed';
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
