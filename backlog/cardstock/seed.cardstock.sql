-- cardstock seed for the Cardstock project's own dev board.
-- Lives with the tracker because it is board configuration, not app code.
-- Apply with: py -3 backlog/sync.py --hosted --seed
-- Lane names and tag vocabulary follow backlog/tracker/README-scheme.md.

insert into public.projects (slug, name, description) values
  ('cardstock', 'Cardstock', 'The board app itself — its own backlog, kept off the Staffeto boards')
on conflict (slug) do nothing;

insert into public.boards (project_id, slug, name, settings)
select p.id, 'cardstock-dev', 'Cardstock dev',
  jsonb_build_object(
    -- No status-to-lane mapping, for the same reason the Staffeto boards have none:
    -- a status says what state the work is in, a lane says where a person filed it.
    'lane_aliases', jsonb_build_object('Nice-to-have', 'nice-to-have'),
    'recent_days', 30
  )
from public.projects p where p.slug = 'cardstock'
on conflict (project_id, slug) do nothing;

-- Cardstock is its own product, not a Staffeto client delivery, so it has no
-- four-gate gauntlet: there is no Sanjay's machine and no staging tier between
-- Joao's laptop and Vercel. `building` is the single pre-release lane.
with b as (select b.id from public.boards b join public.projects p on p.id = b.project_id where p.slug = 'cardstock' and b.slug = 'cardstock-dev')
insert into public.lanes (board_id, key, name, position, kind, sla_days)
select b.id, v.key, v.name, v.position, v.kind, v.sla::int from b, (values
  ('unsorted',     'Unsorted',     0, 'inbox',   null),
  ('now',          'Now',          1, 'work',    null),
  ('next',         'Next',         2, 'work',    null),
  ('later',        'Later',        3, 'work',    null),
  ('nice-to-have', 'Nice-to-have', 4, 'work',    null),
  ('parked',       'Parked',       5, 'work',    null),
  ('building',     'Building',     6, 'work',    null),
  ('shipped',      'Shipped',      7, 'work',    null),
  ('done',         'Done',         8, 'done',    null),
  ('archive',      'Archive',      9, 'archive', null)
) as v(key, name, position, kind, sla)
on conflict (board_id, key) do nothing;

with b as (select b.id from public.boards b join public.projects p on p.id = b.project_id where p.slug = 'cardstock' and b.slug = 'cardstock-dev')
insert into public.tag_groups (board_id, key, name, position, color)
select b.id, v.key, v.name, v.position, v.color from b, (values
  ('kind',    'Kind',    0, 'amber'),
  ('surface', 'Surface', 1, 'violet')
) as v(key, name, position, color)
on conflict (board_id, key) do nothing;

with g as (select tg.id, tg.key from public.tag_groups tg join public.boards b on b.id = tg.board_id join public.projects p on p.id = b.project_id where p.slug = 'cardstock' and b.slug = 'cardstock-dev')
insert into public.tags (group_id, key, name)
select g.id, v.key, v.name from g join (values
  ('kind',    'bug',           'Bug'),
  ('kind',    'enhancement',   'Enhancement'),
  ('kind',    'nice-to-have',  'Nice-to-have'),
  ('kind',    'question',      'Question'),
  ('kind',    'internal',      'Internal'),
  ('surface', 'board',         'Board'),
  ('surface', 'card',          'Card'),
  ('surface', 'planning',      'Planning'),
  ('surface', 'timeline',      'Timeline'),
  ('surface', 'calendar',      'Calendar'),
  ('surface', 'project',       'Project page'),
  ('surface', 'import-export', 'Import / export'),
  ('surface', 'sign-in',       'Sign-in'),
  ('surface', 'admin',         'Admin')
) as v(gkey, key, name) on v.gkey = g.key
on conflict (group_id, key) do nothing;
