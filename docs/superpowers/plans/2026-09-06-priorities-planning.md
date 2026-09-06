# Priorities Planning Screen ("The Jar") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A drag-to-prioritize planning screen at board and project level that shows which cards have no priority and lets stakeholders weigh cards P1/P2/P3, fixing tracker #9 (priority filter has no data).

**Architecture:** One new nullable `cards.priority_rank` column (DB-only, never in the sync export mapping) carries a global fine ordering; `priority` (already round-tripping to markdown) is the band. A shared client view renders three narrowing bands plus an "unweighed" desk; two thin pages mount it (`/p/[project]/priorities` and `/p/[project]/b/[board]/priorities`), mirroring the project-calendar pattern. One server action `prioritizeCard` writes both fields.

**Tech Stack:** Next.js App Router, Supabase (server client + SQL migration), HTML5 drag & drop, bun test, Biome.

**Spec:** `docs/plans/2026-09-06-priorities-planning-design.md`

## Global Constraints

- **Naming:** "jar", "stones/pebbles/sand", "unweighed", "the desk" appear ONLY in rendered strings. All identifiers speak priority planning: `priority_rank`, `priorities.ts`, `priorities-data.ts`, `priorities-view.tsx`, `prioritizeCard`.
- **Sync invisibility:** `priority_rank` is never added to `backlog/cardstock/mapping.json` or any ETL/scheme file. `priority` semantics unchanged.
- **Exclusions:** a card is out of the planning screen when `archived_at` is set, its lane kind is `archive`, or it hits a board "shipped" gate (`gateOutcomeSets` — covers `done`-kind lanes and `shipped`/`done` statuses; the `shipped` lane is kind `work`, so gates, not lane kind, are the authority).
- **Tests:** `bun test <file>` for units. Lint/typecheck: `bunx biome check <files>` and `bunx tsc --noEmit`.
- **Commits:** commit only files this plan touches — the operator has unrelated uncommitted work in `packages/` (tracker #19). Never `git add -A`. End commit messages with the session trailer already used on this branch.
- **P1 soft cap:** hardcoded 6, copy only ("room for N"), no enforcement.
- **UI work:** load the `cardstock-design` skill before Task 5. Reference prototype: `tmp/Priority visualization concept.zip`, artboard "The Jar v3" (already extracted in the session scratchpad under `priority-proto/`).

---

### Task 1: `priority_rank` column

**Files:**
- Create: `supabase/migrations/20260913000000_priority_rank.sql`

**Interfaces:**
- Produces: `cards.priority_rank double precision null` — read/written by Tasks 3–5. Not represented on the global `Card` type in `src/lib/types.ts` (feature-local row types only, so no other select list needs touching).

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply locally**

Run: `bunx supabase migration up`
Expected: `20260913000000_priority_rank.sql` applied without error. (If the local stack is unhealthy, `bun run db:start` first. Do NOT run `db:reset` — the local DB may hold synced fixture data.)

- [ ] **Step 3: Verify the column exists**

Run: `docker exec supabase_db_cardstock psql -U postgres -c "\d public.cards" | grep priority_rank`
Expected: `priority_rank | double precision`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260913000000_priority_rank.sql
git commit -m "feat(#9): add cards.priority_rank for the priorities planning screen"
```

---

### Task 2: Pure planning helpers

**Files:**
- Create: `src/lib/priorities.ts`
- Test: `src/lib/priorities.test.ts`

**Interfaces:**
- Consumes: `rankBetween` from `src/lib/rank.ts` (`(before: number | null, after: number | null) => number`).
- Produces:
  - `interface PriorityCard { id: string; external_id: string; title: string; epic: string | null; status: string; effort: "L" | "M" | "H" | null; priority: 1 | 2 | 3 | null; priority_rank: number | null; lane_name: string; lane_position: number; lane_rank: number; board_slug: string; board_name: string; }`
  - `interface PriorityBands { bands: Record<1 | 2 | 3, PriorityCard[]>; unweighed: PriorityCard[]; }`
  - `partitionBands(cards: readonly PriorityCard[]): PriorityBands`
  - `rankForDrop(band: readonly PriorityCard[], index: number): number` — the `priority_rank` to write for an insertion at `index` into a band's display order (the dragged card already removed from `band`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "bun:test";
import { partitionBands, type PriorityCard, rankForDrop } from "./priorities";

function card(over: Partial<PriorityCard> & { id: string }): PriorityCard {
  return {
    external_id: over.id,
    title: `Card ${over.id}`,
    epic: null,
    status: "backlog",
    effort: null,
    priority: null,
    priority_rank: null,
    lane_name: "Now",
    lane_position: 1,
    lane_rank: 1,
    board_slug: "b",
    board_name: "B",
    ...over,
  };
}

describe("partitionBands", () => {
  test("splits cards into bands by priority and the rest into unweighed", () => {
    const out = partitionBands([
      card({ id: "a", priority: 1, priority_rank: 2 }),
      card({ id: "b", priority: 3, priority_rank: 1 }),
      card({ id: "c" }),
    ]);
    expect(out.bands[1].map((c) => c.id)).toEqual(["a"]);
    expect(out.bands[2]).toEqual([]);
    expect(out.bands[3].map((c) => c.id)).toEqual(["b"]);
    expect(out.unweighed.map((c) => c.id)).toEqual(["c"]);
  });

  test("orders a band by priority_rank, nulls after, then lane position and lane rank", () => {
    const out = partitionBands([
      card({ id: "later", priority: 1, lane_position: 3, lane_rank: 1 }),
      card({ id: "ranked-2", priority: 1, priority_rank: 2 }),
      card({ id: "now", priority: 1, lane_position: 1, lane_rank: 2 }),
      card({ id: "ranked-1", priority: 1, priority_rank: 1 }),
    ]);
    expect(out.bands[1].map((c) => c.id)).toEqual([
      "ranked-1",
      "ranked-2",
      "now",
      "later",
    ]);
  });

  test("orders unweighed by lane position then lane rank", () => {
    const out = partitionBands([
      card({ id: "x", lane_position: 2, lane_rank: 1 }),
      card({ id: "y", lane_position: 1, lane_rank: 2 }),
      card({ id: "z", lane_position: 1, lane_rank: 1 }),
    ]);
    expect(out.unweighed.map((c) => c.id)).toEqual(["z", "y", "x"]);
  });
});

describe("rankForDrop", () => {
  const band = [
    card({ id: "a", priority: 2, priority_rank: 1 }),
    card({ id: "b", priority: 2, priority_rank: 2 }),
  ];
  test("midpoint between two ranked neighbours", () => {
    expect(rankForDrop(band, 1)).toBe(1.5);
  });
  test("before the first card", () => {
    expect(rankForDrop(band, 0)).toBe(0);
  });
  test("after the last card", () => {
    expect(rankForDrop(band, 2)).toBe(3);
  });
  test("empty band", () => {
    expect(rankForDrop([], 0)).toBe(1);
  });
  test("a null-ranked neighbour counts as an open end", () => {
    const mixed = [
      card({ id: "a", priority: 2, priority_rank: 5 }),
      card({ id: "b", priority: 2 }),
    ];
    // Insert between ranked `a` and unranked `b`: only `a` bounds the rank.
    expect(rankForDrop(mixed, 1)).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/priorities.test.ts`
Expected: FAIL — `Cannot find module './priorities'`.

- [ ] **Step 3: Implement**

```ts
import { rankBetween } from "./rank";

/**
 * A card as the priorities planning screen sees it. `priority` is the band
 * (P1 highest); `priority_rank` is the stakeholder-importance ordering —
 * distinct from lane `rank`, which is execution order. Null `priority_rank`
 * means the card was never dragged on the planning screen.
 */
export interface PriorityCard {
  id: string;
  external_id: string;
  title: string;
  epic: string | null;
  status: string;
  effort: "L" | "M" | "H" | null;
  priority: 1 | 2 | 3 | null;
  priority_rank: number | null;
  lane_name: string;
  lane_position: number;
  lane_rank: number;
  board_slug: string;
  board_name: string;
}

export interface PriorityBands {
  bands: Record<1 | 2 | 3, PriorityCard[]>;
  unweighed: PriorityCard[];
}

/** Execution order as the tiebreak: where work sits is the best guess at importance until someone drags it. */
function byLane(a: PriorityCard, b: PriorityCard): number {
  return (
    a.lane_position - b.lane_position ||
    a.lane_rank - b.lane_rank ||
    a.external_id.localeCompare(b.external_id, undefined, { numeric: true })
  );
}

/** Ranked cards first in rank order; never-dragged cards after, in lane order. */
function byImportance(a: PriorityCard, b: PriorityCard): number {
  if (a.priority_rank != null && b.priority_rank != null)
    return a.priority_rank - b.priority_rank || byLane(a, b);
  if (a.priority_rank != null) return -1;
  if (b.priority_rank != null) return 1;
  return byLane(a, b);
}

/** Split into P1/P2/P3 bands plus the unweighed desk, each in display order. */
export function partitionBands(cards: readonly PriorityCard[]): PriorityBands {
  const bands: PriorityBands["bands"] = { 1: [], 2: [], 3: [] };
  const unweighed: PriorityCard[] = [];
  for (const card of cards) {
    if (card.priority) bands[card.priority].push(card);
    else unweighed.push(card);
  }
  bands[1].sort(byImportance);
  bands[2].sort(byImportance);
  bands[3].sort(byImportance);
  unweighed.sort(byLane);
  return { bands, unweighed };
}

/**
 * The `priority_rank` for an insertion at `index` of a band's display order
 * (dragged card already removed). A null-ranked neighbour is an open end;
 * the server renormalises the band whenever the client names its order.
 */
export function rankForDrop(
  band: readonly PriorityCard[],
  index: number,
): number {
  const before = index > 0 ? (band[index - 1]?.priority_rank ?? null) : null;
  const after = index < band.length ? (band[index]?.priority_rank ?? null) : null;
  return rankBetween(before, after);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/priorities.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Lint and commit**

```bash
bunx biome check src/lib/priorities.ts src/lib/priorities.test.ts
git add src/lib/priorities.ts src/lib/priorities.test.ts
git commit -m "feat(#9): band partitioning and drop-rank helpers for priority planning"
```

---

### Task 3: Data loader

**Files:**
- Create: `src/lib/priorities-data.ts`
- Test: `src/lib/priorities-data.test.ts`

**Interfaces:**
- Consumes: `PriorityCard` from Task 2; `resolveBoardGates`, `gateOutcomeSets` from `src/lib/gates.ts`; `supabaseServer` from `src/lib/supabase/server.ts`; `Lane` from `src/lib/types.ts`.
- Produces:
  - `interface PrioritiesBoard { slug: string; name: string; }`
  - `interface ProjectPrioritiesData { project: { id: string; slug: string; name: string; settings: Record<string, unknown> }; boards: PrioritiesBoard[]; cards: PriorityCard[]; }`
  - `assemblePriorityCards(boards, lanes, cards): PriorityCard[]` (pure; row types below)
  - `loadProjectPriorities(projectSlug: string, boardSlug?: string): Promise<ProjectPrioritiesData>` — `boardSlug` narrows to one board (the board-level page); boards list always covers the whole project so the board page can link across.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "bun:test";
import { assemblePriorityCards } from "./priorities-data";

const boards = [{ id: "b1", slug: "dev", name: "Dev", settings: null }];
const lanes = [
  { id: "l-now", board_id: "b1", key: "now", name: "Now", position: 1, kind: "work" as const, sla_days: null, wip_limit: null, color: null },
  { id: "l-done", board_id: "b1", key: "done", name: "Done", position: 8, kind: "done" as const, sla_days: null, wip_limit: null, color: null },
  { id: "l-arch", board_id: "b1", key: "archive", name: "Archive", position: 9, kind: "archive" as const, sla_days: null, wip_limit: null, color: null },
];

function row(over: Record<string, unknown>) {
  return {
    id: "c1",
    board_id: "b1",
    external_id: "1",
    title: "A card",
    status: "backlog",
    epic: null,
    effort: null,
    priority: null,
    priority_rank: null,
    lane_id: "l-now",
    rank: 1,
    archived_at: null,
    ...over,
  };
}

describe("assemblePriorityCards", () => {
  test("keeps a live work-lane card and attaches lane and board fields", () => {
    const out = assemblePriorityCards(boards, lanes, [row({})]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      lane_name: "Now",
      lane_position: 1,
      lane_rank: 1,
      board_slug: "dev",
      board_name: "Dev",
    });
  });

  test("drops archived cards, archive-kind lanes, and shipped-gate hits", () => {
    const out = assemblePriorityCards(boards, lanes, [
      row({ id: "a", archived_at: "2026-09-01T00:00:00Z" }),
      row({ id: "b", lane_id: "l-arch" }),
      row({ id: "c", lane_id: "l-done" }), // default shipped gate: done-kind lane
      row({ id: "d", status: "shipped" }), // default shipped gate: status
      row({ id: "e", status: "done" }), // default shipped gate: status
      row({ id: "f" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["f"]);
  });

  test("drops a card whose board or lane is unknown", () => {
    const out = assemblePriorityCards(boards, lanes, [
      row({ id: "a", board_id: "nope" }),
      row({ id: "b", lane_id: null }),
    ]);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/priorities-data.test.ts`
Expected: FAIL — `Cannot find module './priorities-data'`.

- [ ] **Step 3: Implement**

```ts
import { notFound } from "next/navigation";
import { gateOutcomeSets, resolveBoardGates } from "./gates";
import type { PriorityCard } from "./priorities";
import { supabaseServer } from "./supabase/server";
import type { Lane } from "./types";

/** Board identity for the project-level board chips. */
export interface PrioritiesBoard {
  slug: string;
  name: string;
}

/** Priorities page payload, board- or project-scoped. */
export interface ProjectPrioritiesData {
  project: {
    id: string;
    slug: string;
    name: string;
    settings: Record<string, unknown>;
  };
  boards: PrioritiesBoard[];
  cards: PriorityCard[];
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

type CardRow = {
  id: string;
  board_id: string;
  external_id: string;
  title: string;
  status: string;
  epic: string | null;
  effort: "L" | "M" | "H" | null;
  priority: 1 | 2 | 3 | null;
  priority_rank: number | null;
  lane_id: string | null;
  rank: number;
  archived_at: string | null;
};

/**
 * Live planning cards with lane and board fields attached. Finished work is
 * out: archived cards, archive-kind lanes, and anything a board's "shipped"
 * gate claims (the `shipped` lane is kind `work`, so gates are the
 * authority, exactly as the calendar and timeline treat delivery).
 */
export function assemblePriorityCards(
  boards: readonly BoardRow[],
  lanes: readonly LaneRow[],
  cards: readonly CardRow[],
): PriorityCard[] {
  const boardById = new Map(boards.map((board) => [board.id, board]));
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const lanesByBoard = new Map<string, LaneRow[]>();
  for (const lane of lanes) {
    const list = lanesByBoard.get(lane.board_id) ?? [];
    list.push(lane);
    lanesByBoard.set(lane.board_id, list);
  }
  const shippedByBoard = new Map(
    boards.map((board) => [
      board.id,
      gateOutcomeSets(
        resolveBoardGates(board.settings ?? {}, lanesByBoard.get(board.id) ?? []),
      ).shipped,
    ]),
  );
  const out: PriorityCard[] = [];
  for (const card of cards) {
    if (card.archived_at) continue;
    const board = boardById.get(card.board_id);
    const lane = card.lane_id ? laneById.get(card.lane_id) : undefined;
    if (!board || !lane) continue;
    if (lane.kind === "archive") continue;
    const shipped = shippedByBoard.get(card.board_id);
    if (shipped?.laneIds.has(lane.id) || shipped?.statuses.has(card.status))
      continue;
    out.push({
      id: card.id,
      external_id: card.external_id,
      title: card.title,
      epic: card.epic,
      status: card.status,
      effort: card.effort,
      priority: card.priority,
      priority_rank: card.priority_rank,
      lane_name: lane.name,
      lane_position: lane.position,
      lane_rank: card.rank,
      board_slug: board.slug,
      board_name: board.name,
    });
  }
  return out;
}

/**
 * Planning cards for a project, or one board of it. RLS scopes the read.
 *
 * @param projectSlug - Project URL slug.
 * @param boardSlug - When set, cards come from this board only; the boards
 *   list still spans the project so the page can link across.
 */
export async function loadProjectPriorities(
  projectSlug: string,
  boardSlug?: string,
): Promise<ProjectPrioritiesData> {
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
  const scope = boardSlug
    ? boardRows.filter((board) => board.slug === boardSlug)
    : boardRows;
  if (boardSlug && scope.length === 0) notFound();
  const ids = scope.map((board) => board.id);

  const projectShape = {
    ...project,
    settings: (project.settings ?? {}) as Record<string, unknown>,
  };
  const boardsShape = boardRows.map((board) => ({
    slug: board.slug,
    name: board.name,
  }));
  if (ids.length === 0)
    return { project: projectShape, boards: boardsShape, cards: [] };

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
        "id, board_id, external_id, title, status, epic, effort, priority, priority_rank, lane_id, rank, archived_at",
      )
      .in("board_id", ids),
  ]);

  return {
    project: projectShape,
    boards: boardsShape,
    cards: assemblePriorityCards(
      scope,
      (lanes ?? []) as LaneRow[],
      (cards ?? []) as CardRow[],
    ),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/priorities-data.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
bunx biome check src/lib/priorities-data.ts src/lib/priorities-data.test.ts
bunx tsc --noEmit
git add src/lib/priorities-data.ts src/lib/priorities-data.test.ts
git commit -m "feat(#9): planning-card loader with shipped-gate exclusions"
```

---

### Task 4: `prioritizeCard` server action

**Files:**
- Modify: `src/app/p/[project]/b/[board]/actions.ts` — add one export directly after `moveCard` (ends near line 481). `needsNormalize` and `normalized` are already imported at the top of the file.

**Interfaces:**
- Consumes: `ctx()`, `Result`, `needsNormalize`, `normalized` — all already in the file.
- Produces: `prioritizeCard(cardId: string, priority: 1 | 2 | 3 | null, priorityRank: number | null, orderedIds?: string[]): Promise<Result>`; `Result` is the file's existing `{ ok: true } | { ok: false; error: string }`.

- [ ] **Step 1: Add the action**

```ts
/**
 * Weigh a card on the priorities planning screen: `priority` is the band,
 * `priority_rank` the stakeholder-importance ordering (distinct from lane
 * `rank`, which is execution order). Null priority unweighs and clears the
 * rank. When the client names the band's order, the band renormalises if
 * any member is unranked or the fractional gaps have gotten too tight.
 */
export async function prioritizeCard(
  cardId: string,
  priority: 1 | 2 | 3 | null,
  priorityRank: number | null,
  orderedIds?: string[],
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  if (priority != null && !([1, 2, 3] as const).includes(priority))
    return { ok: false, error: "Invalid priority." };
  const patch =
    priority == null
      ? { priority: null, priority_rank: null }
      : { priority, priority_rank: priorityRank };
  const { error } = await c.db.from("cards").update(patch).eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "edited",
    payload: patch,
  });
  if (priority != null && orderedIds?.length) {
    const { data: band } = await c.db
      .from("cards")
      .select("id, priority_rank")
      .in("id", orderedIds);
    const ranks = (band ?? []).map((x) => x.priority_rank);
    if (ranks.some((r) => r == null) || needsNormalize(ranks as number[])) {
      const next = normalized(orderedIds);
      await Promise.all(
        [...next].map(([id, r]) =>
          c.db.from("cards").update({ priority_rank: r }).eq("id", id),
        ),
      );
    }
  }
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check "src/app/p/[project]/b/[board]/actions.ts"`
Expected: clean. (No unit test — actions need a live DB session; Task 8 exercises this path in the browser.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/p/[project]/b/[board]/actions.ts"
git commit -m "feat(#9): prioritizeCard action writes priority and priority_rank"
```

---

### Task 5: Priorities view component

**Files:**
- Create: `src/components/priorities/priorities-view.tsx`

**Interfaces:**
- Consumes: `partitionBands`, `rankForDrop`, `PriorityCard` (Task 2); `prioritizeCard` (Task 4); `PrioritiesBoard` (Task 3); `PRIORITY_PEN`, `EFFORT_PEN` from `src/lib/types.ts`.
- Produces: `PrioritiesView` (named export), props:
  `{ projectSlug: string; projectName: string; boardSlug: string | null; boards: PrioritiesBoard[]; selectedBoards: string[] | null; cards: PriorityCard[]; path: string; }`
  (`boardSlug` null at project level; `selectedBoards`/`path` drive the project-level board chips through the URL, `CalendarView`-style.)

**Before starting: invoke the `cardstock-design` skill.** Match the app's paper look (classes `paper-well`, `paper-card`, `paper-link`, `paper-lane--over`, `sq`/`sq--on`/`sq--red|blue|violet|green|amber`, `stat`, `lane-name`, `epic-label`, `eyebrow`, token `--surface-postit` — all exist in `src/styles/components/paper.css`). The layout is the prototype's "The Jar v3": bands at 100%/78%/56% width, tilted post-its on the desk.

- [ ] **Step 1: Implement the component**

Structure (client component, `"use client"`):

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { prioritizeCard } from "@/app/p/[project]/b/[board]/actions";
import {
  partitionBands,
  type PriorityCard,
  rankForDrop,
} from "@/lib/priorities";
import type { PrioritiesBoard } from "@/lib/priorities-data";
import { EFFORT_PEN, PRIORITY_PEN } from "@/lib/types";

const STONE_CAP = 6;
const BAND_LABEL: Record<1 | 2 | 3, string> = {
  1: "Stones",
  2: "Pebbles",
  3: "Sand",
};
const BAND_WIDTH: Record<1 | 2 | 3, string> = { 1: "100%", 2: "78%", 3: "56%" };
const TILTS = ["-1.6deg", "1.1deg", "-0.7deg", "1.8deg", "-1.2deg", "0.6deg"];

export interface PrioritiesViewProps {
  projectSlug: string;
  projectName: string;
  boardSlug: string | null;
  boards: PrioritiesBoard[];
  selectedBoards: string[] | null;
  cards: PriorityCard[];
  path: string;
}

export function PrioritiesView(props: PrioritiesViewProps) { /* … */ }
```

Behavior requirements (the implementer writes the JSX following "The Jar v3", adapted to app classes — every requirement below must hold):

1. `partitionBands(props.cards)` memoized on `props.cards`; at project level with `selectedBoards`, filter cards to those boards **before** partitioning.
2. Header: title "The jar", counts line (`N stones · N pebbles · N sand · N unweighed` — unweighed count in `--pen-red` when > 0), and the sibling-views nav (rendered by the pages, Task 6 — the component itself starts at the intro).
3. Intro block (rendered copy only):
   - Lead line, display italic: "Stones first, then pebbles, then sand."
   - Body: "The professor fills the jar with big stones and asks if it's full. Then the pebbles rattle into the gaps, then the sand, then the water. Start with the water and nothing else fits — so the big stuff goes in first, and the small stuff finds its room. Weigh what matters most: P1 is red alert."
4. Three bands: header row per band with a `sq sq--on ${PRIORITY_PEN[p]}` chip reading `P{p}`, the band label, a 2px bottom border in the band's pen color, and the count (P1 shows `{n} · room for {max(0, STONE_CAP - n)}` instead). Band card rows narrow by `BAND_WIDTH`, centered; P1 rows largest type (17px), P3 smallest (13px, single-line ellipsis). Each row shows: display index (1-based across P1→P2→P3 concatenated), `#external_id`, title as a `Link` to `/p/{projectSlug}/b/{board_slug}/c/{external_id}`, then right-aligned: epic (`epic-label`, P1 band only), lane name (`stat stat--faint`), board name chip at project level, effort square (`sq sq--on ${EFFORT_PEN[effort]}`) when set.
5. Drag & drop, HTML5 like the prototype: `draggable` rows; band containers and the desk are drop targets; a drop indicator line shows at the hover position; `paper-lane--over` on the hovered container. On drop at position `index` of band `p` (dragged card removed from the band array first): compute `rank = rankForDrop(bandWithoutDragged, index)`, build `orderedIds` as the band's ids in new display order, call `prioritizeCard(id, p, rank, orderedIds)` inside `useTransition`, then `router.refresh()`. Optimistically render the new order from local state while the transition is pending. Drop on a band's empty space appends at the end. Drop on the desk calls `prioritizeCard(id, null, null)`.
6. Unweighed desk: dashed-top section titled "Unweighed" with the copy "Not in the jar, so the priority filter cannot find them. Drag one in; drag a sheet out here to unweigh it." Cards render as 176px post-its (`background: var(--surface-postit)`, `rotate: TILTS[i % TILTS.length]`, `shadow`), showing `#id`, title, lane name — also draggable, also links.
7. Empty states: P1 empty → "No stones yet. Whatever goes in first sets the shape of everything after it." Desk empty → "Everything has a weight."
8. Project level (`boardSlug === null`): board chips row (each board name; clicking toggles it in the `boards` search param on `props.path`, matching `CalendarView`'s chips) and the board-name chip on every card row.

- [ ] **Step 2: Typecheck and lint**

Run: `bunx tsc --noEmit && bunx biome check src/components/priorities/priorities-view.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/priorities/priorities-view.tsx
git commit -m "feat(#9): priorities planning view - bands, desk, drag to weigh"
```

---

### Task 6: Pages

**Files:**
- Create: `src/app/p/[project]/priorities/page.tsx`
- Create: `src/app/p/[project]/b/[board]/priorities/page.tsx`

**Interfaces:**
- Consumes: `loadProjectPriorities` (Task 3), `PrioritiesView` (Task 5), `currentMember` from `src/lib/supabase/server.ts`, `calendarBoards` from `src/lib/calendar.ts` (parses the `boards` search param; reuse it verbatim).

- [ ] **Step 1: Project-level page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PrioritiesView } from "@/components/priorities/priorities-view";
import { calendarBoards } from "@/lib/calendar";
import { loadProjectPriorities } from "@/lib/priorities-data";
import { currentMember } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Priorities" };

/** Project-wide priority planning across all boards; board chips filter. */
export default async function ProjectPrioritiesPage(
  props: PageProps<"/p/[project]/priorities">,
) {
  const { project } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadProjectPriorities(project);
  const search = await props.searchParams;
  const selected = calendarBoards(
    search.boards,
    data.boards.map((board) => board.slug),
  );
  return (
    <main className="mx-auto w-full max-w-[var(--page-max)] px-4 pt-5 pb-16 sm:px-6">
      <Link
        href={`/p/${project}`}
        className="mb-4 inline-block text-xs text-muted-foreground hover:underline"
      >
        ← {data.project.name}
      </Link>
      <PrioritiesView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={null}
        boards={data.boards}
        selectedBoards={selected}
        cards={data.cards}
        path={`/p/${project}/priorities`}
      />
    </main>
  );
}
```

(Adjust the `calendarBoards` import path if `tsc` says it lives elsewhere — it is the helper the project calendar page imports from `@/lib/calendar`. If its signature does not fit, parse `search.boards` inline the same way that page does.)

- [ ] **Step 2: Board-level page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PrioritiesView } from "@/components/priorities/priorities-view";
import { loadProjectPriorities } from "@/lib/priorities-data";
import { currentMember } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Priorities" };

/** One board's slice of the project's priority ordering. */
export default async function BoardPrioritiesPage(
  props: PageProps<"/p/[project]/b/[board]/priorities">,
) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadProjectPriorities(project, board);
  return (
    <main className="mx-auto w-full max-w-[var(--page-max)] px-4 pt-5 pb-16 sm:px-6">
      <Link
        href={`/p/${project}/b/${board}`}
        className="mb-4 inline-block text-xs text-muted-foreground hover:underline"
      >
        ← Board
      </Link>
      <PrioritiesView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={board}
        boards={data.boards}
        selectedBoards={null}
        cards={data.cards}
        path={`/p/${project}/b/${board}/priorities`}
      />
    </main>
  );
}
```

- [ ] **Step 3: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx biome check "src/app/p/[project]/priorities/page.tsx" "src/app/p/[project]/b/[board]/priorities/page.tsx"
git add "src/app/p/[project]/priorities" "src/app/p/[project]/b/[board]/priorities"
git commit -m "feat(#9): priorities pages at project and board level"
```

---

### Task 7: Nav links

**Files (add a "Priorities" `paper-link` to each hand-rolled view nav, matching each row's existing markup):**
- Modify: `src/components/board/board-view.tsx` (~line 728: nav with Epic Cockpit / Calendar / Timeline / Manage — insert Priorities before Manage, href `` `/p/${data.project.slug}/b/${data.board.slug}/priorities` ``)
- Modify: `src/app/p/[project]/b/[board]/timeline/page.tsx` (~line 223: links row — add `` <Link className="paper-link" href={`${back}/priorities`}>Priorities</Link> ``)
- Modify: `src/app/p/[project]/b/[board]/cockpit/page.tsx` (~line 44: add the same with `boardBase`)
- Modify: `src/components/calendar/calendar-view.tsx` (~line 492: board-level links use `boardBase`; add Priorities. When `boardBase` is absent at project level, link `` `/p/${projectSlug}/priorities` `` alongside the existing project-level links if that branch renders any)
- Modify: `src/app/p/[project]/b/[board]/manage/page.tsx` (~line 79: add with `boardHref`)
- Modify: `src/components/cockpit/epic-detail.tsx` (~line 98: add with `boardHref`)
- Modify: `src/app/p/[project]/page.tsx` (~line 164: project row already links Calendar with `${href}/calendar`; add `` <Link className="paper-link" href={`${href}/priorities`}>Priorities</Link> ``)

- [ ] **Step 1: Add the links** — read each site first; copy the neighboring link's exact element shape (`<a>` vs `<Link>`, class, text style). Label is always `Priorities`.

- [ ] **Step 2: Typecheck, lint, commit**

```bash
bunx tsc --noEmit && bunx biome check src/components/board/board-view.tsx src/components/calendar/calendar-view.tsx src/components/cockpit/epic-detail.tsx "src/app/p/[project]/page.tsx" "src/app/p/[project]/b/[board]/timeline/page.tsx" "src/app/p/[project]/b/[board]/cockpit/page.tsx" "src/app/p/[project]/b/[board]/manage/page.tsx"
git add src/components/board/board-view.tsx src/components/calendar/calendar-view.tsx src/components/cockpit/epic-detail.tsx "src/app/p/[project]/page.tsx" "src/app/p/[project]/b/[board]/timeline/page.tsx" "src/app/p/[project]/b/[board]/cockpit/page.tsx" "src/app/p/[project]/b/[board]/manage/page.tsx"
git commit -m "feat(#9): Priorities in every view nav, board and project level"
```

---

### Task 8: Browser verification and tracker update

No code. Run the app against the **local** stack (`bun run dev`; `bun run db:start` if down) and verify with a real browser session:

- [ ] **Step 1: Full test + check pass** — `bun test && bun run check`. All green before touching the browser.
- [ ] **Step 2: Exercise the board page** — open `/p/<project>/b/<board>/priorities`: bands render, unweighed desk lists priority-less cards, drag a post-it into P1 (card gets `priority: 1`, appears in band, count updates after refresh), drag between bands, reorder within a band, drag a band card to the desk (priority cleared). Reload after each drag: order persists.
- [ ] **Step 3: Exercise the project page** — open `/p/<project>/priorities`: multiple boards' cards interleave; board chips filter; a drag here changes the same ordering the board page shows.
- [ ] **Step 4: Confirm sync blindness** — run `py -3 backlog/sync.py --hosted --check`: no new pending changes caused by `priority_rank` (the column is unmapped). **Note:** dragging cards on the LOCAL stack does not touch prod; if verification was done against hosted data instead, expect legitimate `priority` changes and do not sync them up without the operator.
- [ ] **Step 5: Verify shipped/done/archived cards are absent** from both pages.
- [ ] **Step 6: Tracker Phase 3** (cardstock-task-loop): #9's `body-owner=app` — write the Status update **on the card page** (cite the commits), not in the file body. In `backlog/tracker/9.md` set frontmatter only: `status: built`, `lane: building`. Then `py -3 backlog/validate_tracker.py` (0 problems), `py -3 backlog/sync.py --hosted` (converged), commit tracker files by name.
- [ ] **Step 7: Remind the operator** that shipping needs the migration applied to the hosted database (`supabase db push` or their deploy pipeline) before the Vercel deploy is exercised, and that Shipped/Done lane moves are theirs to approve.
