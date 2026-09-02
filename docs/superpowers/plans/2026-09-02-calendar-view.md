# Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Sunday-start month grid of `target_date` post-its at board and project level, with an unscheduled tray and drag-to-schedule, without replacing Timeline or Cockpit.

**Architecture:** React-free `src/lib/calendar.ts` owns the UTC month matrix, query parsing, and grouping. `loadProjectCalendar` assembles per-board gates onto slips. One client `CalendarView` renders square day cells, mini post-its (`CardAge` + tint), a tray, and dnd-kit drops onto `updateCard({ target_date })`. Two thin App Router pages pass data in.

**Tech Stack:** Next.js App Router · existing `updateCard` server action · `@dnd-kit/core` (not sortable) · bun test · Playwright · paper CSS (no new tokens).

**Spec:** `docs/superpowers/specs/2026-09-02-calendar-view-design.md`

## Global Constraints

- Placement is `target_date` as a UTC day key (`timelineToday` convention). Raised date is `CardAge` on the slip, not a second cell.
- No `target_date` → Unscheduled tray, including `target_label`-only and forgotten cards. Archived cards never enter the view.
- One month, Sunday start, leading/trailing neighbour days. Dropping on a neighbour writes that date and does not change `?month=`.
- Square day cells, two slips per row, cap 4 then `+N more`. `+N` opens a paper popover of every slip for that day (do not also render those slips in the cell — duplicate dnd ids).
- Mini post-it: `#id`, title, `CardAge`. Project page also prints the board name. Tint via `cardColorModifier`. Do not use occupancy ticks or `src/components/ui/calendar.tsx`.
- Project mixes boards; chips rewrite `?boards=slug,slug`; omit/empty/all-unknown → all boards.
- Drop on a day sets `target_date` only. Drop on the tray clears `target_date` only. Leave `target_label` and `planned_start_date` alone.
- Timeline and cockpit stay. No new theme tokens, no radius above `--radius-card` (2px), no blur.
- JSDoc on every exported function and component. Commit messages: `feat:` / `test:` / `docs:`, short.
- Only touch files listed in this plan. Leave unrelated dirty files alone.
- `utcDay` in `timeline.ts` is private — do not import it. Use `timelineToday` and `YYYY-MM-DD` + `T00:00:00Z` in the calendar module.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/calendar.ts` | Month matrix, month/boards query parse, prev/next month, grouping, overflow cap |
| `src/lib/calendar.test.ts` | bun tests for that module |
| `src/lib/project-calendar-data.ts` | `assembleCalendarSlips`, `loadProjectCalendar` |
| `src/lib/project-calendar-data.test.ts` | bun tests for assemble |
| `src/components/calendar/calendar-slip.tsx` | Mini post-it + CardAge + drag handle |
| `src/components/calendar/calendar-view.tsx` | Grid, tray, popover, dnd, optimistic patch |
| `src/app/p/[project]/b/[board]/calendar/page.tsx` | Board calendar |
| `src/app/p/[project]/calendar/page.tsx` | Project calendar |
| `src/app/p/[project]/b/[board]/actions.ts` | Revalidate calendar paths from `updateCard` |
| `src/components/board/board-view.tsx` | Calendar nav link |
| `src/app/p/[project]/b/[board]/timeline/page.tsx` | Calendar nav link |
| `src/app/p/[project]/b/[board]/cockpit/page.tsx` | Calendar nav link |
| `src/app/p/[project]/page.tsx` | Calendar link on the letterhead |
| `src/styles/components/paper.css` | Calendar grid / cell / tray / slip / popover |
| `docs/calendar.md` | Operator-facing page |
| `e2e/calendar.spec.ts` | Playwright |

---

### Task 1: Calendar lib

**Files:**
- Create: `src/lib/calendar.ts`
- Create: `src/lib/calendar.test.ts`

**Interfaces:**
- Consumes: `Card` from `src/lib/types.ts`; `BoardGate` from `src/lib/gates.ts`
- Produces:

```ts
export const CALENDAR_DAY_CAP = 4;
export const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface CalendarDay {
  date: string;
  inMonth: boolean;
  isToday: boolean;
}

export type CalendarCard = Pick<
  Card,
  | "id"
  | "external_id"
  | "title"
  | "color"
  | "raised_on"
  | "target_date"
  | "target_label"
  | "status"
  | "shipped_on"
  | "lane_id"
>;

export interface CalendarSlip {
  card: CalendarCard;
  boardSlug: string;
  boardName: string;
  gates: readonly BoardGate[];
}

export function calendarMonth(value: unknown, today: string): string;
export function addCalendarMonths(month: string, delta: number): string;
export function calendarBoards(
  value: unknown,
  known: readonly string[],
): string[] | null;
export function monthMatrix(month: string, today: string): CalendarDay[];
export function calendarGroups(
  slips: CalendarSlip[],
  days: CalendarDay[],
): { byDate: Map<string, CalendarSlip[]>; tray: CalendarSlip[] };
export function calendarDayOverflow<T>(
  slips: readonly T[],
): { visible: T[]; overflow: number };
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/calendar.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import type { CalendarSlip } from "./calendar";
import {
  addCalendarMonths,
  calendarBoards,
  calendarDayOverflow,
  calendarGroups,
  calendarMonth,
  monthMatrix,
} from "./calendar";

const slip = (
  patch: Partial<CalendarSlip["card"]> & { id?: string } = {},
): CalendarSlip => ({
  boardSlug: "backlog",
  boardName: "Product backlog",
  gates: [],
  card: {
    id: patch.id ?? "c1",
    external_id: "1",
    title: "One",
    color: null,
    raised_on: "2026-08-01",
    target_date: null,
    target_label: null,
    status: "backlog",
    shipped_on: null,
    lane_id: "lane-1",
    ...patch,
  },
});

