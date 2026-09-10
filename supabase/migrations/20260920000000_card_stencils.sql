-- A stencil is a reusable card shape: one recurring kind of work, stamped into
-- a new card. Its checklist lives inside body_md as a "## Checklist" section,
-- so card creation's existing parse path produces the checklist items and
-- Markdown stays the single source of truth.
create table public.card_stencils (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  title      text,
  summary    text,
  body_md    text not null default '',
  area       text,
  effort     text check (effort in ('L','M','H')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, name)
);

-- Tags are rows, not jsonb, so deleting a board tag cannot leave a stencil
-- pointing at a tag that no longer exists.
create table public.card_stencil_tags (
  stencil_id uuid not null references public.card_stencils(id) on delete cascade,
  tag_id     uuid not null references public.tags(id)           on delete cascade,
  primary key (stencil_id, tag_id)
);

-- unique (board_id, name) already provides the board+name index; none is added.
create trigger card_stencils_touch before update on public.card_stencils
  for each row execute function public.touch_updated_at();

create or replace function public.stencil_project(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select bd.project_id from public.card_stencils cs join public.boards bd on bd.id = cs.board_id where cs.id = s
$$;

alter table public.card_stencils enable row level security;
alter table public.card_stencil_tags enable row level security;

create policy card_stencils_rw on public.card_stencils for all
  using (public.is_project_member(public.board_project(board_id)))
  with check (public.is_project_member(public.board_project(board_id)));
create policy card_stencil_tags_rw on public.card_stencil_tags for all
  using (public.is_project_member(public.stencil_project(stencil_id)))
  with check (
    public.is_project_member(public.stencil_project(stencil_id))
    and exists (
      select 1 from public.tags t
      join public.tag_groups g on g.id = t.group_id
      join public.card_stencils s on s.board_id = g.board_id
      where t.id = tag_id and s.id = stencil_id
    )
  );
