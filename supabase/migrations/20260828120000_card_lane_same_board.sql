-- A card must sit in a lane on its own board.
--
-- `cards_lane_id_fkey` only ever checked that the lane exists, so any write
-- that matched cards by `external_id` without scoping to a board could park a
-- card on another board's lane. The card then vanishes from its own board
-- (which selects lanes by board) and silently inflates the other board's
-- counts. A composite foreign key makes the database refuse it.

-- The target of a composite FK needs a matching unique key. `lanes.id` is
-- already unique, so this index costs nothing semantically.
create unique index if not exists lanes_board_id_id_key
  on public.lanes (board_id, id);

-- Repair anything that already drifted before adopting the constraint: send
-- such cards to their own board's inbox rather than dropping the reference,
-- so nothing disappears silently.
update public.cards c
   set lane_id = (
     select l.id from public.lanes l
     where l.board_id = c.board_id
     order by (l.kind = 'inbox') desc, l.position
     limit 1
   )
 from public.lanes bad
 where bad.id = c.lane_id and bad.board_id <> c.board_id;

-- No referential action here: the existing `cards_lane_id_fkey` already nulls
-- `lane_id` when a lane is deleted, and a composite SET NULL would try to null
-- `board_id` too, which is NOT NULL. MATCH SIMPLE means a null `lane_id`
-- satisfies this constraint, so the two cooperate.
alter table public.cards
  add constraint cards_lane_on_same_board
  foreign key (board_id, lane_id)
  references public.lanes (board_id, id);
