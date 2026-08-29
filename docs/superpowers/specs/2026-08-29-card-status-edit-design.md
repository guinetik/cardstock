# Card detail — edit status

**Date:** 2026-08-29
**Status:** approved in conversation; implementation follows this document.
**Scope:** Card detail editor and `updateCard`. Header `.stat` stays a scan mark. Filter bar, board card face, ETL ownership, and lane placement do not change.

---

## The problem

Every card has exactly one tracker `status`. The create dialog sets it; the board and the sheet header show it; export writes it. The detail editor can change summary, priority, effort, audience, dates, color, and tags — but not status. That is the missing control.

## What we're building

A **Status** native `<select>` in the card editor grid, same chrome as Audience. Save on change through `updateCard`. One value, always; the eight tracker words, written as they appear on the card.

Out of scope: coloured custom menu, editing status on the board face, moving the card’s lane from status, a `status_edited_at` stamp, changing CLI import (markdown still owns status on import).

---

## Decisions taken

1. **Native select, not the filter menu.** Grid slot like Audience. Label `Status`. Options are the raw vocabulary: `backlog`, `blocked`, `wip`, `held`, `built`, `handed`, `shipped`, `done`. No blank option.
2. **Full vocabulary, not board-collected.** You can set `done` even if no other card on the board has it. Share one list (`CARD_STATUSES` in `src/lib/card-status.ts`) with create and `updateCard`.
3. **Header stays a `.stat`.** After save, `router.refresh()` updates the word. Do not replace the header with a control. Do not restyle it in this change.
4. **Placement.** First cell of the existing labeled grid (before Priority). Summary stays above the grid; color stays below.
5. **History.** `edited` payload includes `status`. Facts: `set status to wip` when the value is in the vocabulary; otherwise `changed status`. Insert `status` in `EDIT_ORDER` after `effort` and before `target_date`.
6. **Import/export unchanged.** Export already writes `status:`. Import still copies frontmatter over the row. An unsynced UI edit can be overwritten on the next import, same as title.

---

## Write path

`CardPatch` gains `status?: string`. `updateCard` copies it into the row only when present; reject if it is not in `CARD_STATUSES` (`Invalid status.`). Do not stamp `summary_edited_at` or a new status timestamp. The event payload is the same `clean` object as today’s other fields.

`CardLite` / `CardEditor` receive `status`. `defaultValue={card.status}` on the select; `onChange` calls `save({ status: e.target.value })`. Disable while `pending`, same as color.

Create dialog keeps its current labels (“In progress”, …) but reads option *values* from the shared list so the two cannot drift.

---

## Tests and docs

- `src/lib/card-history.test.ts` — `set status to wip` for a known value; `changed status` for junk; order with sibling edited fields.
- `e2e/board.spec.ts` — open a demo card page (or intercepting dialog), change Status to `wip` if it is not already, reload the card URL, expect the select (and header word) to show `wip`. Restore is unnecessary; demo already has mixed statuses — pick a card that is not `wip`, set it, assert, then set it back so the suite stays re-runnable.
- `docs/card-detail.md` — the grid includes Status; one sentence that it is a native select of the tracker vocabulary.

---

## Non-goals

- Filter-bar dropdown on this page.
- Friendly option labels on the detail select.
- Status on cockpit or timeline editors.
- New CSS tokens.
