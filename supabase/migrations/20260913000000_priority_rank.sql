-- Stakeholder-importance ordering for the priorities planning screen
-- ("the jar"). Spec: docs/plans/2026-09-06-priorities-planning-design.md
--
-- Deliberately NOT in the sync export mapping: `priority` (the band) is the
-- durable fact and round-trips to tracker frontmatter; this column is the
-- fine ordering within bands, site-only state. Fractional double, same
-- scheme as `rank` (see src/lib/rank.ts); null means "never dragged" and
-- sorts after ranked cards, by lane position then lane rank.
alter table public.cards
  add column priority_rank double precision;
