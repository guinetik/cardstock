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

rollback;
