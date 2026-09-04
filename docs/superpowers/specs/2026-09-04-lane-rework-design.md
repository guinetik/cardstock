# Lane rework — every lane moves, every lane is labelled

**Date:** 2026-09-04
**Status:** approved in conversation; implementation follows this document.
**Tracker:** [#10](../../../backlog/tracker/10.md) (and closes the mechanism behind [#7](../../../backlog/tracker/7.md))
**Scope:** Lanes reorder by dragging, every lane's display name is editable, and only three lane roles resist deletion. Plus a leaner default lane set for a board created from scratch.

---

## The problem

A lane's `kind` was given three jobs it should never have had.

`kind` decides **behaviour**, which is correct: `archiveCard` finds where archived cards go by looking for the `archive` lane, `sort_lane_cards` refuses to reorder an `inbox`, `waiting` carries an SLA. Nothing here is wrong.

But `kind` also decides **who may be moved**, and that is a mistake. `move_work_lane` (`20260827000000_lane_crud.sql:70`) raises *"Only work lanes can be moved"*, so a lane seeded as `inbox`, `waiting`, `built`, `done` or `archive` is nailed to its position for the life of the board. Ten lines later it does something worse: when the lane it would swap with is the `archive`, it `return`s silently (`:88-90`) — no error, no movement, no explanation. `board-view.tsx:742-785` then hides the move menu items for any non-work lane, and drops the entire `manage` object for `archive` (`:743`), so most lanes do not even show the affordance that would have failed.

And `kind` decides **who may be labelled**. `updateLane` refuses with *"Only work lanes can be renamed."* (`actions.ts:341`), and `lane-crud-dialog.tsx:133` makes the input `readOnly`. So a board's Done column is called "Done" permanently, in every project, forever.

On top of all three: reordering is a `delta` of `-1 | 1`. Moving a lane across five positions is five round trips. Meanwhile cards drag freely, on @dnd-kit, in the same viewport — so the board teaches you a metaphor with cards and then breaks it with lanes.

The visible result on `cardstock-dev` is a board whose Done sits mid-row with a Wishlist stranded to its right, and no way to fix it from any screen.

---

## What we're building

Every lane on every board can be dragged into any position and given any display name. Deletion stays guarded for exactly three roles. A board created from scratch gets four lanes instead of five, with names that read like a workflow rather than a schema.

Out of scope: changing a lane's `kind` after creation, changing a lane's `key` ever, lanes declared in import frontmatter (its own card), and per-viewer lane pinning.

---

## Decisions taken

1. **`key` is immutable; only `name` moves.** This is the decision the rest of the design rests on. `key` is what `boards.settings.status_to_lane`, `needs_lane` and `lane_aliases` store, what `delete_work_lane` rewrites those settings against, and what every card's markdown `lane:` states. Renaming a label therefore cascades to nothing — no settings rewrite, no file migration, no import ambiguity. The dialog already tells work-lane users exactly this ("The ID is what you write in a card's frontmatter... the ID stays the same"); that copy simply becomes universal.

2. **`kind` stays immutable, and is not needed for the flavour.** Making `kind` patchable was considered and rejected as unnecessary: "Zenbox" is a *label* on the lane whose key is `done`, not a new kind. Since the only thing the flavourful template wanted was a different word on screen, and decision 1 makes words free, nothing has to learn to re-kind a lane. `LanePatch` keeps carrying `name` and `color` and nothing else.

3. **Ordering stops consulting `kind` entirely.** Not "archive is special but the rest are free" — entirely. A person who drags Archive into the middle of their board has expressed a preference about their own board; the seed comment calling archive "intentionally the hard right edge" was a guess about what people want, enforced as a constraint. `position` is presentation, and presentation is the board owner's.

4. **Deletion is the one thing `kind` still gates**, and it gates three roles: `inbox`, `done`, `archive`. These are resolved by `kind` lookup at runtime — `archiveCard` walks the lane list for `kind === 'archive'` and for the inbox on restore — so deleting one does not produce an error, it produces a feature that silently stops working. `work`, `waiting` and `built` lanes become deletable like any other. This is a real guard protecting a real invariant, unlike the ordering guards it replaces.

5. **One bulk reorder call, not N nudges.** `move_work_lane` is replaced rather than extended. Its own tail (`:91-97`) is already a "renumber every lane from an ordered id array" routine; the new RPC is that routine with the array supplied by the caller instead of computed from a swap. A drag that crosses five positions is one round trip, and the intermediate states a nudge sequence would persist never exist.

6. **Lanes drag on the machinery cards already use.** One `DndContext`, one set of sensors, one `DragOverlay` — the lane sortable is a second `SortableContext` inside the existing context, discriminated in `onDragEnd` by `active.data.current?.type`. Reusing it is both less code and the actual point: the complaint was that lanes felt unlike cards.

7. **The default board gets four lanes, not five.** Icebox → Doing → Zenbox, plus Archive. The previous default seeded a `next` lane, which is a planning distinction a two-lane board does not need and a board owner can add in one click. Lean by default; the machinery for growing it is now good.

---

## The default lane template

`create_board` (`20260904000000_project_admin.sql:101-107`) currently seeds Unsorted / Now / Next / Done / Archive. It becomes:

| Label | `key` | `kind` | `position` |
|---|---|---|---|
| Icebox | `unsorted` | `inbox` | 0 |
| Doing | `now` | `work` | 1 |
| Zenbox | `done` | `done` | 2 |
| Archive | `archive` | `archive` | 3 |

The keys are deliberately unchanged from the current default. A card's frontmatter keeps saying `lane: done`, and `done` remains the clearer word for a file that another tool or another person may read. The flavour lives in `name`, which is the only field a human looks at, and it never leaves the database. Nothing in the import or export path learns the word "zenbox".

This affects boards created after the migration. Existing boards keep their lanes — they can now be renamed and reordered into whatever shape their owner wants, which is the whole point.

---

## Schema

`supabase/migrations/20260910000000_lane_reorder.sql`:

```sql
-- Ordering is presentation, and presentation belongs to the board owner.
-- The kind guards that used to live in move_work_lane are gone; the only
-- surviving invariant is that the caller must name every lane on the board
-- exactly once, which is what makes a dense 0..n renumber safe.
create or replace function public.reorder_lanes(
  p_board_id uuid,
  p_ordered_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  perform 1 from public.lanes where board_id = p_board_id for update;

  select count(*) into v_count from public.lanes where board_id = p_board_id;
  if v_count <> coalesce(array_length(p_ordered_ids, 1), 0) then
    raise exception 'Lane order must list every lane on this board';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) as u(id)
    where not exists (
      select 1 from public.lanes
      where lanes.id = u.id and lanes.board_id = p_board_id
    )
  ) then
    raise exception 'Lane order names a lane from another board';
  end if;

  if (select count(distinct id) from unnest(p_ordered_ids) as u(id)) <> v_count
  then
    raise exception 'Lane order repeats a lane';
  end if;

  update public.lanes l
  set position = ordered.position
  from (
    select id, ordinality::int - 1 as position
    from unnest(p_ordered_ids) with ordinality as u(id, ordinality)
  ) ordered
  where l.id = ordered.id;
end;
$$;

drop function if exists public.move_work_lane(uuid, int);
```

The same migration relaxes `delete_work_lane`'s guard from *"only `work`"* to *"not `inbox`, `done` or `archive`"*, and reseeds `create_board` with the four-lane template above.

`lanes` itself is untouched: no new column, no constraint change. `kind` remains `text` + CHECK.

---

## Server actions

In `src/app/p/[project]/b/[board]/actions.ts`:

- `updateLane` (`:316`) loses the `lane.kind !== "work"` rename guard at `:341`. Everything else — the 1..80 length clean, the color validation, the `laneList` return — is unchanged.
- `moveLane(laneId, delta)` (`:352`) is deleted and replaced by `reorderLanes(boardId, orderedIds)`, which validates every id as a UUID, calls the RPC, and returns the refreshed `laneList`.
- `deleteLane` (`:375`) is unchanged in the action; its guard moved into the RPC.

`LanePatch` and `LaneMutationResult` are unchanged.

---

## Client

**`board-view.tsx`.** The `manage` prop stops being conditional on `lane.kind !== "archive"` (`:743`) — every lane gets a menu. Inside it, `canEditName` becomes unconditionally `true`, `canMoveLaneLeft` / `canMoveLaneRight` are deleted along with the two menu items they gate, and a `canDelete: !PROTECTED_KINDS.has(lane.kind)` takes their place. `canMoveCardsLeft` / `canMoveCardsRight` are left exactly as they are, archive exclusion included: `move_all_lane_cards` raises *"Archive cannot be used for this action"* and that rule is about where cards may be sent, not about how lanes are arranged. Relaxing it here would only produce a menu item that errors.

`shiftLane` (`:483`) becomes `reorderLanes`, taking the array the drag produced and optimistically setting local `lanes` state before the transition, exactly as `moveCard` does for cards.

**The DnD wiring.** The lane list in `<main>` gains a `SortableContext` with `horizontalListSortingStrategy` over `lanes.map(l => l.id)`, nested inside the existing `DndContext` (`:704`). `onDragStart` records whether the active item is a lane; `onDragOver` ignores lane drags (there is no cross-container case); `onDragEnd` branches on type, running `arrayMove` over the lane ids and calling `reorderLanes`. `DragOverlay` renders a collapsed lane header for a lane drag.

Card and lane ids are both UUIDs from the same database, so they cannot collide — but the sortable `data` carries an explicit `{ type: 'lane' }` rather than relying on a lookup, because the discriminator should not depend on which map happens to contain the id.

**`lane-column.tsx`.** The header gains `useSortable({ id: lane.id, data: { type: 'lane' } })`, with the listeners on a grab handle in the header rather than the whole header — the header holds the add-card, collapse and menu buttons, and a 6px activation constraint is not enough to keep a click on them from starting a drag. The `useDroppable` for cards (`:93`) stays exactly as it is. The two "Move lane left/right" menu items (`:185-200`) are deleted.

**`lane-crud-dialog.tsx`.** The `readOnly` on the name input (`:133`) goes, as does the `mode.lane.kind !== "work"` description branch (`:114-115`). The work-lane copy at `:111-113` becomes the copy for every rename. The delete destination list is unchanged — it keeps excluding self and archive, matching `delete_work_lane`'s *"Archive cannot be a removal destination"*.

---

## Testing

**SQL** (`supabase/tests/lane_management.sql`, which today covers neither `move_work_lane` nor `delete_work_lane`): `reorder_lanes` renumbers densely from a shuffled array; it raises on a short array, on a repeated id, and on an id from another board; a `done` lane can be reordered to position 0; `delete_work_lane` raises for each of `inbox`, `done`, `archive` and succeeds for `waiting`.

**Unit** (`lane-crud-dialog.test.tsx`, new): the rename input is editable for a `done` lane, and the dialog shows the key alongside it.

**E2E** (`e2e/lane-actions.spec.ts`, which today does not test lane movement at all): rename the Done lane and assert the new label survives a reload while the card frontmatter still says `done`; drag a lane across two positions and assert the order persists; assert the Archive lane now has a menu; assert Delete is absent on Icebox, Zenbox and Archive.

Per `docs/testing.md`, the drag itself gets exercised in a real browser before this is called done — a passing `dnd-kit` unit test is not evidence that a drag works.

---

## Follow-ups, not in this work

- **Lanes in import frontmatter.** A board file declaring its own lanes, falling back to the default template when it does not. Related to the template decision above but independently shaped; its own tracker item.
- **`kind` as a patchable field.** Now genuinely unnecessary rather than merely unbuilt. If a board ever needs two archive-like lanes or a `waiting` promoted to terminal, this returns — with decision 4's uniqueness question attached.
- **Retiring a lane on an existing board.** `delete_work_lane` already takes a destination and rewrites `boards.settings`, so the mechanism exists; what is missing is the tag vocabulary that would absorb a category lane's meaning. Tracked in #10's residuals.
- **#7's per-viewer question.** #7 asked that the lane needing you not be the hardest to reach. This makes the global answer possible in one drag, which is what was offered on the call. Whether a per-viewer pin is still wanted afterwards is worth asking Hap once he can reorder at all.
