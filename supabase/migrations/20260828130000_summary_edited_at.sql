-- The card summary is editable on the card page, so the database has to be
-- able to tell a summary a person typed from one seeded out of markdown.
--
-- Without that distinction the importer's `if (fm.summary) row.summary = ...`
-- overwrote every app edit on the next import, and because the exporter never
-- wrote summaries back, the edit was simply lost. Every tracker file carries a
-- `summary:` key, so this fired on effectively every card.
--
-- Null means "still owned by markdown". Set means a person edited it here, and
-- from then on the app owns it and the exporter writes it back out.

alter table public.cards
  add column if not exists summary_edited_at timestamptz;

comment on column public.cards.summary_edited_at is
  'When a person last edited summary in the app. Null: markdown still owns it.';
