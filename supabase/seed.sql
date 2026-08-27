-- Seed: a demo project and board so a fresh install has something to look at.
-- Lanes, tag groups and words are configuration; the code only knows lane kinds.
-- Members are NOT here — run `bun run db:seed-members --project demo` (reads MEMBER_EMAILS from .env.local).
-- Real projects keep their seed next to their tracker and apply it the same way:
--   bun run db:apply --file path/to/seed.sql            (see docs/deploy.md)

insert into public.projects (slug, name, description) values
  ('demo', 'Demo', 'A sample project seeded from examples/tracker')
on conflict (slug) do nothing;

insert into public.boards (project_id, slug, name, settings)
select p.id, 'backlog', 'Product backlog',
  jsonb_build_object(
    'status_to_lane', jsonb_build_object(
      'backlog', 'unsorted', 'blocked', 'parked', 'wip', 'now',
      'held', 'built', 'built', 'built', 'handed', 'built',
      'shipped', 'done', 'done', 'done'),
    'needs_lane', 'needs-input',
    'lane_aliases', jsonb_build_object('Needs input', 'needs-input'),
    'recent_days', 30
  )
from public.projects p where p.slug = 'demo'
on conflict (project_id, slug) do nothing;

with b as (select b.id from public.boards b join public.projects p on p.id = b.project_id where p.slug = 'demo' and b.slug = 'backlog')
insert into public.lanes (board_id, key, name, position, kind, sla_days)
select b.id, v.key, v.name, v.position, v.kind, v.sla from b, (values
  ('unsorted',     'Unsorted',     0,  'inbox',   null),
  ('now',          'Now',          1,  'work',    null),
  ('next',         'Next',         2,  'work',    null),
  ('later',        'Later',        3,  'work',    null),
  ('nice-to-have', 'Nice-to-have', 4,  'work',    null),
  ('parked',       'Parked',       5,  'work',    null),
  ('needs-input',  'Needs input',  6,  'waiting', 5),
  -- No gate lanes here: delivery gates are one project's way of working, not
  -- something the demo board should teach.
  ('built',        'Built',        7,  'built',   null),
  ('done',         'Done',         8,  'done',    null),
  ('archive',      'Archive',      9,  'archive', null)
) as v(key, name, position, kind, sla)
on conflict (board_id, key) do nothing;

with b as (select b.id from public.boards b join public.projects p on p.id = b.project_id where p.slug = 'demo' and b.slug = 'backlog')
insert into public.tag_groups (board_id, key, name, position, color)
select b.id, v.key, v.name, v.position, v.color from b, (values
  ('area',      'Area',      0, 'blue'),
  ('step',      'Step',      1, 'violet'),
  ('kind',      'Kind',      2, 'amber'),
  ('objective', 'Objective', 3, 'emerald')
) as v(key, name, position, color)
on conflict (board_id, key) do nothing;

with g as (select tg.id, tg.key from public.tag_groups tg join public.boards b on b.id = tg.board_id join public.projects p on p.id = b.project_id where p.slug = 'demo' and b.slug = 'backlog')
insert into public.tags (group_id, key, name)
select g.id, v.key, v.name from g join (values
  ('area', 'onboarding',    'Onboarding'),
  ('area', 'billing',       'Billing'),
  ('area', 'reports',       'Reports'),
  ('area', 'cross-cutting', 'Cross-cutting'),
  ('step', 'step-1', 'Step 1'),
  ('step', 'step-2', 'Step 2'),
  ('step', 'step-3', 'Step 3'),
  ('step', 'step-4', 'Step 4'),
  ('step', 'step-5', 'Step 5'),
  ('step', 'home',     'Home'),
  ('step', 'settings', 'Settings'),
  ('step', 'login',    'Login'),
  ('step', 'email',    'Email'),
  ('kind', 'bug',          'Bug'),
  ('kind', 'enhancement',  'Enhancement'),
  ('kind', 'nice-to-have', 'Nice-to-have'),
  ('kind', 'new-feature',  'New feature'),
  ('kind', 'question',     'Question'),
  ('kind', 'internal',     'Internal'),
  ('objective', 'self-serve', 'Self-serve'),
  ('objective', 'growth',     'Growth')
) as v(gkey, key, name) on v.gkey = g.key
on conflict (group_id, key) do nothing;

-- The lane inserts are ON CONFLICT DO NOTHING, so a demo board seeded before
-- the gates were removed still carries them. Drop them here, along with any
-- lane an interrupted e2e run left behind, so every environment converges on
-- the list above. Only empty lanes go: a lane holding cards is somebody's
-- work, and losing it silently would be worse than an out-of-date board.
with b as (
  select b.id from public.boards b
  join public.projects p on p.id = b.project_id
  where p.slug = 'demo' and b.slug = 'backlog'
)
delete from public.lanes l
using b
where l.board_id = b.id
  and (l.key like 'gate-%' or l.key like 'crud-lane-%')
  and not exists (select 1 from public.cards c where c.lane_id = l.id);

-- Close the gaps the deletions leave, so positions stay 0..n-1.
with b as (
  select b.id from public.boards b
  join public.projects p on p.id = b.project_id
  where p.slug = 'demo' and b.slug = 'backlog'
), ordered as (
  select l.id, row_number() over (order by l.position) - 1 as pos
  from public.lanes l join b on b.id = l.board_id
)
update public.lanes l set position = o.pos
from ordered o where o.id = l.id and l.position <> o.pos;