describe("calendarMonth", () => {
  test("keeps a valid YYYY-MM and falls back for garbage", () => {
    expect(calendarMonth("2026-09", "2026-09-02")).toBe("2026-09");
    expect(calendarMonth("2026-13", "2026-09-02")).toBe("2026-09");
    expect(calendarMonth("banana", "2026-09-02")).toBe("2026-09");
    expect(calendarMonth(undefined, "2026-09-02")).toBe("2026-09");
    expect(calendarMonth(["2026-10", "2026-11"], "2026-09-02")).toBe("2026-10");
  });
});

describe("addCalendarMonths", () => {
  test("steps across year boundaries", () => {
    expect(addCalendarMonths("2026-09", 1)).toBe("2026-10");
    expect(addCalendarMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("calendarBoards", () => {
  const known = ["backlog", "ops"];
  test("omits unknown slugs and treats empty as all", () => {
    expect(calendarBoards(undefined, known)).toBeNull();
    expect(calendarBoards("", known)).toBeNull();
    expect(calendarBoards("nope", known)).toBeNull();
    expect(calendarBoards("backlog,nope", known)).toEqual(["backlog"]);
    expect(calendarBoards("ops,backlog", known)).toEqual(["ops", "backlog"]);
  });
});

describe("monthMatrix", () => {
  test("September 2026 starts Tuesday — first cell is Sunday 30 Aug", () => {
    const days = monthMatrix("2026-09", "2026-09-02");
    expect(days[0]).toEqual({
      date: "2026-08-30",
      inMonth: false,
      isToday: false,
    });
    expect(days.find((d) => d.date === "2026-09-01")).toEqual({
      date: "2026-09-01",
      inMonth: true,
      isToday: false,
    });
    expect(days.find((d) => d.date === "2026-09-02")?.isToday).toBe(true);
    expect(days.at(-1)?.date).toBe("2026-10-03");
    expect(days).toHaveLength(35);
  });

  test("February 2026 is four exact weeks", () => {
    const days = monthMatrix("2026-02", "2026-02-01");
    expect(days[0]?.date).toBe("2026-02-01");
    expect(days.at(-1)?.date).toBe("2026-02-28");
    expect(days).toHaveLength(28);
  });

  test("February 2028 leap month pads to complete weeks", () => {
    const days = monthMatrix("2028-02", "2028-02-01");
    expect(days.some((d) => d.date === "2028-02-29" && d.inMonth)).toBe(true);
    expect(days.length % 7).toBe(0);
  });
});

describe("calendarGroups", () => {
  test("puts dated cards on their day, labels in the tray, ignores off-matrix dates", () => {
    const days = monthMatrix("2026-09", "2026-09-02");
    const { byDate, tray } = calendarGroups(
      [
        slip({ id: "on", external_id: "10", target_date: "2026-09-15" }),
        slip({ id: "pad", external_id: "2", target_date: "2026-08-31" }),
        slip({ id: "away", external_id: "3", target_date: "2026-11-01" }),
        slip({ id: "none", external_id: "4", target_date: null }),
        slip({
          id: "rough",
          external_id: "5",
          target_date: null,
          target_label: "end of Q3",
        }),
      ],
      days,
    );
    expect(byDate.get("2026-09-15")?.map((s) => s.card.id)).toEqual(["on"]);
    expect(byDate.get("2026-08-31")?.map((s) => s.card.id)).toEqual(["pad"]);
    expect(byDate.has("2026-11-01")).toBe(false);
    expect(tray.map((s) => s.card.id).sort()).toEqual(["none", "rough"]);
  });

  test("sorts a day by numeric external_id", () => {
    const days = monthMatrix("2026-09", "2026-09-02");
    const { byDate } = calendarGroups(
      [
        slip({ id: "b", external_id: "10", target_date: "2026-09-15" }),
        slip({ id: "a", external_id: "2", target_date: "2026-09-15" }),
      ],
      days,
    );
    expect(byDate.get("2026-09-15")?.map((s) => s.card.external_id)).toEqual([
      "2",
      "10",
    ]);
  });
});

describe("calendarDayOverflow", () => {
  test("caps at four visible slips", () => {
    expect(calendarDayOverflow([1, 2, 3, 4])).toEqual({
      visible: [1, 2, 3, 4],
      overflow: 0,
    });
    expect(calendarDayOverflow([1, 2, 3, 4, 5, 6]).overflow).toBe(2);
    expect(calendarDayOverflow([1, 2, 3, 4, 5, 6]).visible).toEqual([
      1, 2, 3, 4,
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/calendar.test.ts`

Expected: FAIL with cannot find module `./calendar` (or `calendarMonth` is not a function).

- [ ] **Step 3: Write the module**

Create `src/lib/calendar.ts`:

```ts
import type { BoardGate } from "./gates";
import type { Card } from "./types";

const DAY = 86_400_000;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Visible slips in a day cell before "+N more". */
export const CALENDAR_DAY_CAP = 4;

/** Sunday-first weekday labels for the month grid header. */
export const CALENDAR_WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** One cell in the Sunday-start month matrix. */
export interface CalendarDay {
  date: string;
  inMonth: boolean;
  isToday: boolean;
}

/** Card fields a calendar slip and CardAge need. */
export type CalendarCard = Pick<
  Card,
  | "id"
  | "external_id"
  | "title"
  | "color"
  | "raised_on"
  | "target_date"
  | "target_label"
  | "status"
  | "shipped_on"
  | "lane_id"
>;

/** A card placed on the month, tagged with the board CardAge must use. */
export interface CalendarSlip {
  card: CalendarCard;
  boardSlug: string;
  boardName: string;
  gates: readonly BoardGate[];
}

/**
 * Visible month from a query param. Garbage falls back to `today`'s UTC month.
 *
 * @param value - `searchParams.month` (string, array, or missing).
 * @param today - UTC day key `YYYY-MM-DD`.
 */
export function calendarMonth(value: unknown, today: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && MONTH.test(raw) ? raw : today.slice(0, 7);
}

/**
 * Step a `YYYY-MM` by whole months in UTC.
 *
 * @param month - `YYYY-MM`.
 * @param delta - Months to add (negative allowed).
 */
export function addCalendarMonths(month: string, delta: number): string {
  const [yearText, monthText] = month.split("-");
  const shifted = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1),
  );
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Board-chip filter. `null` means every known board.
 * Unknown slugs are dropped; nothing left means all.
 *
 * @param value - `searchParams.boards`.
 * @param known - Board slugs in the project.
 */
export function calendarBoards(
  value: unknown,
  known: readonly string[],
): string[] | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const wanted = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const ok = wanted.filter((slug) => known.includes(slug));
  return ok.length > 0 ? ok : null;
}

/**
 * Complete Sunday-start weeks covering `month`, including neighbour days.
 *
 * @param month - `YYYY-MM`.
 * @param today - UTC day key for the today outline.
 */
export function monthMatrix(month: string, today: string): CalendarDay[] {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const start = new Date(first.getTime() - first.getUTCDay() * DAY);
  const end = new Date(last.getTime() + (6 - last.getUTCDay()) * DAY);
  const days: CalendarDay[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += DAY) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.push({
      date,
      inMonth: date.startsWith(month),
      isToday: date === today,
    });
  }
  return days;
}

function byExternalId(a: CalendarSlip, b: CalendarSlip): number {
  return a.card.external_id.localeCompare(b.card.external_id, undefined, {
    numeric: true,
  });
}

/**
 * Split slips into days present in this matrix versus the unscheduled tray.
 * A target outside the matrix is omitted (not tray).
 *
 * @param slips - Live (non-archived) slips.
 * @param days - From {@link monthMatrix}.
 */
export function calendarGroups(
  slips: CalendarSlip[],
  days: CalendarDay[],
): { byDate: Map<string, CalendarSlip[]>; tray: CalendarSlip[] } {
  const present = new Set(days.map((day) => day.date));
  const byDate = new Map<string, CalendarSlip[]>();
  const tray: CalendarSlip[] = [];
  for (const slip of slips) {
    const target = slip.card.target_date;
    if (!target) {
      tray.push(slip);
      continue;
    }
    if (!present.has(target)) continue;
    const list = byDate.get(target) ?? [];
    list.push(slip);
    byDate.set(target, list);
  }
  for (const list of byDate.values()) list.sort(byExternalId);
  tray.sort(byExternalId);
  return { byDate, tray };
}

/**
 * First {@link CALENDAR_DAY_CAP} slips stay in the cell; the rest are `+N`.
 *
 * @param slips - Already sorted day's slips.
 */
export function calendarDayOverflow<T>(slips: readonly T[]): {
  visible: T[];
  overflow: number;
} {
  if (slips.length <= CALENDAR_DAY_CAP) {
    return { visible: [...slips], overflow: 0 };
  }
  return {
    visible: slips.slice(0, CALENDAR_DAY_CAP),
    overflow: slips.length - CALENDAR_DAY_CAP,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/calendar.test.ts`

Expected: PASS, all describes green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar.ts src/lib/calendar.test.ts
git commit -m "feat: group calendar slips by UTC target date"
```

---

### Task 2: Project calendar loader

**Files:**
- Create: `src/lib/project-calendar-data.ts`
- Create: `src/lib/project-calendar-data.test.ts`

**Interfaces:**
- Consumes: `CalendarSlip` / `CalendarCard` from `src/lib/calendar.ts`; `resolveBoardGates` from `src/lib/gates.ts`; `notFound` from `next/navigation`; `supabaseServer` from `src/lib/supabase/server.ts`
- Produces:

```ts
export interface ProjectCalendarBoard {
  slug: string;
  name: string;
}

export interface ProjectCalendarData {
  project: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  boards: ProjectCalendarBoard[];
  slips: CalendarSlip[];
}

export function assembleCalendarSlips(
  boards: readonly {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown> | null;
  }[],
  lanes: readonly { id: string; board_id: string; key: string; name: string; position: number; kind: Lane["kind"]; sla_days: number | null; wip_limit: number | null; color: string | null }[],
  cards: readonly (CalendarCard & { board_id: string; archived_at: string | null })[],
): CalendarSlip[];

export async function loadProjectCalendar(
  projectSlug: string,
): Promise<ProjectCalendarData>;
```

- [ ] **Step 1: Write the failing assemble tests**

Create `src/lib/project-calendar-data.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { assembleCalendarSlips } from "./project-calendar-data";

const board = {
  id: "b1",
  slug: "backlog",
  name: "Product backlog",
  settings: {} as Record<string, unknown>,
};

const lane = {
  id: "l1",
  board_id: "b1",
  key: "now",
  name: "Now",
  position: 0,
  kind: "work" as const,
  sla_days: null,
  wip_limit: null,
  color: null,
};

const card = {
  id: "c1",
  board_id: "b1",
  external_id: "7",
  title: "Auth",
  color: null,
  raised_on: "2026-08-01",
  target_date: "2026-09-15",
  target_label: null,
  status: "backlog",
  shipped_on: null,
  lane_id: "l1",
  archived_at: null,
};

describe("assembleCalendarSlips", () => {
  test("tags a live card with its board and skips archived", () => {
    const slips = assembleCalendarSlips(
      [board, { ...board, id: "b2", slug: "ops", name: "Ops" }],
      [lane],
      [
        card,
        { ...card, id: "c2", archived_at: "2026-09-01T00:00:00Z" },
        {
          ...card,
          id: "c3",
          board_id: "b2",
          external_id: "8",
          title: "Ops job",
        },
      ],
    );
    expect(slips.map((s) => s.card.id)).toEqual(["c1", "c3"]);
    expect(slips[0]?.boardSlug).toBe("backlog");
    expect(slips[1]?.boardName).toBe("Ops");
    expect(Array.isArray(slips[0]?.gates)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/project-calendar-data.test.ts`

Expected: FAIL, cannot find module `./project-calendar-data`.

- [ ] **Step 3: Implement assemble + loader**

Create `src/lib/project-calendar-data.ts`:

```ts
import { notFound } from "next/navigation";
import type { CalendarCard, CalendarSlip } from "./calendar";
import { resolveBoardGates } from "./gates";
import { supabaseServer } from "./supabase/server";
import type { Lane } from "./types";

/** Board identity shown on chips and slips. */
export interface ProjectCalendarBoard {
  slug: string;
  name: string;
}

/** Project calendar page payload. */
export interface ProjectCalendarData {
  project: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  boards: ProjectCalendarBoard[];
  slips: CalendarSlip[];
}

type BoardRow = {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown> | null;
};

type LaneRow = Pick<
  Lane,
  "id" | "key" | "name" | "position" | "kind" | "sla_days" | "wip_limit" | "color"
> & { board_id: string };

type CardRow = CalendarCard & {
  board_id: string;
  archived_at: string | null;
};

/**
 * Attach each live card to its board name, slug, and resolved gates.
 *
 * @param boards - Project boards.
 * @param lanes - Lanes for those boards (gate matching).
 * @param cards - Cards including archived rows (those are dropped).
 */
export function assembleCalendarSlips(
  boards: readonly BoardRow[],
  lanes: readonly LaneRow[],
  cards: readonly CardRow[],
): CalendarSlip[] {
  const boardById = new Map(boards.map((board) => [board.id, board]));
  const lanesByBoard = new Map<string, LaneRow[]>();
  for (const lane of lanes) {
    const list = lanesByBoard.get(lane.board_id) ?? [];
    list.push(lane);
    lanesByBoard.set(lane.board_id, list);
  }
  const gatesByBoard = new Map(
    boards.map((board) => [
      board.id,
      resolveBoardGates(board.settings, lanesByBoard.get(board.id) ?? []),
    ]),
  );
  const slips: CalendarSlip[] = [];
  for (const card of cards) {
    if (card.archived_at) continue;
    const board = boardById.get(card.board_id);
    if (!board) continue;
    slips.push({
      card: {
        id: card.id,
        external_id: card.external_id,
        title: card.title,
        color: card.color,
        raised_on: card.raised_on,
        target_date: card.target_date,
        target_label: card.target_label,
        status: card.status,
        shipped_on: card.shipped_on,
        lane_id: card.lane_id,
      },
      boardSlug: board.slug,
      boardName: board.name,
      gates: gatesByBoard.get(board.id) ?? [],
    });
  }
  return slips;
}

/**
 * Every board's live cards for the project calendar. RLS scopes the read.
 *
 * @param projectSlug - Project URL slug.
 */
export async function loadProjectCalendar(
  projectSlug: string,
): Promise<ProjectCalendarData> {
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id, slug, name, settings")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) notFound();

  const { data: boards } = await db
    .from("boards")
    .select("id, slug, name, settings")
    .eq("project_id", project.id)
    .order("name");
  const boardRows = (boards ?? []) as BoardRow[];
  const ids = boardRows.map((board) => board.id);
  if (ids.length === 0) {
    return {
      project: {
        ...project,
        settings: (project.settings ?? {}) as Record<string, unknown>,
      },
      boards: [],
      slips: [],
    };
  }

  const [{ data: lanes }, { data: cards }] = await Promise.all([
    db
      .from("lanes")
      .select(
        "id, board_id, key, name, position, kind, sla_days, wip_limit, color",
      )
      .in("board_id", ids),
    db
      .from("cards")
      .select(
        "id, board_id, external_id, title, color, raised_on, target_date, target_label, status, shipped_on, lane_id, archived_at",
      )
      .in("board_id", ids),
  ]);

  return {
    project: {
      ...project,
      settings: (project.settings ?? {}) as Record<string, unknown>,
    },
    boards: boardRows.map((board) => ({ slug: board.slug, name: board.name })),
    slips: assembleCalendarSlips(
      boardRows,
      (lanes ?? []) as LaneRow[],
      (cards ?? []) as CardRow[],
    ),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `bun test src/lib/project-calendar-data.test.ts src/lib/calendar.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/project-calendar-data.ts src/lib/project-calendar-data.test.ts
git commit -m "feat: load project calendar slips with per-board gates"
```

---

### Task 3: Slip, paper CSS, board page (read-only)

**Files:**
- Create: `src/components/calendar/calendar-slip.tsx`
- Create: `src/components/calendar/calendar-view.tsx` (grid + tray + +N popover; dnd in Task 4 — export the layout so Task 4 only wraps DndContext)
- Create: `src/app/p/[project]/b/[board]/calendar/page.tsx`
- Modify: `src/styles/components/paper.css` — insert the calendar block **inside** `@layer components`, immediately before the closing `}` at line 2236 (before the `@media` queries that follow the layer).
- Modify: `src/components/board/board-view.tsx` — add Calendar next to Timeline (`href={`/p/${data.project.slug}/b/${data.board.slug}/calendar`}`)
- Modify: `src/app/p/[project]/b/[board]/timeline/page.tsx` — in the header nav area, add `<Link className="paper-link" href={`/p/${project}/b/${board}/calendar`}>Calendar</Link>`
- Modify: `src/app/p/[project]/b/[board]/cockpit/page.tsx` — add the same Calendar link beside Timeline
- Modify: `src/app/p/[project]/page.tsx` — in the letterhead stats row, add `<Link className="paper-link" href={`${href}/calendar`}>Calendar</Link>`

**Interfaces:**
- Consumes: `CalendarSlip`, `calendarGroups`, `monthMatrix`, `calendarDayOverflow`, `CALENDAR_WEEKDAYS`, `addCalendarMonths` from Task 1; `CardAge` from `src/components/board/card-age.tsx`; `cardColorModifier` / `parseCardColor` from `src/lib/card-color.ts`; `loadBoard` from `src/lib/board-data.ts`; `resolveBoardGates`; `forgottenAfterDays` / `timelineToday`
- Produces: `CalendarSlip` component; `CalendarView` (read-only this task)

For Task 3, `CalendarView` must already accept `onPatch` as optional. If absent, slips are not draggable. Task 4 passes `onPatch`.

- [ ] **Step 1: Insert paper CSS**

Insert before the `@layer components` closing `}` (currently line 2236 of `src/styles/components/paper.css`):

```css
  /* Month of target dates — square days, two-up slips, unscheduled tray. */
  .calendar-page {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 1rem;
    align-items: stretch;
  }
  .calendar-grid {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.35rem;
  }
  .calendar-dow {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-grey-faint);
    text-align: center;
  }
  .calendar-day {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 0.28rem;
    background: var(--surface-panel);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-card);
  }
  .calendar-day[data-today="true"] {
    outline: 1px solid var(--color-ink);
    outline-offset: -1px;
  }
  .calendar-day[data-in-month="false"] {
    color: var(--color-grey-faint);
  }
  .calendar-day-num {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 11px;
    line-height: 1;
    color: var(--color-grey);
    margin-bottom: 0.25rem;
  }
  .calendar-day[data-in-month="false"] .calendar-day-num {
    color: var(--color-grey-faint);
  }
  .calendar-pack {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.2rem;
    align-content: start;
    flex: 1;
    min-height: 0;
  }
  .calendar-more {
    grid-column: 1 / -1;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--color-grey);
    text-align: left;
    background: none;
    border: 0;
    padding: 0.1rem 0.15rem;
    cursor: pointer;
  }
  .calendar-more:hover {
    color: var(--color-ink);
  }
  .calendar-tray {
    width: 14rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0.6rem;
    background: var(--surface-panel);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-card);
  }
  .calendar-tray h2 {
    font-size: 0.95rem;
    margin: 0 0 0.4rem;
  }
  .calendar-tray-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    overflow: auto;
    min-height: 0;
  }
  .calendar-slip {
    padding: 0.35rem 0.4rem 0.4rem;
  }
  .calendar-slip .calendar-slip-id {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 10px;
    color: var(--color-grey-faint);
  }
  .calendar-slip .calendar-slip-title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 500;
  }
  .calendar-slip .calendar-slip-board {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 9px;
    color: var(--color-grey);
    margin-top: 0.15rem;
  }
  .calendar-day-popover {
    width: min(18rem, 90vw);
    padding: 0.6rem;
    background: var(--surface-card);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-lift);
  }
  .calendar-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .calendar-chip {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 11px;
    padding: 0.15rem 0.45rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-btn);
    color: var(--color-ink);
    text-decoration: none;
  }
  .calendar-chip[data-on="true"] {
    background: var(--surface-card);
  }
  .calendar-chip:not([data-on="true"]) {
    color: var(--color-grey);
    border-style: dashed;
  }
