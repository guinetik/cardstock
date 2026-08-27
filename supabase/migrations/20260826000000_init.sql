-- cardstock — initial schema.
-- Spec: docs/specs/2026-08-26-cardstock-design.md
create extension if not exists citext;

-- ---------------------------------------------------------------- members
create table public.members (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  display_name text,
  role text not null default 'admin',
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (project_id, member_id)
);

-- ---------------------------------------------------------------- boards
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug text not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

create table public.lanes (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  key text not null,
  name text not null,
  position int not null,
  kind text not null check (kind in ('inbox','work','waiting','built','done','archive')),
  sla_days int,
  wip_limit int,
  created_at timestamptz not null default now(),
  unique (board_id, key)
);

-- ---------------------------------------------------------------- cards
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  external_id text not null,
  title text not null,
  summary text,
  body_md text not null default '',
  status text not null default 'backlog',
  epic text,
  area text,
  raised_by text,
  raised_on date,
  shipped_on date,
  needs text,
  lane_id uuid references public.lanes(id) on delete set null,
  rank double precision not null default 0,
  priority smallint check (priority between 1 and 3),
  effort text check (effort in ('L','M','H')),
  target_date date,
  target_label text,
  audience text not null default 'all' check (audience in ('all','internal')),
  archived_at timestamptz,
  archived_by text,
  source_path text,
  source_hash text,
  frontmatter_extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, external_id)
);
create index cards_board_lane_rank on public.cards (board_id, lane_id, rank);
create index cards_board_target on public.cards (board_id, target_date);

-- ---------------------------------------------------------------- tags
create table public.tag_groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  key text not null,
  name text not null,
  position int not null default 0,
  color text,
  unique (board_id, key)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.tag_groups(id) on delete cascade,
  key text not null,
  name text not null,
  color text,
  unique (group_id, key)
);

create table public.card_tags (
  card_id uuid not null references public.cards(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (card_id, tag_id)
);

create table public.card_links (
  from_card uuid not null references public.cards(id) on delete cascade,
  to_card uuid not null references public.cards(id) on delete cascade,
  kind text not null check (kind in ('relates','blocked_by')),
  primary key (from_card, to_card, kind)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  storage_path text not null,
  name text not null,
  mime text,
  size bigint,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.card_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.cards(id) on delete cascade,
  actor text,
  kind text not null check (kind in ('moved','edited','archived','restored','imported','created')),
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index card_events_card_at on public.card_events (card_id, at desc);

-- ---------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger members_touch before update on public.members for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger boards_touch before update on public.boards for each row execute function public.touch_updated_at();
create trigger cards_touch before update on public.cards for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- access
-- The signed-in user's email, from the JWT. Null for anon.
create or replace function public.current_email() returns citext
language sql stable as $$
  select nullif(coalesce(auth.jwt() ->> 'email', ''), '')::citext
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.email = public.current_email())
$$;

create or replace function public.is_project_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members pm
    join public.members m on m.id = pm.member_id
    where pm.project_id = p and m.email = public.current_email()
  )
$$;

create or replace function public.board_project(b uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select project_id from public.boards where id = b
$$;

create or replace function public.card_project(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select bd.project_id from public.cards cd join public.boards bd on bd.id = cd.board_id where cd.id = c
$$;

create or replace function public.tag_group_project(g uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select bd.project_id from public.tag_groups tg join public.boards bd on bd.id = tg.board_id where tg.id = g
$$;

alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.boards enable row level security;
alter table public.lanes enable row level security;
alter table public.cards enable row level security;
alter table public.tag_groups enable row level security;
alter table public.tags enable row level security;
alter table public.card_tags enable row level security;
alter table public.card_links enable row level security;
alter table public.attachments enable row level security;
alter table public.card_events enable row level security;

-- Members see the whole allowlist (needed to add teammates); only members may write it.
create policy members_read on public.members for select using (public.is_member());
create policy members_write on public.members for all using (public.is_member()) with check (public.is_member());

create policy projects_rw on public.projects for all
  using (public.is_project_member(id)) with check (public.is_member());
create policy project_members_rw on public.project_members for all
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

create policy boards_rw on public.boards for all
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy lanes_rw on public.lanes for all
  using (public.is_project_member(public.board_project(board_id)))
  with check (public.is_project_member(public.board_project(board_id)));
create policy cards_rw on public.cards for all
  using (public.is_project_member(public.board_project(board_id)))
  with check (public.is_project_member(public.board_project(board_id)));
create policy tag_groups_rw on public.tag_groups for all
  using (public.is_project_member(public.board_project(board_id)))
  with check (public.is_project_member(public.board_project(board_id)));
create policy tags_rw on public.tags for all
  using (public.is_project_member(public.tag_group_project(group_id)))
  with check (public.is_project_member(public.tag_group_project(group_id)));
create policy card_tags_rw on public.card_tags for all
  using (public.is_project_member(public.card_project(card_id)))
  with check (public.is_project_member(public.card_project(card_id)));
create policy card_links_rw on public.card_links for all
  using (public.is_project_member(public.card_project(from_card)))
  with check (public.is_project_member(public.card_project(from_card)));
create policy attachments_rw on public.attachments for all
  using (public.is_project_member(public.card_project(card_id)))
  with check (public.is_project_member(public.card_project(card_id)));
create policy card_events_rw on public.card_events for all
  using (public.is_project_member(public.card_project(card_id)))
  with check (public.is_project_member(public.card_project(card_id)));
