# Calendar view — month of target dates

**Date:** 2026-09-02
**Status:** approved in conversation; implementation follows this document.
**Scope:** A month grid of target dates at board and project level, with an unscheduled tray, drag-to-schedule, and CardAge on each slip. Timeline and cockpit stay as they are.

---

## The problem

Cards already carry a real `target_date`, a rough `target_label`, a `planned_start_date`, and a raised-date age chip (`CardAge`). The board peek is where those fields are edited. The timeline is a **raised-date rail** (forgotten / overdue / planned). The cockpit Gantt is start→target bars **per epic**.

None of those is “what is due on which day this month.” The 2026-08-26 spec’s timeline (“September, October, November, December in front of me”) never shipped as a day grid. Scheduling still means opening a card and typing a date.

---

## What we're building

A **calendar page** that works on a board and on a project. One month at a time, Sunday-start week rows, leading and trailing days from the neighbouring months when the month does not fill the grid. Each dated card is a **mini post-it** on its `target_date` cell. Cards with no `target_date` sit in an **Unscheduled** tray (rough labels and forgotten work included). Drag a slip onto a day to set the target; drag onto the tray to clear it.

Out of scope: replacing the timeline, a week view, multi-month on one screen, wrapping `react-day-picker` / shadcn `Calendar`, creating cards from empty days, writing `planned_start_date` on drop, recurring events, audience/status filters on this page.

---

## Decisions taken

1. **Target date owns the cell.** Placement is `target_date` as a UTC day key, same convention as `timelineToday`. Raised date and age are chrome on the slip (`CardAge`), not a second mark on another day.
2. **No target → tray.** `target_label` alone does not invent a day. Forgotten cards live in the tray until someone drops them.
3. **One month, with neighbours.** Prev/next changes the month. If September starts on a Wednesday, Sun–Tue are August; leftover cells are October. Neighbour cells are quieter. Dropping on them writes that date and does **not** change the visible month.
4. **Square days, two-up, then +N.** Day cells are square. Slips pack like the project occupancy map (`grid-template-columns: repeat(2, minmax(0, 1fr))`). At most two rows (four slips) show in the cell; then `+N more` where `N = total − 4`. Clicking `+N` opens a paper popover for that day with every slip, still draggable. Empty days remain drop targets.
5. **Mini post-it, not occupancy ticks.** Each slip is `#id`, title, `CardAge` (calendar-clock, age ring, raised date). Project page also prints the board name. Card tint from `color`. Reuse `CardAge` and `cardColorModifier`; do not invent a second age language.
6. **Project mixes boards.** All boards’ dated cards share one month. Each slip shows the board name. Chips hide boards. Omit the chip query → all boards.
7. **Archived off, delivered on.** `archived_at` excludes the card. A delivered card that still has a `target_date` stays on that day.
8. **Custom paper grid.** Not the shadcn date-picker `Calendar`. dnd-kit for drag (already on the board). Existing card patch action writes `target_date`.
9. **Timeline stays.** Calendar is due dates. Timeline is the raised-date rail. Cockpit is the epic fleet. Three jobs, three pages.
10. **Sunday start.** Week rows match the mockups (S M T W T F S). UTC days, not the browser’s local calendar date, so a target of `2026-09-15` does not jump day at UTC−3.

---

## Routes

| Path | What |
|---|---|
| `/p/[project]/calendar` | Every board in the project |
| `/p/[project]/b/[board]/calendar` | That board only |

Query:

- `month=YYYY-MM` — visible month. Missing or malformed → current UTC month (`timelineToday().slice(0, 7)`).
- `boards=slug,slug` — project page only. Unknown slugs ignored. Empty / omitted → all boards.

Prev/next are links (or equivalent) that rewrite `month` and keep `boards`.

Links: board header next to Timeline; project letterhead (alongside boards); Timeline and cockpit pages get a Calendar link the same way they already cross-link.

---

## Data

### Board page

`loadBoard` as today. Gates from `resolveBoardGates(board.settings, lanes)`. Watch window from `forgottenAfterDays(project.settings)`.

### Project page

`loadProjectCalendar(projectSlug)` in `src/lib/project-calendar-data.ts`: project, every board (id, slug, name, settings), each board’s lanes (for gates) and non-archived cards with the fields `CardAge` and the slip need (`external_id`, `title`, `color`, `raised_on`, `target_date`, `target_label`, `status`, `shipped_on`, `lane_id`). Each card is tagged with `boardSlug`, `boardName`, and that board’s resolved gates.

Do not join every board through `loadBoard` in a loop if one round-trip set can do it; keep RLS as it is (project membership).

### Grouping (`src/lib/calendar.ts`)

React-free. UTC month matrix + grouping. Callers pass `today` and the visible `month`.

```ts
interface CalendarDay {
  date: string;          // YYYY-MM-DD
  inMonth: boolean;
  isToday: boolean;
}

interface CalendarSlip {
  card: Pick<Card, /* slip + CardAge fields */>;
  boardSlug: string;
  boardName: string;
  gates: readonly BoardGate[];
}

function monthMatrix(month: string): CalendarDay[]
function calendarGroups(
  slips: CalendarSlip[],
  days: CalendarDay[],
): { byDate: Map<string, CalendarSlip[]>; tray: CalendarSlip[] }
```

- `monthMatrix("2026-09")` returns 35 or 42 days (complete weeks), Sunday first. `inMonth` is false for August/October padding. `isToday` compares to `timelineToday()`.
- A slip with a `target_date` goes in `byDate` for that key even if `inMonth` is false (so 31 Aug shows while viewing September). Dates not present in this matrix are not listed; paging to that month reveals them. They do **not** go to the tray.
- A slip with `target_date == null` goes to `tray`, including when `target_label` is set.
- Archived cards are not passed in.

