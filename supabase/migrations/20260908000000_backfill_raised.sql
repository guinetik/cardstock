-- Site-created cards never got raised_on/raised_by (the importer sets them
-- from frontmatter, createCard forgot to), so their age and raised date were
-- blank. createCard now writes both; this backfills the cards it missed.
update public.cards
  set raised_on = (created_at at time zone 'utc')::date
  where raised_on is null;

-- Best effort for the raiser: the created event knows who clicked. The email
-- local part matches the human-name style frontmatter uses closely enough.
update public.cards c
  set raised_by = split_part(e.actor, '@', 1)
  from public.card_events e
  where c.raised_by is null
    and e.card_id = c.id
    and e.kind = 'created'
    and e.actor is not null;
