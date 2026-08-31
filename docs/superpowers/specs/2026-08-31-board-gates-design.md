# Board gates

**Date:** 2026-08-31
**Status:** approved in conversation; implementation follows this document.
**Scope:** Board-settings gates (named status/lane matchers), the project-page editor, timeline rail/pulse/milestones, and the timeline explorer filters. Cockpit, markdown import/export, and lane kinds as behaviour stay as they are.

---

## The problem

The timeline rail prints a computed date word (**Planned**, **Forgotten**, **Delivered**) in the same slot and weight as a workflow status. A card that is `built`, sitting in Gate 2, with a target of today, therefore reads as both **PLANNED** and **BUILT**. That is not a data bug — the card is built *and* still has a ship date — but it looks like one confused state. Hardcoding **WAITING RELEASE** would fix that screenshot and glue the product to one board's vocabulary.

## What we're building

**Gates:** an ordered list of named matchers on each board. A gate is a milestone in *that* board's process (Awaiting delivery, Done). It matches on tracker statuses and/or lanes. First match wins; a card is in exactly one gate, or none.

**Diagnostics:** Planned, Forgotten, Overdue, Open, Delivered stay a calendar assessment, not a stage. They sit on the quiet date line. The gate is the right-hand word.

Gates replace the unpublished `timeline_built_statuses` / `timeline_shipped_statuses` mapping. The pulse and `built_at` / `delivered_at` read gate outcomes.

Out of scope: a `board_gates` table, cockpit retargeting, a `gate:` frontmatter key, Staffeto names in code, auto-joining new lanes to a saved gate.

---

## Decisions taken

1. **Two axes, not one badge.** Gate = where the work is. Diagnostic = whether the calendar is healthy. They can both be true (Awaiting delivery + Planned).
2. **Board settings, not a table.** `boards.settings.gates` is an ordered array. Stable `id` on each row so later views can reference a gate. No migration.
3. **First match wins.** Array order is priority. No match → ungated. A card never sits in two gates.
4. **Match is OR.** A card matches if its status is in `statuses` or its lane is in `lane_ids`. An empty list on one side is ignored. Both empty matches nothing and is rejected on save.
5. **Optional outcome** `built` | `shipped` | none. Feeds the pulse and milestone stamps. Several gates may share an outcome. No outcome means label-only.
6. **Visual hierarchy.** Right-hand word is the gate name (ink, not diagnostic colour). No matching gate → no right-hand word. Diagnostic is the line under the title (`Planned · Target Aug 31, 2026 · today`). Rail dot and that line keep today's diagnostic colours. Tracker status chip is hidden when a gate matches; ungated cards still show it when it is not `backlog`.
7. **Delivered diagnostic.** `shipped_on` is set **or** the card matches a `shipped`-outcome gate. Stop special-casing raw `done`/`shipped` status and `kind=done` once gates are resolved (defaults still cover those).
8. **One read path.** Always `resolveBoardGates(settings, lanes)` then match. Missing or malformed `gates` synthesizes defaults; a saved `[]` means no gates.
9. **Editor shows the effective list.** A board with no saved gates shows the defaults in force. First save persists them, with stable ids. Until then, nothing in the database changes.
10. **Two explorer filters.** **State** stays the diagnostic (Any, Open, Planned, Forgotten, Overdue, Delivered). **Gate** is new (Any, each gate name, Ungated). Both apply together (AND). Mixing both kinds in one dropdown is how the original confusion started.
11. **Gates module.** `src/lib/gates.ts` owns resolve, match, default synthesis, and save validation. `timeline.ts` calls it for the delivered diagnostic, milestones, and pulse headings. Later breakdowns import the matcher, not the timeline.

---

## Model

Setting key: `gates` on `boards.settings`.

```ts
type GateOutcome = "built" | "shipped";

interface BoardGate {
  id: string;          // uuid, or `default-built` / `default-shipped` for unsaved defaults
  name: string;        // display word, 1–80 chars
  statuses: string[];  // subset of CARD_STATUSES
  lane_ids: string[];  // ids of lanes on this board
  outcome: GateOutcome | null;
}
```

`resolveBoardGates(settings, lanes)`:

- If `settings.gates` is a non-empty or empty **array** and every element is a valid gate → use it, dropping `lane_ids` that are not on this board.
- If the key is missing, not an array, or any element is invalid → synthesize defaults (do not persist).
- Valid gate: non-empty trimmed `id` and `name` (max 80); `statuses` every value in `CARD_STATUSES`; `lane_ids` an array of strings; `outcome` is `null`, omitted (treat as `null`), `"built"`, or `"shipped"`; at least one status or one remaining lane id. Duplicate ids in one list → invalid (whole fallback).

`cardGate(card, gates)`: first gate where `statuses` includes `card.status` or `lane_ids` includes `card.lane_id`. Else `null`.

### Defaults

Only when the key is missing or malformed, in this order:

1. **Shipped** — `id: "default-shipped"`, statuses from `timeline_shipped_statuses` if that override is valid, else `shipped` and `done`; `lane_ids` = every current `kind=done` lane; `outcome: "shipped"`.
2. **Built** — `id: "default-built"`, statuses from `timeline_built_statuses` if valid, else `built` and `handed`; `lane_ids` = every current `kind=built` lane; `outcome: "built"`.

