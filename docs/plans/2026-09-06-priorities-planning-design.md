# Priorities planning screen ("The jar") — design

Tracker item: #9 — Priority filter cannot find your P1s because most cards have no priority.

## Problem

The board has had a priority filter since v1, but almost no cards carry a
priority, so filtering by priority returns nothing useful. Hap's ask
(2026-09-01 call, 18:57): "if I just want to know what is my highest priority
shit right now, and where the hell is it." The fix is a surface that shows
which cards have no priority and makes assigning one a drag, not a form.

The presentation follows the jar prototype (`tmp/Priority visualization
concept.zip`, artboard "The Jar v3") and retells the professor-and-the-jar
story Hap told on the 2026-09-03 call (17:49–17:53): stones first, then
pebbles, then sand, then water — start with the big stuff first.

## Semantics

Two orderings coexist and answer different questions:

- **Lane `rank`** — execution order: what gets pulled into work next.
  Unchanged by this feature.
- **`priority` + `priority_rank`** — stakeholder importance: what matters
  most to the people asking. `priority` (P1/P2/P3, P1 highest) is the band;
  `priority_rank` is the fine ordering within and across bands. This is a
  planning screen, not a work queue.

Importance is a fact about the project, so there is **one global
`priority_rank` sequence** per project. The board-level page shows the same
sequence filtered to one board; dragging on either page writes the same
ordering.

## Naming

"The jar", "Stones/Pebbles/Sand", "unweighed", "the desk" are rendered copy
only. Code speaks priority planning: `priority_rank`, `priorities-data.ts`,
`priorities.ts`, `priorities-view.tsx`, `prioritizeCard`. A day-one dev
reading the code should understand it without having visited the page.

## Data

- Migration: `cards.priority_rank`, same numeric type as `cards.rank`,
  nullable, default null.
- **Not added to the export mapping.** Sync/ETL never sees it; `priority`
  keeps round-tripping to tracker frontmatter exactly as today. Nobody runs
  a planning session from markdown; band membership is the durable fact and
  it round-trips already.
- Fractional ranks, reusing `needsNormalize`/`normalized` from
  `src/lib/rank.ts`; a band renormalizes when neighbors get too close, same
  as lanes do.

## Server

- `src/lib/priorities-data.ts` — mirrors `project-calendar-data.ts`:
  `loadProjectPriorities(project)` and a one-board variant. Returns live
  cards with lane name, epic, effort, status; **excludes** cards in
  `shipped`, `done`, `archive` lanes and archived cards, everywhere on the
  page (bands and desk).
- One server action `prioritizeCard(cardId, priority, priorityRank)`:
  - sets both fields in one write;
  - `priority: null` unweighs — clears `priority_rank` too;
  - renormalizes the affected band when ranks crowd;
  - auth via `currentMember`, same as existing actions.

## Routes and nav

- `/p/[project]/priorities` — project level, all boards, board chips to
  filter (the `CalendarView` pattern, `boardSlug: null`).
- `/p/[project]/b/[board]/priorities` — board level, same shared component.
- "Priorities" link added to the hand-rolled nav rows: `board-view.tsx`,
  timeline page, cockpit page, `calendar-view.tsx`, manage page, and the
  project page.

## View

`src/components/priorities/priorities-view.tsx` (client), faithful to
The Jar v3:

- Intro block retelling the professor story briefly, credited to the call;
  water appears as a closing line, not a band.
- Three bands narrowing downward: P1 full width (pen red), P2 ~78%
  (pen blue), P3 ~56% (pen violet) — the filter bar's `PEN` colors. Band
  labels Stones / Pebbles / Sand, hardcoded, with P1/P2/P3 chips.
- Drag between bands changes `priority`; drag within a band changes
  `priority_rank`; drop on a band's open space appends at the band boundary.
- Cards with a `priority` but no `priority_rank` append at their band's end,
  sorted by lane order then lane rank, until first dragged.
- **Unweighed desk** below: tilted post-its for cards with `priority: null`,
  with the copy "Not in the jar, so the priority filter cannot find them."
  Drag in to weigh; drag a card out to the desk to unweigh.
- Counts in the header (per band + unweighed). P1 soft cap of 6, copy only
  ("room for N"), no enforcement.
- Cards link to their card sheet. Board chips at project level.
- No realtime in v1: server action, then refresh.

## Testing

- Pure helpers (band partitioning, insert-position math, fallback ordering)
  in `src/lib/priorities.ts` with a `.test.ts` beside them, following the
  `filters.test.ts` pattern.
- UI exercised in the browser before any completion claim, per house rules.
- Implementation loads the `cardstock-design` skill before building the UI.

## Out of scope (v1)

- Configurable band labels or stone cap (board setting only if Hap asks).
- Realtime presence/updates on the page.
- Any sync/ETL awareness of `priority_rank`.
- A fourth band for "water" — the story has four tiers, the data model has
  three; water is copy.
