-- Remember the lane the markdown file claimed at the last sync.
--
-- Lane is board state: a person drags a card and that is the truth. But a file
-- may also move a card — an agent finishing work writes `lane: gate-1`. With
-- one field and two writers, whoever syncs last wins, and a stale `lane:` in a
-- file silently undoes a drag on the next import.
--
-- This column is the merge base. The importer moves a card only when the file's
-- lane differs from what it said last time: the file changed its mind, so the
-- file wins. When it is unchanged the board's lane stands, however it got there.
-- The same rule a three-way merge uses, and the reason both sides are safe.
--
-- Null means "never synced": the next import records the file's lane without
-- moving anything, so a board that predates this column calibrates itself
-- instead of stampeding every card to whatever its file happens to say.
alter table public.cards add column lane_from_source text;

comment on column public.cards.lane_from_source is
  'Lane key the source file declared at the last import or export; the merge base for lane. Null until first sync.';
