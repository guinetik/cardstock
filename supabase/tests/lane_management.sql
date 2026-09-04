do $$
declare
  definition text;
begin
  select pg_get_constraintdef(oid)
    into definition
    from pg_constraint
   where conrelid = 'public.lanes'::regclass
     and conname = 'lanes_color_check';

  if definition is null
    or definition not like '%rose%'
    or definition not like '%blue%'
    or definition not like '%pink%'
  then
    raise exception 'lanes.color check constraint is missing or incomplete: %', definition;
  end if;

  if to_regprocedure('public.move_all_lane_cards(uuid,uuid)') is null then
    raise exception 'move_all_lane_cards RPC is missing';
  end if;
  if to_regprocedure('public.sort_lane_cards(uuid,text)') is null then
    raise exception 'sort_lane_cards RPC is missing';
  end if;
end
$$;

begin;

do $$
declare
  v_project uuid;
  v_board uuid;
  v_inbox uuid;
  v_left uuid;
  v_right uuid;
  v_done uuid;
  v_archive uuid;
  v_created public.lanes;
  v_ids text[];
begin
  insert into public.projects (slug, name)
  values ('lane-management-contract', 'Lane management contract')
  returning id into v_project;
  insert into public.boards (project_id, slug, name)
  values (v_project, 'board', 'Board')
  returning id into v_board;
  insert into public.lanes (board_id, key, name, position, kind)
  values (v_board, 'inbox', 'Inbox', 0, 'inbox') returning id into v_inbox;
  insert into public.lanes (board_id, key, name, position, kind)
  values (v_board, 'left', 'Left', 1, 'work') returning id into v_left;
  insert into public.lanes (board_id, key, name, position, kind)
  values (v_board, 'right', 'Right', 2, 'work') returning id into v_right;
  insert into public.lanes (board_id, key, name, position, kind)
  values (v_board, 'done', 'Done', 3, 'done') returning id into v_done;
  insert into public.lanes (board_id, key, name, position, kind)
  values (v_board, 'archive', 'Archive', 4, 'archive') returning id into v_archive;

  select * into v_created
  from public.create_work_lane(v_board, 'colored', 'Colored', 'blue');
  if v_created.color <> 'blue' then
    raise exception 'create_work_lane did not persist its color';
  end if;

  insert into public.cards (board_id, lane_id, external_id, title, rank)
  values
    (v_board, v_left, '10', 'Ten', 1),
    (v_board, v_left, '2', 'Two', 2),
    (v_board, v_left, '30', 'Thirty', 3),
    (v_board, v_right, '5', 'Five', 100);

  perform public.move_all_lane_cards(v_left, v_right);
  select array_agg(external_id order by rank) into v_ids
  from public.cards where lane_id = v_right;
  if v_ids <> array['5', '10', '2', '30'] then
    raise exception 'bulk move did not append in source order: %', v_ids;
  end if;

  perform public.sort_lane_cards(v_right, 'asc');
  select array_agg(external_id order by rank) into v_ids
  from public.cards where lane_id = v_right;
  if v_ids <> array['2', '5', '10', '30'] then
    raise exception 'ascending card-number order is wrong: %', v_ids;
  end if;

  perform public.sort_lane_cards(v_right, 'desc');
  select array_agg(external_id order by rank) into v_ids
  from public.cards where lane_id = v_right;
  if v_ids <> array['30', '10', '5', '2'] then
    raise exception 'descending card-number order is wrong: %', v_ids;
  end if;

  begin
    perform public.move_all_lane_cards(v_right, v_inbox);
    raise exception 'non-adjacent bulk move unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'non-adjacent bulk move unexpectedly succeeded' then raise; end if;
  end;

  begin
    perform public.sort_lane_cards(v_inbox, 'asc');
    raise exception 'inbox sort unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'inbox sort unexpectedly succeeded' then raise; end if;
  end;
end
$$;

-- reorder_lanes: dense renumber from a caller-supplied order, no kind guard.
do $$
declare
  v_board uuid;
  v_ids uuid[];
  v_reversed uuid[];
  v_positions int[];
  v_archive uuid;
  v_archive_expected int;
begin
  select b.id into v_board from public.boards b
  where exists (
    select 1 from public.lanes
    where board_id = b.id and kind = 'archive'
  )
  limit 1;

  select array_agg(id order by position) into v_ids
  from public.lanes where board_id = v_board;

  select id into v_archive
  from public.lanes where board_id = v_board and kind = 'archive';

  select array_agg(id order by position desc) into v_reversed
  from public.lanes where board_id = v_board;
  v_archive_expected := array_position(v_reversed, v_archive) - 1;

  -- Reverse the whole board. If any kind guard survives, this raises.
  perform public.reorder_lanes(v_board, v_reversed);

  select array_agg(position order by position) into v_positions
  from public.lanes where board_id = v_board;
  if v_positions <> (select array_agg(g) from generate_series(0, array_length(v_ids, 1) - 1) g)
  then
    raise exception 'reorder_lanes must renumber densely from 0';
  end if;

  if (select id from public.lanes where board_id = v_board and position = 0)
     <> v_ids[array_length(v_ids, 1)]
  then
    raise exception 'reorder_lanes must honour the supplied order';
  end if;

  -- An archive lane must be reorderable like any other: it should land
  -- exactly where the supplied order put it, regardless of where it
  -- started. (Not "at position 0" — that would only hold because archive
  -- happens to seed at the highest position; the point of this change is
  -- that it no longer has to.)
  if (select position from public.lanes where id = v_archive) <> v_archive_expected
  then
    raise exception 'archive must be free to move to its ordered position';
  end if;

  -- Restore.
  perform public.reorder_lanes(v_board, v_ids);
