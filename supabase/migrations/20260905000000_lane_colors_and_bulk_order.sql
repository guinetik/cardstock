-- Lane tints and atomic lane-wide card operations.

alter table public.lanes
  add column color text
  constraint lanes_color_check
  check (
    color is null
    or color in (
      'rose', 'orange', 'amber', 'green', 'cyan',
      'blue', 'indigo', 'violet', 'pink'
    )
  );

comment on column public.lanes.color is
  'Optional lane tint using the shared board-card palette; null is neutral.';

-- Preserve the original RPC name while accepting the optional lane tint in
-- the same transaction that creates and positions the lane.
drop function public.create_work_lane(uuid, text, text);

create function public.create_work_lane(
  p_board_id uuid,
  p_key text,
  p_name text,
  p_color text default null
) returns public.lanes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_insert_at int;
  v_lane public.lanes;
begin
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

  insert into public.lanes (board_id, key, name, position, kind, color)
  values (p_board_id, p_key, p_name, v_insert_at, 'work', p_color)
  returning * into v_lane;

  return v_lane;
end;
$$;

/** Move every card to an adjacent live lane, appending in current order. */
create function public.move_all_lane_cards(
  p_source_lane_id uuid,
  p_destination_lane_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_board_id uuid;
  v_source_kind text;
  v_source_position int;
  v_destination_kind text;
  v_destination_position int;
  v_rank double precision;
  v_card record;
  v_moved jsonb := '[]'::jsonb;
begin
  select board_id, kind, position
  into v_board_id, v_source_kind, v_source_position
  from public.lanes where id = p_source_lane_id;
  if not found then raise exception 'Source lane not found'; end if;

  select kind, position into v_destination_kind, v_destination_position
  from public.lanes
  where id = p_destination_lane_id and board_id = v_board_id;
  if not found or p_destination_lane_id = p_source_lane_id then
    raise exception 'Choose another lane on this board';
  end if;
  if v_source_kind = 'archive' or v_destination_kind = 'archive' then
    raise exception 'Archive cannot be used for this action';
  end if;
  if abs(v_source_position - v_destination_position) <> 1 then
    raise exception 'Cards can only move to an adjacent lane';
  end if;

  perform 1 from public.lanes where board_id = v_board_id for update;
  perform 1 from public.cards
  where lane_id in (p_source_lane_id, p_destination_lane_id)
  for update;

  select coalesce(max(rank), 0) into v_rank
  from public.cards where lane_id = p_destination_lane_id;

  for v_card in
    select id from public.cards
    where lane_id = p_source_lane_id
    order by rank, id
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
        'from_lane', p_source_lane_id,
        'to_lane', p_destination_lane_id,
        'rank', v_rank,
        'reason', 'lane_bulk_move'
      )
    );
    v_moved := v_moved || jsonb_build_array(
      jsonb_build_object('id', v_card.id, 'rank', v_rank)
    );
  end loop;

  return jsonb_build_object('moved_cards', v_moved);
end;
$$;

/** Replace a non-inbox lane's manual ranks with card-number order. */
create function public.sort_lane_cards(
  p_lane_id uuid,
  p_direction text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_kind text;
  v_card record;
  v_rank int := 0;
  v_ranked jsonb := '[]'::jsonb;
begin
  if p_direction not in ('asc', 'desc') then
    raise exception 'Direction must be asc or desc';
  end if;

  select kind into v_kind from public.lanes where id = p_lane_id;
  if not found then raise exception 'Lane not found'; end if;
  if v_kind in ('inbox', 'archive') then
    raise exception 'This lane does not use manual card order';
  end if;

  perform 1 from public.cards where lane_id = p_lane_id for update;

  if p_direction = 'asc' then
    for v_card in
      select id from public.cards
      where lane_id = p_lane_id
      order by
        case when external_id ~ '^[0-9]+$' then 0 else 1 end,
        case when external_id ~ '^[0-9]+$' then external_id::numeric end asc,
        external_id asc,
        id
    loop
      v_rank := v_rank + 1;
      update public.cards set rank = v_rank where id = v_card.id;
      v_ranked := v_ranked || jsonb_build_array(
        jsonb_build_object('id', v_card.id, 'rank', v_rank)
      );
    end loop;
  else
    for v_card in
      select id from public.cards
      where lane_id = p_lane_id
      order by
        case when external_id ~ '^[0-9]+$' then 0 else 1 end,
        case when external_id ~ '^[0-9]+$' then external_id::numeric end desc,
        external_id desc,
        id desc
    loop
      v_rank := v_rank + 1;
      update public.cards set rank = v_rank where id = v_card.id;
      v_ranked := v_ranked || jsonb_build_array(
        jsonb_build_object('id', v_card.id, 'rank', v_rank)
      );
    end loop;
  end if;

  return jsonb_build_object('ranked_cards', v_ranked);
end;
$$;
