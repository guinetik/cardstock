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