Overflow: `visible = slips.slice(0, 4)`, `overflow = slips.length - 4` (0 if ≤ 4). Sort inside a day by `external_id` numeric, same as the timeline rail’s tie-break.

---

## UI

Paper chrome only: existing stock, hairline, `--radius-card` (2px). No new theme tokens, no blur, no radius above 2px.

```
{project}                                              ← Sep 2026 →
{board or “All boards”}     [board chips on project]

┌ Sun  Mon  Tue  Wed  Thu  Fri  Sat ┐  ┌ Unscheduled ┐
│ [square day cells, 2-up slips]    │  │ mini post-its│
│ …                                 │  │              │
└───────────────────────────────────┘  └──────────────┘
```

- **Day cell:** square (`aspect-ratio: 1`). Date number in the corner, IBM Plex Mono. Neighbour-month number and slips use quieter ink (`--color-grey-faint`). Today: 1px ink outline, not a fill.
- **Slip:** mini `.paper-card` (or a calendar-specific modifier that still uses card stock and tint). `#id`, title (line-clamp), `CardAge`. Project: board name as a quiet mono line. The slip is the drag handle. Title / maximize behave like the board card: open the in-place card dialog (`@modal/(.)c/[externalId]` on the board route; project calendar links to `/p/{project}/b/{board}/c/{id}` — intercept if the project calendar gets a matching modal, otherwise full page is acceptable for v1 on the project route).
- **+N popover:** paper surface, that day’s date as title, every slip for the day, still dnd. The day under the popover remains the drop target for new drops. Esc / click-away closes.
- **Tray:** right column, same slips, no day number. Heading “Unscheduled” and a count. Scrolls if long. Always visible, including when empty (“Nothing undated”).
- **Board chips (project only):** one chip per board, on by default. Toggling rewrites `boards`. A hidden board’s slips leave both the grid and the tray.

---

## Drag and persistence

dnd-kit pointer + keyboard sensors, same distance threshold as the board (a click stays a click).

| Drop | Write |
|---|---|
| Day `YYYY-MM-DD` | `target_date` = that day. `target_label` unchanged. `planned_start_date` unchanged. |
| Tray | `target_date` = `null`. `target_label` unchanged. |

Optimistic: the slip moves immediately. The board calendar uses the existing `onPatch` / `updateCard` path (`CardPatch.target_date`). The project calendar needs a patch that still knows `boardSlug` (same action with project + board, or a thin wrapper). On success, revalidate both calendar routes and the board. On failure, the slip returns to its previous day or the tray and the existing paper error path runs. A drop must never look saved if RLS or auth refused it.

Dropping onto the `+N` popover counts as that popover’s date. Dropping onto a neighbour-month cell writes that date; `month` query stays.

---

## Errors and edge cases

- Garbage `month` → current UTC month. Do not 404.
- Unknown `boards` slugs → ignored.
- Card with a target outside the visible matrix (and not on a padding day) → not shown this month; not in the tray.
- Concurrent drop: last write wins, same as the board.
- Signed-out: existing `proxy.ts` gate; calendar pages redirect like the board.

---

## Tests

**`src/lib/calendar.test.ts`** (bun, no React):

- September 2026 starts Tuesday UTC — first cell is Sunday 30 Aug (`inMonth: false`), 1 Sep is `inMonth: true`.
- 31-day month and February (non-leap and leap if cheap).
- Grouping: dated card on 15 Sep; null `target_date` in tray; `target_label` only in tray; archived omitted by caller contract (test the grouper given live slips).
- Overflow math: 4 slips → overflow 0; 6 slips → overflow 2.
- Today flag uses the injected `today` string.

**Playwright:**

- Board calendar: a card with `target_date` appears in that cell; a card without appears in Unscheduled.
- Drag from tray onto a day; reload; the date input on the card still has that day.
- Project calendar: slips from two boards, each labeled; hiding a board chip removes its slips.
- `+N` opens the day popover with the remaining titles.
- Clicking a slip on the board calendar opens the card dialog.

---

## Files (implementation shape)

| File | Role |
|---|---|
| `src/lib/calendar.ts` | Month matrix, grouping, overflow. |
| `src/lib/calendar.test.ts` | Lib tests. |
| `src/lib/project-calendar-data.ts` | Project loader (`loadProjectCalendar`). |
| `src/components/calendar/calendar-view.tsx` | Client grid + tray + dnd. |
| `src/components/calendar/calendar-slip.tsx` | Mini post-it + `CardAge`. |
| `src/app/p/[project]/calendar/page.tsx` | Project page. |
| `src/app/p/[project]/b/[board]/calendar/page.tsx` | Board page. |
| `src/styles/components/paper.css` | Calendar grid / slip / tray rules in the paper file, not a new skin. |
| `docs/calendar.md` | Operator-facing page, written with the implementation. |
| `e2e/calendar.spec.ts` | Playwright. |

Board `updateCard` revalidation must include the two calendar paths.

---

## Not this

- Do not put occupancy-only ticks (binder `lane-map-cell`) on the calendar; those stay on the project binder.
- Do not show raised-date ghosts on a second cell.
- Do not heat-tint the day cell from overdue; the slip’s `CardAge` / overdue word is the signal (same as the board card).
- Do not reuse `src/components/ui/calendar.tsx` for this page.