```

Do not add new tokens. Do not copy `.ui/calendar` radius variables.

- [ ] **Step 2: CalendarSlip**

Create `src/components/calendar/calendar-slip.tsx`:

```tsx
"use client";

import { CardAge } from "@/components/board/card-age";
import { cardColorModifier, parseCardColor } from "@/lib/card-color";
import type { CalendarSlip as CalendarSlipData } from "@/lib/calendar";
import Link from "next/link";

/**
 * Mini post-it for a calendar day or the unscheduled tray.
 *
 * @param props.slip - Card plus board identity and gates.
 * @param props.projectSlug - Project URL slug.
 * @param props.showBoard - Print the board name (project calendar).
 * @param props.today - UTC day key.
 * @param props.watchDays - Forgotten watch window.
 * @param props.drag - Optional dnd-kit listeners/attributes from Task 4.
 * @param props.dragging - Dim while this slip is the overlay source.
 */
export function CalendarSlip(props: {
  slip: CalendarSlipData;
  projectSlug: string;
  showBoard: boolean;
  today: string;
  watchDays: number;
  drag?: {
    attributes: React.HTMLAttributes<HTMLElement>;
    listeners: Record<string, Function> | undefined;
    setNodeRef: (node: HTMLElement | null) => void;
  };
  dragging?: boolean;
}) {
  const { card } = props.slip;
  const href = `/p/${props.projectSlug}/b/${props.slip.boardSlug}/c/${card.external_id}`;
  const color = parseCardColor(card.color);
  const colorClass = cardColorModifier(color) ?? "";
  return (
    <article
      ref={props.drag?.setNodeRef}
      {...props.drag?.attributes}
      {...props.drag?.listeners}
      data-id={card.external_id}
      className={`paper-card calendar-slip ${colorClass} ${props.dragging ? "opacity-40" : ""}`}
    >
      <span className="calendar-slip-id">#{card.external_id}</span>
      <Link
        href={href}
        className="calendar-slip-title hover:underline"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {card.title}
      </Link>
      {props.showBoard && (
        <p className="calendar-slip-board">{props.slip.boardName}</p>
      )}
      <CardAge
        card={card}
        today={props.today}
        watchDays={props.watchDays}
        gates={props.slip.gates}
      />
    </article>
  );
}
```

- [ ] **Step 3: CalendarView (no dnd yet)**

Create `src/components/calendar/calendar-view.tsx` with:

- Header: project name (mono eyebrow), `h1` month label via `Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })` on `${month}-01`, prev/next `Link`s to the same path with `?month=` from `addCalendarMonths` (preserve `boards` query when present).
- Optional board chips when `boards.length > 1`.
- `TooltipProvider` wrapping the desk.
- `monthMatrix` + `calendarGroups` from props.slips (already filtered by the server).
- 7 weekday labels then 35/42/28 `.calendar-day` cells. `data-calendar-day={date}`, `data-in-month`, `data-today`.
- Neighbour-month cells still list their slips.
- `calendarDayOverflow` in each cell. `+N more` is a `Popover` trigger (`src/components/ui/popover.tsx`) whose content has `className="calendar-day-popover"` and lists **all** slips for that day. While that popover is open, render **no** slips in the cell pack (only the date number and the trigger) so Task 4 can attach one draggable id per card.
- Tray: `data-calendar-tray`, heading `Unscheduled` plus count, empty copy `Nothing undated`.
- `role="alert"` error slot (empty until Task 4).
- Props:

```ts
export function CalendarView(props: {
  projectSlug: string;
  projectName: string;
  boardSlug: string | null;
  heading: string;
  month: string;
  today: string;
  watchDays: number;
  slips: CalendarSlip[];
  boards: { slug: string; name: string }[];
  selectedBoards: string[] | null;
  path: string;
  onPatch?: (cardId: string, targetDate: string | null) => Promise<{ ok: true } | { ok: false; error: string }>;
})
```

Chip href helper (in the same file, not exported):

```ts
function boardsHref(
  path: string,
  month: string,
  selected: string[] | null,
  known: { slug: string }[],
  toggle: string,
): string {
  const all = known.map((b) => b.slug);
  const current = selected ?? all;
  const next = current.includes(toggle)
    ? current.filter((slug) => slug !== toggle)
    : [...current, toggle];
  const params = new URLSearchParams({ month });
  if (next.length > 0 && next.length < all.length) {
    params.set("boards", next.join(","));
  }
  return `${path}?${params.toString()}`;
}
```

A chip is `data-on="true"` when `selectedBoards` is null or includes its slug.

- [ ] **Step 4: Board calendar page**

Create `src/app/p/[project]/b/[board]/calendar/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { loadBoard } from "@/lib/board-data";
import {
  calendarMonth,
  type CalendarSlip,
} from "@/lib/calendar";
import { resolveBoardGates } from "@/lib/gates";
import { currentMember } from "@/lib/supabase/server";
import { forgottenAfterDays, timelineToday } from "@/lib/timeline";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

