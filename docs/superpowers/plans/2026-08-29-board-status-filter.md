# Board Status Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the board filter bar restrict cards by tracker `status`, with options collected from this board’s cards — empty selection means every status.

**Architecture:** `Filters.status` is a `Set<string>` with the same empty-means-all rule as priority and effort. `boardStatuses` collects unique trimmed values from the loaded cards. `statusChipClass` is the shared `.stat` pen map so the filter chips and the card face cannot drift. `FilterBar` renders a Status fieldset between Effort and Also show; `matches` is the only gate.

**Tech Stack:** Existing board client (`FilterBar`, `BoardView`) · `src/lib/filters.ts` · bun test · Playwright against `/p/demo/b/backlog` · paper `.stat` pens already in `src/styles/components/paper.css`.

**Spec:** `docs/superpowers/specs/2026-08-29-board-status-filter-design.md`

## Global Constraints

- Options come from this board’s cards. Do not import `STATUSES` from `etl/schema.ts` as the filter list.
- Empty `Filters.status` = no status restriction. Non-empty = OR: keep the card if `f.status.has(card.status)`.
- Show the raw status word (`wip` stays `wip`). No display-name map.
- Also show stays Internal and Archived only. Status is its own fieldset, between Effort and Also show.
- Not a preference. Do not write `status` into `savePrefs`. CSV export query string stays unchanged.
- Do not auto-prune selected values that leave the board. Stale chips just match nothing until Clear or a toggle.
- No new theme tokens, radii, or filled pills. Status stays `.stat`.
- JSDoc on every exported function.
- Commit messages: `feat: …` / `docs: …`, short.
- Only touch files listed in this plan. The working tree has unrelated dirty files — leave them alone.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/filters.ts` | `Filters.status`, `emptyFilters`, `isFiltering`, `matches`, `boardStatuses` |
| `src/lib/filters.test.ts` | bun tests for collection + matching |
| `src/lib/card-status.ts` | `statusChipClass(status)` — shared pen map |
| `src/lib/card-status.test.ts` | bun tests for known / unknown statuses |
| `src/components/board/card-item.tsx` | Use `statusChipClass` instead of a private map |
| `src/components/board/filter-bar.tsx` | Status fieldset; Clear resets `status` |
| `src/components/board/board-view.tsx` | Pass `boardStatuses(cards)` into `FilterBar` |
| `docs/board-cards.md` | One sentence that the bar can restrict by that word |
| `e2e/board.spec.ts` | Sibling of the P1 filter test, for `wip` |

---

### Task 1: Filter model — collect and match

**Files:**
- Modify: `src/lib/filters.ts`
- Test: `src/lib/filters.test.ts`

**Interfaces:**
- Consumes: `Card`, `Lane`, `TagGroup` from `./types` (already imported)
- Produces: `Filters.status: Set<string>`; `emptyFilters` includes `status: new Set()`; `isFiltering` is true when `status.size > 0`; `boardStatuses(cards: ReadonlyArray<{ status?: string | null }>): string[]`; `matches` rejects when the set is non-empty and `card.status` is not in it

- [ ] **Step 1: Write the failing tests**

Keep the existing `sortInbox` describe and its `card` helper (id + raised date only). Name the full `Card` factory `task` so the two do not clash. Add this below the current imports, replacing the `sortInbox`-only import line:

```ts
import { describe, expect, test } from "bun:test";
import {
  boardStatuses,
  emptyFilters,
  isFiltering,
  matches,
  sortInbox,
} from "./filters";
import type { Card, Lane, TagGroup } from "./types";
```

Append these describes after the `sortInbox` block. Do not rewrite the inbox tests.

```ts
const work: Lane = {
  id: "work",
  key: "work",
  name: "Now",
  kind: "work",
  position: 0,
  sla_days: null,
  wip_limit: null,
};

