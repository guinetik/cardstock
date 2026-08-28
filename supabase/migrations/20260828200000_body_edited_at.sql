-- The card body is editable on the issue page, and comments are stored in the
-- same body_md blob. The database has to tell a body a person typed from one
-- seeded out of markdown, or the next import would wipe comments.
--
-- Null means "still owned by markdown". Set means a person edited the body or
-- posted a comment here; from then on the app owns it and the exporter writes
-- it back out.

alter table public.cards
  add column if not exists body_edited_at timestamptz;

comment on column public.cards.body_edited_at is
  'When a person last edited the body or posted a comment in the app. Null: markdown still owns body_md.';