export default async function BoardCalendarPage(
  props: PageProps<"/p/[project]/b/[board]/calendar">,
) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadBoard(project, board);
  const today = timelineToday();
  const month = calendarMonth((await props.searchParams).month, today);
  const gates = resolveBoardGates(
    data.board.settings as Record<string, unknown>,
    data.lanes,
  );
  const slips: CalendarSlip[] = data.cards
    .filter((card) => !card.archived_at)
    .map((card) => ({
      card,
      boardSlug: data.board.slug,
      boardName: data.board.name,
      gates,
    }));
  const path = `/p/${project}/b/${board}/calendar`;
  return (
    <main className="flex h-full min-h-0 flex-1 flex-col px-4 pt-5 pb-4 sm:px-6">
      <Link href={`/p/${project}/b/${board}`} className="text-xs text-muted-foreground hover:underline">
        ← {data.board.name}
      </Link>
      <CalendarView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={board}
        heading={data.board.name}
        month={month}
        today={today}
        watchDays={forgottenAfterDays(data.project.settings)}
        slips={slips}
        boards={[]}
        selectedBoards={null}
        path={path}
      />
    </main>
  );
}
```

If `PageProps<"/p/[project]/b/[board]/calendar">` is missing until `next dev` regenerates types, use the same `params: Promise<{ project: string; board: string }>` shape as `cockpit/page.tsx`.

- [ ] **Step 5: Nav links**

Board view, timeline, cockpit, project letterhead — Calendar `paper-link` as listed in Files. Do not remove Timeline.

- [ ] **Step 6: Typecheck**

Run: `bun run check`

Expected: no errors in the new files. Fix only issues you introduced.

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar/calendar-slip.tsx src/components/calendar/calendar-view.tsx src/app/p/[project]/b/[board]/calendar/page.tsx src/styles/components/paper.css src/components/board/board-view.tsx src/app/p/[project]/b/[board]/timeline/page.tsx src/app/p/[project]/b/[board]/cockpit/page.tsx src/app/p/[project]/page.tsx
git commit -m "feat: render board calendar month of target dates"
```