const task = (patch: Partial<Card> = {}): Card => ({
  id: "c1",
  external_id: "1",
  title: "Task",
  summary: null,
  status: "backlog",
  epic: null,
  epic_id: null,
  area: null,
  raised_by: null,
  raised_on: null,
  shipped_on: null,
  needs: null,
  lane_id: "work",
  rank: 1,
  priority: null,
  effort: null,
  planned_start_date: null,
  target_date: null,
  target_label: null,
  audience: "all",
  archived_at: null,
  archived_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  tag_ids: [],
  lane_entered_at: null,
  color: null,
  ...patch,
});

describe("boardStatuses", () => {
  test("unique, sorted, blanks dropped, order independent of input", () => {
    expect(
      boardStatuses([
        { status: "wip" },
        { status: "  " },
        { status: "backlog" },
        { status: "wip" },
        { status: null },
        { status: " blocked " },
        {},
      ]),
    ).toEqual(["backlog", "blocked", "wip"]);
  });
});

describe("status filter", () => {
  const lanes = [work];
  const groups: TagGroup[] = [];

  test("emptyFilters is not filtering and has an empty status set", () => {
    const f = emptyFilters();
    expect(f.status.size).toBe(0);
    expect(isFiltering(f)).toBe(false);
  });

  test("a selected status counts as filtering", () => {
    const f = emptyFilters();
    f.status.add("wip");
    expect(isFiltering(f)).toBe(true);
  });

  test("empty set keeps every status", () => {
    const f = emptyFilters();
    expect(matches(task({ status: "wip" }), f, groups, lanes)).toBe(true);
    expect(matches(task({ status: "backlog" }), f, groups, lanes)).toBe(true);
  });

  test("one status keeps only that value", () => {
    const f = emptyFilters();
    f.status.add("wip");
    expect(matches(task({ status: "wip" }), f, groups, lanes)).toBe(true);
    expect(matches(task({ status: "blocked" }), f, groups, lanes)).toBe(false);
  });

  test("two statuses OR", () => {
    const f = emptyFilters();
    f.status.add("wip");
    f.status.add("blocked");
    expect(matches(task({ status: "wip" }), f, groups, lanes)).toBe(true);
    expect(matches(task({ status: "blocked" }), f, groups, lanes)).toBe(true);
    expect(matches(task({ status: "done" }), f, groups, lanes)).toBe(false);
  });

  test("status still combines with priority", () => {
    const f = emptyFilters();
    f.status.add("wip");
    f.priority.add(1);
    expect(
      matches(task({ status: "wip", priority: 1 }), f, groups, lanes),
    ).toBe(true);
    expect(
      matches(task({ status: "wip", priority: 2 }), f, groups, lanes),
    ).toBe(false);
    expect(
      matches(task({ status: "backlog", priority: 1 }), f, groups, lanes),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/filters.test.ts`

Expected: FAIL — `boardStatuses` is not exported, and `f.status` is undefined.

- [ ] **Step 3: Implement the model**

In `src/lib/filters.ts`:

1. Add `status: Set<string>` to `Filters` (after `effort`, before `showInternal`).
2. In `emptyFilters`, add `status: new Set()`.
3. In `isFiltering`, add `|| f.status.size > 0` (before `f.showArchived` is fine).
4. In `matches`, after the effort check and before the tag loop:

```ts
  if (f.status.size && !f.status.has(card.status)) return false;
```

5. Export `boardStatuses` above `matches` (or immediately after `isFiltering`):

```ts
/**
 * Distinct tracker statuses present on this board, for the filter bar.
 * Blanks are dropped; order is sorted so the row is stable across reloads.
 */
export function boardStatuses(
  cards: ReadonlyArray<{ status?: string | null }>,
): string[] {
  const seen = new Set<string>();
  for (const card of cards) {
    const status = card.status?.trim();
    if (status) seen.add(status);
  }
  return [...seen].sort();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/filters.test.ts`

Expected: PASS (all `sortInbox`, `boardStatuses`, and `status filter` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/filters.ts src/lib/filters.test.ts
git commit -m "feat: filter cards by collected board statuses"
```

---

### Task 2: Shared status pen class

**Files:**
- Create: `src/lib/card-status.ts`
- Test: `src/lib/card-status.test.ts`
- Modify: `src/components/board/card-item.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `statusChipClass(status: string): string` — known keys `wip` → `stat stat--wip`, `built`/`handed` → `stat stat--info`, `held`/`backlog` → `stat stat--muted`, `blocked` → `stat stat--blocked`, `shipped`/`done` → `stat stat--success`; anything else → `stat stat--muted`

- [ ] **Step 1: Write the failing test**

Create `src/lib/card-status.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { statusChipClass } from "./card-status";

describe("statusChipClass", () => {
  test("maps the tracker vocabulary to paper pens", () => {
    expect(statusChipClass("wip")).toBe("stat stat--wip");
    expect(statusChipClass("blocked")).toBe("stat stat--blocked");
    expect(statusChipClass("built")).toBe("stat stat--info");
    expect(statusChipClass("handed")).toBe("stat stat--info");
    expect(statusChipClass("shipped")).toBe("stat stat--success");
    expect(statusChipClass("done")).toBe("stat stat--success");
    expect(statusChipClass("held")).toBe("stat stat--muted");
    expect(statusChipClass("backlog")).toBe("stat stat--muted");
  });

  test("unknown values stay muted", () => {
    expect(statusChipClass("mystery")).toBe("stat stat--muted");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/card-status.test.ts`

Expected: FAIL — `./card-status` does not exist.

- [ ] **Step 3: Implement the helper and switch the card face**

Create `src/lib/card-status.ts`:

```ts
const STATUS_CHIP: Record<string, string> = {
  wip: "stat stat--wip",
  built: "stat stat--info",
  handed: "stat stat--info",
  held: "stat stat--muted",
  blocked: "stat stat--blocked",
  shipped: "stat stat--success",
  done: "stat stat--success",
  backlog: "stat stat--muted",
};

/**
 * Class list for a status word — same pens on the card and in the filter bar.
 */
export function statusChipClass(status: string): string {
  return STATUS_CHIP[status] ?? "stat stat--muted";
}
```

In `src/components/board/card-item.tsx`:

- Add `import { statusChipClass } from "@/lib/card-status";`
- Delete the private `STATUS_CHIP` constant.
- Replace both `STATUS_CHIP[card.status] ?? "stat stat--muted"` with `statusChipClass(card.status)` (resting face ~line 177 and peek ~line 214).

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/card-status.test.ts src/lib/filters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-status.ts src/lib/card-status.test.ts src/components/board/card-item.tsx
git commit -m "feat: share status pen classes between card and filters"
```

---

### Task 3: Filter bar Status fieldset

**Files:**
- Modify: `src/components/board/filter-bar.tsx`
- Modify: `src/components/board/board-view.tsx`

**Interfaces:**
- Consumes: `Filters.status` and `boardStatuses` from Task 1; `statusChipClass` from Task 2
- Produces: `FilterBar` prop `statuses: string[]`; Status fieldset (legend `Status`) between Effort and Also show when `statuses.length > 0`; each option is `<button type="button" aria-pressed>` whose accessible name is the raw status; idle class `stat stat--muted`, pressed class `statusChipClass(status)`; Clear sets `status: new Set()`

- [ ] **Step 1: Wire FilterBar**

In `src/components/board/filter-bar.tsx`:

1. Add `import { statusChipClass } from "@/lib/card-status";`
2. Add `statuses: string[]` to the `FilterBar` props (after `groups`).
3. Insert this fieldset **after** the Effort fieldset and **before** the Also show fieldset:

```tsx
      {props.statuses.length > 0 && (
        <fieldset className="fieldset">
          <legend>Status</legend>
          {props.statuses.map((status) => {
            const on = f.status.has(status);
            return (
              <button
                key={status}
                type="button"
                aria-pressed={on}
                className={on ? statusChipClass(status) : "stat stat--muted"}
                onClick={() =>
                  onChange({ ...f, status: toggle(f.status, status) })
                }
              >
                {status}
              </button>
            );
          })}
        </fieldset>
      )}
```

4. In the Clear filters `onClick`, add `status: new Set()` next to the other emptied sets (`query`, `tags`, `priority`, `effort`, `showArchived`). Do not reset `showInternal`.

Do not put status chips inside Also show. Do not prune `f.status` when a value leaves `props.statuses`.

- [ ] **Step 2: Pass collected statuses from the board**

In `src/components/board/board-view.tsx`:

1. Add `boardStatuses` to the import from `@/lib/filters` (alongside `emptyFilters`, `matches`, `isFiltering`, `sortInbox`).
2. On `<FilterBar`, add `statuses={boardStatuses(cards)}` — `cards` is the live state, not `data.cards`, so a newly created or imported card can offer a new chip without a full reload.

- [ ] **Step 3: Confirm the two files typecheck**

Run: `bun test src/lib/filters.test.ts src/lib/card-status.test.ts`

Expected: PASS. `FilterBar` now requires `statuses` — `board-view.tsx` must pass `boardStatuses(cards)` or TypeScript fails on that prop.

- [ ] **Step 4: Commit**

```bash
git add src/components/board/filter-bar.tsx src/components/board/board-view.tsx
git commit -m "feat: status chips on the board filter bar"
```

---

### Task 4: e2e and docs

**Files:**
- Modify: `e2e/board.spec.ts`
- Modify: `docs/board-cards.md`

**Interfaces:**
- Consumes: Status button `wip` inside `#filters` from Task 3; demo tracker card `examples/tracker/6.md` is `status: wip` among mostly `backlog`
- Produces: Playwright coverage that picking `wip` narrows the board and Clear restores; docs sentence on the filter bar

- [ ] **Step 1: Extend the existing filter e2e**

In `e2e/board.spec.ts`, immediately after the test `"filters: search narrows, P1 chip filters, clear restores"`, add:

```ts
test("filters: status chip narrows, clear restores", async ({ page }) => {
  const total = await page.locator("article:visible").count();
  await page
    .locator("#filters")
    .getByRole("button", { name: "wip", exact: true })
    .click();
  const wip = await page.locator("article:visible").count();
  expect(wip).toBeGreaterThan(0);
  expect(wip).toBeLessThan(total);
  await page.getByRole("button", { name: "Clear" }).click();
  expect(await page.locator("article:visible").count()).toBe(total);
});
```

Do not change the P1 test. Scope the click to `#filters` so a card-face `wip` span is not targeted — the filter control is the button.

- [ ] **Step 2: Run the filter tests**

Run: `bun run test:e2e e2e/board.spec.ts`

Expected: the new test PASS. If `wip` is missing, the demo board was not imported from `examples/tracker` — do not hardcode a fallback list; fix the environment, not the product.

- [ ] **Step 3: Document the bar**

In `docs/board-cards.md`, after the first sentence of the opening paragraph (the one that ends with the status word when it is not `backlog`), add:

`The filter bar can restrict by that same word: a Status cluster lists whatever values this board actually has; nothing selected means every status.`

Keep the rest of the file as it is. Do not edit `docs/paper.md` (no token contract change).

- [ ] **Step 4: Commit**

```bash
git add e2e/board.spec.ts docs/board-cards.md
git commit -m "docs: status filter on the board bar"
```

---

## Spec coverage

| Spec decision | Task |
|---|---|
| Empty set = all; non-empty OR | Task 1 `matches` |
| Own Status fieldset, not Also show | Task 3 |
| Collect unique statuses from loaded cards, including archived/internal | Task 1 `boardStatuses` + Task 3 `boardStatuses(cards)` |
| Sorted, blanks dropped | Task 1 |
| Raw labels | Task 3 `{status}` |
| Omit fieldset when nothing to collect | Task 3 `statuses.length > 0` |
| Not a preference; Clear empties the set | Task 3 |
| CSV URL unchanged | Global constraint — no task |
| Shared `.stat` pens | Task 2 |
| Do not auto-prune stale selections | Task 3 (explicit non-action) |
| bun tests | Tasks 1–2 |
| e2e on demo `wip` | Task 4 |
| `docs/board-cards.md` | Task 4 |
