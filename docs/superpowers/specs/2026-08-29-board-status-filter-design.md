# Board filter — status, from the cards

**Date:** 2026-08-29
**Status:** approved in conversation; implementation follows this document.
**Scope:** Board filter bar and `matches()`. No ETL, no card editor, no status writes, no CSV query-string change.

---

## The problem

Every card already carries a tracker `status` (`wip`, `blocked`, `backlog`, …). The board shows it on the card face and hides it at rest when the value is `backlog`. The filter bar can slice by tag, priority, and effort, but not by that word. Also show is the wrong home: it reveals hidden extras (internal, archived), it does not restrict a field every card already has.

## What we're building

A **Status** menu on the filter bar. Nothing selected (`any`) means every status; picking one word keeps only that value. The options are the distinct `card.status` values on this board, not a hardcoded vocabulary. Each option is a coloured `.stat`, the same pens as the card face.

Out of scope: editing status from the board, persisting the selection in prefs, adding status to the CSV export URL, renaming `wip` to “In progress”.

---

## Decisions taken

1. **One status at a time.** `null` = no status restriction. A string = keep the card if `card.status === f.status`. Picking another value replaces the first.
2. **Dropdown, not a chip row.** Legend `Status`. Sits between Effort and Also show. Summary shows `any` (muted) or the chosen word with its pen. The menu lists `any`, then each board status as a coloured `.stat`. Also show stays Internal and Archived only.
3. **Collect from the loaded board.** Unique non-empty `card.status` strings across all cards passed into the board view, including archived and internal, so a filed-away `done` card still offers `done`. Sort with the default string order so the row is stable across reloads.
4. **Show the raw value.** `wip` stays `wip`, as on the card. No display-name map — that would be a hardcoded vocabulary.
5. **Omit the fieldset when there is nothing to collect.** Zero cards, or every status blank, means no Status cluster. Same idea as Tags when the board has no groups.
6. **Not a preference.** Clear filters empties the set. A reload starts empty. Internal remains the only standing “also show” pref.
7. **CSV URL unchanged.** Priority and effort are already applied only in the live filter, not in the export query. Status follows them.

---

## Model

`Filters` gains `status: string | null`.

| Helper | Job |
|---|---|
| `emptyFilters` | `status: null` |
| `isFiltering` | true when `status != null` (in addition to today’s query / tags / priority / effort / archived) |
| `matches` | after effort, before tags: if `status` is set and `card.status` is not that value, return false |
| `boardStatuses(cards)` | unique trimmed non-empty statuses, sorted |

`boardStatuses` lives next to `matches` in `src/lib/filters.ts`. It reads only `status`. Blank, null, and whitespace-only values are dropped.

Clear filters in `FilterBar` sets `status` to `null`, same as emptying tags / priority / effort.

---

## Chrome

`FilterBar` takes `statuses: string[]` from the board view (`boardStatuses(cards)`). The Status cluster is a `<details>` menu (same click-away as Tags). Summary accessible name is `any` or the selected status. Each option is a `<button type="button" aria-pressed>` whose label is `any` or the raw status (`wip`).

Items always use `statusChipClass` so the list is coloured even before a pick. `any` is `stat--muted`. No new tokens, radii, or pills.

---

## Data flow

Board view already holds `cards` and `filters`. It computes `statuses` from the current `cards` array (including optimistic archive/create) and passes both into `FilterBar`. `matches` is the only gate; lanes still render empty when every card in them fails the filter.

A status that leaves the board disappears from the menu on the next render. If it was selected, `matches` then shows nothing until Clear or `any`. Do not auto-prune.

---

## Tests and docs

- `src/lib/filters.test.ts` — `boardStatuses`: unique, sorted, blanks dropped. `matches`: null keeps every status; `"wip"` keeps only wip; a second pick replaces the first; other filters still apply. `isFiltering` / `emptyFilters` include the new field.
- `e2e/board.spec.ts` — sibling of the existing P1 test: open the Status menu, press `wip`, visible article count drops, Clear restores.
- `docs/board-cards.md` — one sentence that the filter bar can restrict by the same status word the card shows.
- `docs/paper.md` — no contract change unless the shared helper needs a mention; do not add tokens.

---

## Non-goals

- Hardcoded `STATUSES` from `etl/schema.ts` as the filter list.
- Checkboxes inside Also show.
- Friendly labels (“In progress”).
- Writing `cards.status` from the UI.
- Status on cockpit, timeline, or the project page.
- New CSS tokens or a filled chip.