---

### Task 4: Drag to set or clear target

**Files:**
- Modify: `src/components/calendar/calendar-view.tsx`
- Modify: `src/components/calendar/calendar-slip.tsx` (wire `useDraggable` here or in a thin `DraggableCalendarSlip` wrapper in the same folder — prefer a wrapper so the slip stays presentational)
- Modify: `src/app/p/[project]/b/[board]/actions.ts` — after a successful `updateCard`, call:

```ts
revalidatePath("/p/[project]/b/[board]/calendar", "page");
revalidatePath("/p/[project]/calendar", "page");
```

(same pattern as `refreshBoards()` in that file)

- Modify: `src/app/p/[project]/b/[board]/calendar/page.tsx` — pass `onPatch` that calls `updateCard(id, { target_date })`

**Interfaces:**
- Consumes: `updateCard` / `CardPatch` from `src/app/p/[project]/b/[board]/actions.ts`; `@dnd-kit/core` `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `PointerSensor`, `KeyboardSensor`, `pointerWithin`, `MeasuringStrategy`
- Produces: drops persist `target_date`

Droppable ids (verbatim):

- Day: `calendar-day:${date}` (the `YYYY-MM-DD`)
- Tray: `calendar-tray`

Draggable id: `card.id` (uuid).

Pointer sensor: `{ activationConstraint: { distance: 6 } }` — same as the board.

- [ ] **Step 1: Droppable day + tray**

Each `.calendar-day` calls `useDroppable({ id: \`calendar-day:${day.date}\` })` and sets `ref={setNodeRef}`. The tray uses `useDroppable({ id: "calendar-tray" })`. Optional: `data-over` class using `isOver` with a hairline ink border (no new tokens).

Create `src/components/calendar/draggable-calendar-slip.tsx`:

```tsx
"use client";
import { useDraggable } from "@dnd-kit/core";
import { CalendarSlip } from "./calendar-slip";
import type { ComponentProps } from "react";

/** dnd-kit handle around {@link CalendarSlip}. */
export function DraggableCalendarSlip(
  props: Omit<ComponentProps<typeof CalendarSlip>, "drag" | "dragging">,
) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.slip.card.id,
  });
  return (
    <CalendarSlip
      {...props}
      dragging={isDragging}
      drag={{ attributes, listeners, setNodeRef }}
    />
  );
}
```

Use `DraggableCalendarSlip` everywhere a slip is listed (cell, popover, tray). Overlay: `DragOverlay` with a non-draggable `CalendarSlip`.

- [ ] **Step 2: Optimistic onDragEnd**

In `CalendarView`, keep `const [items, setItems] = useState(props.slips)` and sync with `useEffect(() => setItems(props.slips), [props.slips])`.

```ts
function applyTarget(cardId: string, targetDate: string | null) {
  setItems((prev) =>
    prev.map((slip) =>
      slip.card.id === cardId
        ? { ...slip, card: { ...slip.card, target_date: targetDate } }
        : slip,
    ),
  );
}

async function onDragEnd(event: DragEndEvent) {
  const over = event.over?.id;
  const cardId = String(event.active.id);
  if (!over || !props.onPatch) return;
  const previous = items.find((slip) => slip.card.id === cardId);
  if (!previous) return;
  let next: string | null | undefined;
  if (over === "calendar-tray") next = null;
  else {
    const key = String(over);
    if (key.startsWith("calendar-day:")) next = key.slice("calendar-day:".length);
  }
  if (next === undefined) return;
  if (next === previous.card.target_date) return;
  applyTarget(cardId, next);
  const result = await props.onPatch(cardId, next);
  if (!result.ok) {
    applyTarget(cardId, previous.card.target_date);
    setError(result.error);
  }
}
```

Show `error` with the same paper alert as the board:

```tsx
{error && (
  <p role="alert" className="basis-full border-l-2 border-[var(--pen-red)] bg-[var(--surface-card)] px-3 py-2 text-sm">
    {error}
  </p>
)}
```

`DndContext`: `id="calendar-dnd"`, `collisionDetection={pointerWithin}`, `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`.

- [ ] **Step 3: Wire updateCard + revalidate**

In `updateCard`, after a successful db update and event insert (before `return { ok: true }`):

```ts
  revalidatePath("/p/[project]/b/[board]/calendar", "page");
  revalidatePath("/p/[project]/calendar", "page");
```

Board page:

```tsx
        onPatch={async (cardId, targetDate) =>
          updateCard(cardId, { target_date: targetDate })
        }
```

- [ ] **Step 4: Check**

Run: `bun run check`

Expected: clean on the files you touched.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/calendar-view.tsx src/components/calendar/calendar-slip.tsx src/components/calendar/draggable-calendar-slip.tsx src/app/p/[project]/b/[board]/actions.ts src/app/p/[project]/b/[board]/calendar/page.tsx
git commit -m "feat: drag calendar slips onto target days"
```

---

### Task 5: Project calendar page

**Files:**
- Create: `src/app/p/[project]/calendar/page.tsx`

**Interfaces:**
- Consumes: `loadProjectCalendar`, `calendarMonth`, `calendarBoards`, `CalendarView`, `updateCard`, `forgottenAfterDays`, `timelineToday`

- [ ] **Step 1: Project page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { updateCard } from "@/app/p/[project]/b/[board]/actions";
import { CalendarView } from "@/components/calendar/calendar-view";
import { calendarBoards, calendarMonth } from "@/lib/calendar";
import { loadProjectCalendar } from "@/lib/project-calendar-data";
import { currentMember } from "@/lib/supabase/server";
import { forgottenAfterDays, timelineToday } from "@/lib/timeline";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

export default async function ProjectCalendarPage(
  props: PageProps<"/p/[project]/calendar">,
) {
  const { project } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadProjectCalendar(project);
  const today = timelineToday();
  const search = await props.searchParams;
  const month = calendarMonth(search.month, today);
  const selected = calendarBoards(
    search.boards,
    data.boards.map((board) => board.slug),
  );
  const slips = selected
    ? data.slips.filter((slip) => selected.includes(slip.boardSlug))
    : data.slips;
  return (
    <main className="flex h-full min-h-0 flex-1 flex-col px-4 pt-5 pb-4 sm:px-6">
      <Link href={`/p/${project}`} className="text-xs text-muted-foreground hover:underline">
        ← {data.project.name}
      </Link>
      <CalendarView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={null}
        heading="All boards"
        month={month}
        today={today}
        watchDays={forgottenAfterDays(data.project.settings)}
        slips={slips}
        boards={data.boards}
        selectedBoards={selected}
        path={`/p/${project}/calendar`}
        onPatch={async (cardId, targetDate) =>
          updateCard(cardId, { target_date: targetDate })
        }
      />
    </main>
  );
}
```

`showBoard` on slips is `props.boardSlug === null`.

Clicking a project-calendar slip goes to `/p/{project}/b/{board}/c/{id}` (full page is acceptable; no project-level intercepting modal in this plan).

- [ ] **Step 2: Check**

Run: `bun run check`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/p/[project]/calendar/page.tsx src/components/calendar/calendar-view.tsx
git commit -m "feat: add project calendar across boards"
```

---

### Task 6: Playwright

**Files:**
- Create: `e2e/calendar.spec.ts`

Use `signIn` from `e2e/support/sign-in.ts`. `BOARD` default `/p/demo/b/backlog`. For two-board coverage, create a throwaway project like `e2e/management.spec.ts` (slug `e2e-calendar-project`), two boards, one card each with distinct titles, then delete the project in `finally`.

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";
const PROJECT = "e2e-calendar-project";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("board calendar shows a dated card on that day and undated in the tray", async ({
  page,
}) => {
  await page.goto(BOARD);
  const card = page.locator('[data-lane="unsorted"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await card.hover();
  await card.getByLabel("Target date").fill("2026-09-15");
  await page.waitForTimeout(600);
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  await expect(
    page.locator('[data-calendar-day="2026-09-15"] [data-id="' + id + '"]'),
  ).toBeVisible();
});

test("drag from the tray onto a day persists after reload", async ({
  page,
}) => {
  await page.goto(BOARD);
  const card = page.locator('[data-lane="unsorted"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await card.hover();
  await card.getByLabel("Target date").fill("");
  await page.waitForTimeout(600);
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  const slip = page.locator(`[data-calendar-tray] [data-id="${id}"]`);
  await expect(slip).toBeVisible();
  const from = (await slip.boundingBox())!;
  const day = page.locator('[data-calendar-day="2026-09-16"]');
  const to = (await day.boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(from.x + 24, from.y + 14, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 15,
  });
  await expect(day.locator(`[data-id="${id}"]`)).toBeVisible();
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(
    page.locator(`[data-calendar-day="2026-09-16"] [data-id="${id}"]`),
  ).toBeVisible();
  await page.goto(`${BOARD}`);
  const again = page.locator(`[data-id="${id}"]`);
  await again.hover();
  await expect(again.getByLabel("Target date")).toHaveValue("2026-09-16");
});

test("project calendar labels two boards and a chip hides one", async ({
  page,
}) => {
  await admin.from("projects").delete().eq("slug", PROJECT);
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Name").fill("E2E calendar project");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(`/p/${PROJECT}`);
    await page.getByRole("button", { name: "New board" }).click();
    await page.locator("#board-name").fill("Alpha");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${PROJECT}/b/alpha`);
    await page.getByRole("button", { name: "Add card to Unsorted" }).click();
    await page.locator("#new-card-title").fill("Alpha dated");
    await page.locator("#new-card-target").fill("2026-09-20");
    await page.getByRole("button", { name: "Create in Unsorted" }).click();
    await expect(page.locator("article").filter({ hasText: "Alpha dated" })).toBeVisible();
    await page.goto(`/p/${PROJECT}`);
    await page.getByRole("button", { name: "New board" }).click();
    await page.locator("#board-name").fill("Beta");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${PROJECT}/b/beta`);
    await page.getByRole("button", { name: "Add card to Unsorted" }).click();
    await page.locator("#new-card-title").fill("Beta dated");
    await page.locator("#new-card-target").fill("2026-09-20");
    await page.getByRole("button", { name: "Create in Unsorted" }).click();
    await expect(page.locator("article").filter({ hasText: "Beta dated" })).toBeVisible();
    await page.goto(`/p/${PROJECT}/calendar?month=2026-09`);
    const day = page.locator('[data-calendar-day="2026-09-20"]');
    await expect(day.getByText("Alpha")).toBeVisible();
    await expect(day.getByText("Beta")).toBeVisible();
    await page.getByRole("link", { name: "Beta", exact: true }).click();
    await expect(day.getByText("Alpha dated")).toBeVisible();
    await expect(day.getByText("Beta dated")).toHaveCount(0);
  } finally {
    await admin.from("projects").delete().eq("slug", PROJECT);
  }
});

test("+N opens the rest of a packed day", async ({ page }) => {
  // Seed five targets on 2026-09-18 via the first five unsorted cards (hover + fill).
  await page.goto(BOARD);
  const cards = page.locator('[data-lane="unsorted"] [data-id]');
  const n = Math.min(5, await cards.count());
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    await card.hover();
    await card.getByLabel("Target date").fill("2026-09-18");
    await page.waitForTimeout(200);
  }
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  const more = page.locator('[data-calendar-day="2026-09-18"] .calendar-more');
  if ((await more.count()) === 0) test.skip();
  await more.click();
  await expect(page.locator(".calendar-day-popover [data-id]")).toHaveCount(n);
});

test("clicking a board-calendar slip opens the card dialog", async ({
  page,
}) => {
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  const slip = page.locator("[data-calendar-day] [data-id]").first();
  await expect(slip).toBeVisible();
  await slip.getByRole("link").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
```

- [ ] **Step 2: Run e2e**

Run: `bun run test:e2e e2e/calendar.spec.ts`

Expected: PASS. If +N skip fires because demo has fewer than 5 unsorted cards, that test may skip — do not leave it skipped: date extra cards from other lanes instead (`[data-lane] [data-id]` first five non-archive).

- [ ] **Step 3: Commit**

```bash
git add e2e/calendar.spec.ts
git commit -m "test: cover calendar month, drag, and project chips"
```

---

### Task 7: Operator docs

**Files:**
- Create: `docs/calendar.md`

- [ ] **Step 1: Write `docs/calendar.md`**

```md
# Calendar

A month of **target dates**. Board: `/p/<project>/b/<board>/calendar`. Project: `/p/<project>/calendar`. Timeline remains the raised-date rail; the cockpit remains the epic fleet.

Cards sit on the UTC day in `target_date`. No target (including a rough label only) sits in **Unscheduled**. Drag a slip onto a day to set the target; drag onto the tray to clear it. Archived cards are omitted. Neighbour-month days fill the grid when the month does not start on Sunday; dropping on them does not change the visible month.

Each slip is `#id`, title, and the same raised-date age chip as the board. The project calendar also prints the board name and offers chips to hide boards (`?boards=`).

`?month=YYYY-MM` is the visible month. Garbage falls back to today (UTC).
```

- [ ] **Step 2: Commit**

```bash
git add docs/calendar.md
git commit -m "docs: describe the target-date calendar"
```

---

## Self-review (author)

1. **Spec coverage:** Month matrix, tray, overflow + popover, CardAge, project mix + chips, drag persist, neighbour days, archived off, nav links, lib tests, e2e, `docs/calendar.md`, no shadcn Calendar — each has a task.
2. **Placeholders:** None. Create-card locators are `Add card to Unsorted`, `#new-card-title`, `#new-card-target`, `Create in Unsorted`.
3. **Types:** `CalendarSlip`, `calendarMonth`, `onPatch(cardId, targetDate)` stay consistent across tasks.