end $$;

-- reorder_lanes rejects a short array.
do $$
declare v_board uuid; v_one uuid;
begin
  select b.id into v_board from public.boards b
  where exists (
    select 1 from public.lanes
    where board_id = b.id and kind = 'archive'
  )
  limit 1;
  select id into v_one from public.lanes where board_id = v_board limit 1;
  begin
    perform public.reorder_lanes(v_board, array[v_one]);
    raise exception 'expected a short lane order to be rejected';
  exception when others then
    if sqlerrm not like 'Lane order must list every lane%' then raise; end if;
  end;
end $$;

-- reorder_lanes rejects a repeated id.
do $$
declare v_board uuid; v_ids uuid[]; v_dup uuid[];
begin
  select b.id into v_board from public.boards b
  where exists (
    select 1 from public.lanes
    where board_id = b.id and kind = 'archive'
  )
  limit 1;
  select array_agg(id order by position) into v_ids
  from public.lanes where board_id = v_board;
  v_dup := v_ids;
  v_dup[1] := v_ids[2];
  begin
    perform public.reorder_lanes(v_board, v_dup);
    raise exception 'expected a repeated lane to be rejected';
  exception when others then
    if sqlerrm not like 'Lane order repeats a lane%' then raise; end if;
  end;
end $$;

-- reorder_lanes rejects a lane that belongs to another board.
do $$
declare v_board uuid; v_ids uuid[]; v_foreign uuid[];
begin
  select b.id into v_board from public.boards b
  where exists (
    select 1 from public.lanes
    where board_id = b.id and kind = 'archive'
  )
  limit 1;
  select array_agg(id order by position) into v_ids
  from public.lanes where board_id = v_board;
  v_foreign := v_ids;
  -- Same length, still all-distinct, but names a lane from no board at all.
  v_foreign[1] := gen_random_uuid();
  begin
    perform public.reorder_lanes(v_board, v_foreign);
    raise exception 'expected a foreign lane id to be rejected';
  exception when others then
    if sqlerrm not like 'Lane order names a lane from another board%' then raise; end if;
  end;
end $$;

-- move_work_lane is gone.
do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'move_work_lane'
  ) then
    raise exception 'move_work_lane should have been dropped';
  end if;
end $$;


-- delete_work_lane: protected kinds are inbox/done/archive; others go.
do $$
declare
  v_board uuid;
  v_dest uuid;
  v_waiting uuid;
  v_protected record;
begin
  select id into v_board from public.boards limit 1;
  select id into v_dest from public.lanes
  where board_id = v_board and kind = 'work' limit 1;

  for v_protected in
    select id, kind from public.lanes
    where board_id = v_board and kind in ('inbox', 'done', 'archive')
  loop
    begin
      perform public.delete_work_lane(v_protected.id, v_dest);
      raise exception 'expected kind % to be protected', v_protected.kind;
    exception when others then
      if sqlerrm not like '%cannot be removed%' then raise; end if;
    end;
  end loop;

  -- A non-work, non-protected lane must now be removable.
  insert into public.lanes (board_id, key, name, position, kind, sla_days)
  values (v_board, 'test-waiting', 'Test waiting', 99, 'waiting', 5)
  returning id into v_waiting;

  perform public.delete_work_lane(v_waiting, v_dest);

  if exists (select 1 from public.lanes where id = v_waiting) then
    raise exception 'a waiting lane must be removable';
  end if;
end $$;

-- create_board seeds four lanes: flavourful names, semantic keys.
do $$
declare
  v_project uuid;
  v_board uuid;
  v_seeded text;
  v_owner_email text;
begin
  select email into v_owner_email from public.members where role = 'owner' limit 1;
  select id into v_project from public.projects limit 1;

  -- create_board is security definer and checks project membership via
  -- current_email(); impersonate the real owner (is_owner() short-circuits
  -- is_project_member/is_project_admin) rather than weaken the function.
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('email', v_owner_email, 'role', 'authenticated')::text,
    true
  );

  v_board := public.create_board(v_project, 'lane-template-test', 'Template test');

  select string_agg(name || '/' || key || '/' || kind, ' ' order by position)
  into v_seeded
  from public.lanes where board_id = v_board;

  set local role postgres;

  if v_seeded <> 'Icebox/unsorted/inbox Doing/now/work Zenbox/done/done Archive/archive/archive'
  then
    raise exception 'unexpected default lanes: %', v_seeded;
  end if;

  delete from public.boards where id = v_board;
end $$;

-- A done lane's name is writable at the table level (RLS lets project
-- members write lanes directly; the rename guard lived only in the
-- server action, and Task 4 removes it there).
do $$
declare v_board uuid; v_done uuid; v_key text;
begin
  select id into v_board from public.boards limit 1;
  select id, key into v_done, v_key
  from public.lanes where board_id = v_board and kind = 'done' limit 1;
  if v_done is null then return; end if;
  update public.lanes set name = 'Zenbox' where id = v_done;
  if (select key from public.lanes where id = v_done) <> v_key then
    raise exception 'renaming a lane must not touch its key';
  end if;
end $$;

rollback;