Shipped is first so a done card does not also count as Built. After a successful save of `gates`, ignore `timeline_built_statuses` and `timeline_shipped_statuses`. Do not write those keys from the new editor.

Saved `[]` is "no gates", not "use defaults". New `kind=built` / `kind=done` lanes do not join a **saved** gate until someone ticks them.

### Milestones

`timelineMilestones` takes the resolved gates instead of a status-only outcome map (keep a helper that collects statuses **and** lane ids per outcome).

A built crossing is: move onto a lane in any `built` gate's `lane_ids`, or a status transition **into** a status in any `built` gate's `statuses`. Same for `shipped` → `deliveredAt`. Lane **kind** is not consulted once gates are resolved. Fallback when the card currently matches a built/shipped gate and history has no crossing: `created_at`, as today.

Pulse membership is unchanged in shape: `built_at` / `delivered_at` inside the window. Headings: if exactly one resolved gate has `outcome: "built"`, that gate's name is the Built column title; else `"Built"`. Same for shipped / `"Shipped"`.

---

## Write path

`updateBoardGates(boardId, projectSlug, gates)` server action. Owners and project admins only (`canManageProject`), same as the forgotten-window setting.

Reject the whole save (do not persist) when:

- any name is blank or longer than 80 after trim
- two gates share an `id` or a case-insensitive name
- any status is outside `CARD_STATUSES`
- any `lane_id` is not a lane on this board
- `outcome` is not `built`, `shipped`, or empty
- a gate has zero statuses and zero lanes
- `id` is missing

On success, write `settings.gates` (preserve other board settings), `revalidatePath` the project page and `/p/[project]/b/[board]/timeline`. Do not delete the old status-list keys in this cut; they are simply unused once `gates` is a valid array.

Generate a uuid for a newly added gate in the client (or the action) before save. Keep `default-built` / `default-shipped` if the user is saving the synthesized rows unchanged-as-structure (rename is fine).

---

## Chrome

**Project page.** New **gates** section, one block per board (board name heading when there is more than one board), same access as the forgotten window. Each gate row: name field, status checkboxes (`CARD_STATUSES`), lane checkboxes (this board's lanes, archive included so a Done lane can be ticked), outcome select (None / Built / Shipped), up/down, delete. Add-gate appends an empty draft that cannot save until it has a name and at least one tick. Explain in one sentence that order is first-match and that the timeline uses the name as the milestone.

**Timeline rail.** `TimelineRailItem` gains `gateName: string | null`. Right-hand label is `gateName` or omitted. `destination()` prefixes the diagnostic word onto today's date copy:

- Planned → `Planned · Target {date} · today|in N days`
- Overdue → `Overdue · Target was {date}`
- Forgotten → `Forgotten · No target · …watch window…` (keep the existing beyond/reached phrasing)
- Delivered → `Delivered · Shipped {date}` when `deliveredAt` is set; else `Delivered`
- Open → `Open · No target yet` or `Open · Rough target · {label}`

Needs-attention list stays diagnostic-first (Forgotten / Overdue are the point of that block). Compact rows can show the gate name where they currently show the lane, or keep the lane; do not add a third competing word. Prefer gate name when present, else lane.

**Explorer.** State select unchanged in values. Add a Gate select: `all`, each resolved gate id, `ungated`.

**Pulse.** Column `title` is a string, not `"Built" | "Shipped"`. Accessible heading ids must accept spaces/case (slug from the title).

---

## Tests and docs

Unit (`src/lib/gates.test.ts` for resolve/match/defaults/validation; `src/lib/timeline.test.ts` for signal and milestones against resolved gates):

- First match wins; no match → `null`
- Status-only, lane-only, both-empty → no match
- Missing/malformed `gates` → Shipped then Built defaults; valid `timeline_built_statuses` override seeds Built statuses
- Valid saved `[]` → no gates, no defaults
- Saved gates ignore the old status keys
- `timelineSignal` returns `delivered` for `shipped_on` or a shipped-outcome match; Planned / Forgotten / Overdue unchanged for dated vs undated work
- Milestones follow outcome gates' lanes and statuses, not raw lane kinds, once a saved list exists

Rail/page (unit or component-level as the repo already tests timeline copy):

- Gated row: right-hand word is the gate; diagnostic on the date line; no status chip
- Ungated row: no right-hand word; status chip if not `backlog`

Playwright (`e2e/timeline.spec.ts` or a small `e2e/gates.spec.ts`):

- Project page shows default Built and Shipped
- Rename Built → Awaiting delivery, tick a work lane, save
- A built-status card in that lane on the timeline shows **Awaiting delivery** and a Planned diagnostic (given it has a target), not a Planned right-hand badge plus a Built chip

Docs: a short `docs` page or a section on the project page README pointing at the editor. Mention the two axes in `docs` only if there is already a timeline note; do not invent a new user-guide tree.

---

## Non-goals

- Cockpit maps, Gantt, or epic outlooks reading gates
- Markdown round-trip of a gate key
- Pulse becoming one column per gate
- Gate colours, SLA, or WIP
- Auto-adding lanes by `kind` after the first save
- Changing lane-kind behaviour on the board (pinning, archive, inbox sort)
- Replacing the forgotten-window project setting
