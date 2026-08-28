-- Epic cockpit: normalize source-owned epic names, add planning dates, and
-- begin honest daily work-left history from this migration forward.

create table public.epics (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  source_name text not null,
  outcome text,
  owner_label text,
  start_date date,
  target_date date,
  priority smallint check (priority between 1 and 3),
  confidence text not null default 'unknown'
    check (confidence in ('confident', 'concerned', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, source_name)
);

create trigger epics_touch before update on public.epics
for each row execute function public.touch_updated_at();

alter table public.cards
  add column epic_id uuid references public.epics(id) on delete set null,
  add column planned_start_date date;

create index cards_board_epic on public.cards (board_id, epic_id);
create index cards_board_planned_start on public.cards (board_id, planned_start_date);

insert into public.epics (board_id, source_name)
select distinct board_id, btrim(epic)
from public.cards
where nullif(btrim(epic), '') is not null
on conflict (board_id, source_name) do nothing;

update public.cards c
set epic_id = e.id
from public.epics e
where e.board_id = c.board_id and e.source_name = btrim(c.epic);

create table public.epic_snapshots (
  epic_id uuid not null references public.epics(id) on delete cascade,
  captured_on date not null default (now() at time zone 'utc')::date,
  task_count int not null,
  delivered_count int not null,
  total_effort int not null,
  delivered_effort int not null,
  remaining_effort int not null,
  estimated_count int not null,
  primary key (epic_id, captured_on)
);

create or replace function public.refresh_epic_snapshot(p_epic_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_epic_id is null or not exists (select 1 from public.epics where id = p_epic_id) then
    return;
  end if;

  insert into public.epic_snapshots (
    epic_id, captured_on, task_count, delivered_count, total_effort,
    delivered_effort, remaining_effort, estimated_count
  )
  select
    p_epic_id,
    (now() at time zone 'utc')::date,
    count(*)::int,
    count(*) filter (where l.kind = 'done' or c.status in ('shipped', 'done'))::int,
    coalesce(sum(case c.effort when 'L' then 1 when 'M' then 3 when 'H' then 5 else 0 end), 0)::int,
    coalesce(sum(case when l.kind = 'done' or c.status in ('shipped', 'done')
      then case c.effort when 'L' then 1 when 'M' then 3 when 'H' then 5 else 0 end
      else 0 end), 0)::int,
    coalesce(sum(case when not (l.kind = 'done' or c.status in ('shipped', 'done'))
      then case c.effort when 'L' then 1 when 'M' then 3 when 'H' then 5 else 0 end
      else 0 end), 0)::int,
    count(c.effort)::int
  from public.cards c
  left join public.lanes l on l.id = c.lane_id
  where c.epic_id = p_epic_id and c.archived_at is null
  on conflict (epic_id, captured_on) do update set
    task_count = excluded.task_count,
    delivered_count = excluded.delivered_count,
    total_effort = excluded.total_effort,
    delivered_effort = excluded.delivered_effort,
    remaining_effort = excluded.remaining_effort,
    estimated_count = excluded.estimated_count;
end $$;

revoke execute on function public.refresh_epic_snapshot(uuid)
from public, anon, authenticated;

create or replace function public.snapshot_changed_epic()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'INSERT' then perform public.refresh_epic_snapshot(old.epic_id); end if;
  if tg_op <> 'DELETE' and (tg_op = 'INSERT' or new.epic_id is distinct from old.epic_id) then
    perform public.refresh_epic_snapshot(new.epic_id);
  elsif tg_op = 'UPDATE' then
    perform public.refresh_epic_snapshot(new.epic_id);
  end if;
  return coalesce(new, old);
end $$;

create trigger cards_snapshot_epic
after insert or delete or update of epic_id, effort, lane_id, status, archived_at
on public.cards for each row execute function public.snapshot_changed_epic();

select public.refresh_epic_snapshot(id) from public.epics;

create or replace function public.epic_project(e uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select b.project_id from public.epics ep join public.boards b on b.id = ep.board_id where ep.id = e
$$;

alter table public.epics enable row level security;
alter table public.epic_snapshots enable row level security;

create policy epics_rw on public.epics for all
  using (public.is_project_member(public.board_project(board_id)))
  with check (public.is_project_member(public.board_project(board_id)));
create policy epic_snapshots_read on public.epic_snapshots for select
  using (public.is_project_member(public.epic_project(epic_id)));
