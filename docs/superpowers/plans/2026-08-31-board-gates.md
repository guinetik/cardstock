# Board Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each board name ordered status/lane gates so the timeline shows a milestone (right-hand word) and a calendar diagnostic (quiet date line) without hardcoding one project's vocabulary.

**Architecture:** `src/lib/gates.ts` owns resolve, match, defaults, and save validation. `timeline.ts` calls it for Delivered, milestones, and pulse headings. Gates live in `boards.settings.gates`. The project page edits the effective list; the rail prints the matching gate and prefixes Planned / Forgotten / Overdue / Delivered onto the date line.

**Tech Stack:** Existing Next.js server actions · bun test · Playwright against `/p/demo` · paper field chrome already on the project page.

**Spec:** `docs/superpowers/specs/2026-08-31-board-gates-design.md`

## Global Constraints

- Two axes: gate = milestone; Planned / Forgotten / Overdue / Open / Delivered = diagnostic. Never style them as one workflow status.
- `boards.settings.gates` ordered array. No `board_gates` table. No migration.
- First match wins. OR on status vs lane. Empty side ignored. Both empty matches nothing.
- Missing or malformed `gates` synthesizes Shipped then Built defaults. Saved `[]` means no gates.
- After a valid saved `gates` array, ignore `timeline_built_statuses` / `timeline_shipped_statuses`. Do not delete those keys. Do not write them from the editor.
- Delivered = `shipped_on` or matching a `shipped`-outcome gate. Do not special-case raw `done`/`shipped` or `kind=done` once gates are resolved.
- Right-hand word is the gate name in ink, or omitted. Diagnostic sits on the date line and keeps today's colours (dot + that line). Hide the tracker status chip when a gate matches.
- No Staffeto names in code (`Awaiting delivery` appears only in the e2e that types it).
- Cockpit, markdown import/export, lane-kind board behaviour, and the forgotten-window project setting stay as they are.
- JSDoc on every exported function. No new CSS tokens.
- Commit messages: `feat: …` / `docs: …` / `test: …`, short.
- Only touch files listed in this plan. Leave unrelated dirty files alone.
- Before writing any Next.js code (Tasks 3–4), skim `node_modules/next/dist/docs/` for server actions and forms if the local Next docs are present.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/gates.ts` | `BoardGate`, resolve, match, defaults, outcome sets, pulse heading, save validation |
| `src/lib/gates.test.ts` | bun tests for that module |
| `src/lib/timeline.ts` | signal, diagnostic line, milestones take resolved gates |
| `src/lib/timeline.test.ts` | signal / milestones / diagnostic line against gates |
| `src/lib/board-data.ts` | resolve gates, pass them into `timelineMilestones` |
| `src/lib/types.ts` | no new persisted card fields; do not add `gate` on `Card` |
| `src/components/timeline-rail.tsx` | `gateName`; right-hand milestone; diagnostic line; hide status when gated |
| `src/components/timeline-explorer.tsx` | Gate filter (AND with State) |
| `src/components/recent-delivery-pulse.tsx` | column `title: string`; slug heading ids |
| `src/app/p/[project]/b/[board]/timeline/page.tsx` | wire gates, items, pulse titles, compact-row gate name |
| `src/app/p/[project]/actions.ts` | `updateBoardGates` |
| `src/app/p/[project]/gates-editor.tsx` | project-page editor |
| `src/app/p/[project]/page.tsx` | gates section; load `board.settings` |
| `docs/gates.md` | short editor note |
| `e2e/gates.spec.ts` | editor + timeline row |

---

### Task 1: Gates module

**Files:**
- Create: `src/lib/gates.ts`
- Test: `src/lib/gates.test.ts`
- Modify: `src/lib/timeline.ts` — **move** `TIMELINE_BUILT_STATUSES_SETTING`, `TIMELINE_SHIPPED_STATUSES_SETTING`, `DEFAULT_BUILT_STATUSES`, `DEFAULT_SHIPPED_STATUSES`, and the private `statusList` helper into `gates.ts`. Re-export the four constants from `timeline.ts` so `src/lib/timeline.test.ts` imports keep working. Do not have `gates.ts` import `timeline.ts` (Task 2 will import the other way).

**Interfaces:**
- Consumes: `CARD_STATUSES` / `isCardStatus` from `src/lib/card-status.ts`; `Lane` kind/id from `src/lib/types.ts`; the four built/shipped setting constants
- Produces:

```ts
export const GATES_SETTING = "gates";
export const DEFAULT_SHIPPED_GATE_ID = "default-shipped";
export const DEFAULT_BUILT_GATE_ID = "default-built";
export const GATE_NAME_MAX = 80;

export type GateOutcome = "built" | "shipped";

export interface BoardGate {
  id: string;
  name: string;
  statuses: string[];
  lane_ids: string[];
  outcome: GateOutcome | null;
}

export function resolveBoardGates(
  settings: Record<string, unknown> | null | undefined,
  lanes: Pick<Lane, "id" | "kind">[],
): BoardGate[];

export function cardGate(
  card: Pick<{ status: string; lane_id: string | null }, "status" | "lane_id">,
  gates: readonly BoardGate[],
): BoardGate | null;

export function gateOutcomeSets(gates: readonly BoardGate[]): {
  built: { statuses: ReadonlySet<string>; laneIds: ReadonlySet<string> };
  shipped: { statuses: ReadonlySet<string>; laneIds: ReadonlySet<string> };
};

export function pulseHeading(
  gates: readonly BoardGate[],
  outcome: GateOutcome,
): string;

export function validateGatesForSave(
  value: unknown,
  boardLaneIds: ReadonlySet<string>,
): { ok: true; gates: BoardGate[] } | { ok: false; error: string };
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/gates.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  cardGate,
  DEFAULT_BUILT_GATE_ID,
  DEFAULT_SHIPPED_GATE_ID,
  gateOutcomeSets,
  pulseHeading,
  resolveBoardGates,
  validateGatesForSave,
  type BoardGate,
} from "./gates";

const lanes = [
  { id: "now", kind: "work" as const },
  { id: "built-lane", kind: "built" as const },
  { id: "done-lane", kind: "done" as const },
];

const awaiting: BoardGate = {
  id: "g-await",
  name: "Awaiting delivery",
  statuses: ["built", "handed"],
  lane_ids: ["now"],
  outcome: "built",
};
const shipped: BoardGate = {
  id: "g-ship",
  name: "Done",
  statuses: ["shipped", "done"],
  lane_ids: ["done-lane"],
  outcome: "shipped",
};

describe("cardGate", () => {
  test("first match wins; no match is null", () => {
    const gates = [shipped, awaiting];
    expect(cardGate({ status: "done", lane_id: "now" }, gates)?.id).toBe(
      "g-ship",
    );
    expect(cardGate({ status: "built", lane_id: "now" }, gates)?.id).toBe(
      "g-await",
    );
    expect(cardGate({ status: "wip", lane_id: "built-lane" }, gates)).toBeNull();
  });

  test("status-only and lane-only both match; both-empty matches nothing", () => {
    expect(
      cardGate({ status: "built", lane_id: null }, [
        { ...awaiting, lane_ids: [] },
      ])?.id,
    ).toBe("g-await");
    expect(
      cardGate({ status: "backlog", lane_id: "now" }, [
        { ...awaiting, statuses: [] },
      ])?.id,
    ).toBe("g-await");
    expect(
      cardGate({ status: "built", lane_id: "now" }, [
        { ...awaiting, statuses: [], lane_ids: [] },
      ]),
    ).toBeNull();
  });
});

describe("resolveBoardGates", () => {
  test("missing or malformed synthesizes Shipped then Built", () => {
    const resolved = resolveBoardGates({}, lanes);
    expect(resolved.map((g) => g.id)).toEqual([
      DEFAULT_SHIPPED_GATE_ID,
      DEFAULT_BUILT_GATE_ID,
    ]);
    expect(resolved[0]?.statuses.sort()).toEqual(["done", "shipped"]);
    expect(resolved[0]?.lane_ids).toEqual(["done-lane"]);
    expect(resolved[0]?.outcome).toBe("shipped");
    expect(resolved[1]?.statuses.sort()).toEqual(["built", "handed"]);
    expect(resolved[1]?.lane_ids).toEqual(["built-lane"]);
    expect(resolved[1]?.outcome).toBe("built");
    expect(resolveBoardGates({ gates: "nope" }, lanes)[0]?.id).toBe(
      DEFAULT_SHIPPED_GATE_ID,
    );
  });

  test("timeline_built_statuses override seeds default Built statuses", () => {
    const resolved = resolveBoardGates(
      { timeline_built_statuses: ["handed"] },
      lanes,
    );
    expect(resolved.find((g) => g.id === DEFAULT_BUILT_GATE_ID)?.statuses).toEqual(
      ["handed"],
    );
  });

  test("saved [] is no gates; saved list ignores old status keys", () => {
    expect(resolveBoardGates({ gates: [] }, lanes)).toEqual([]);
    const resolved = resolveBoardGates(
      {
        timeline_built_statuses: ["handed"],
        gates: [awaiting],
      },
      lanes,
    );
    expect(resolved).toEqual([awaiting]);
  });

  test("drops unknown lane ids; a gate that then has nothing is invalid (whole fallback)", () => {
    expect(
      resolveBoardGates(
        {
          gates: [
            {
              id: "g1",
              name: "X",
              statuses: ["built"],
              lane_ids: ["gone"],
              outcome: null,
            },
          ],
        },
        lanes,
      )[0]?.lane_ids,
    ).toEqual([]);
    expect(
      resolveBoardGates(
        {
          gates: [
            {
              id: "g1",
              name: "X",
              statuses: [],
              lane_ids: ["gone"],
              outcome: null,
            },
          ],
        },
        lanes,
      )[0]?.id,
    ).toBe(DEFAULT_SHIPPED_GATE_ID);
  });
});

describe("gateOutcomeSets and pulseHeading", () => {
  test("unions outcome statuses and lanes; heading uses the sole name", () => {
    const sets = gateOutcomeSets([shipped, awaiting]);
    expect([...sets.built.statuses].sort()).toEqual(["built", "handed"]);
    expect([...sets.built.laneIds]).toEqual(["now"]);
    expect(pulseHeading([shipped, awaiting], "built")).toBe(
      "Awaiting delivery",
    );
    expect(pulseHeading([awaiting, { ...awaiting, id: "g2" }], "built")).toBe(
      "Built",
    );
    expect(pulseHeading([], "shipped")).toBe("Shipped");
  });
});

describe("validateGatesForSave", () => {
  const ids = new Set(lanes.map((l) => l.id));

  test("accepts a clean list and rejects the spec's failure cases", () => {
    expect(validateGatesForSave([awaiting, shipped], ids).ok).toBe(true);
    expect(validateGatesForSave([{ ...awaiting, name: "" }], ids).ok).toBe(
      false,
    );
    expect(
      validateGatesForSave(
        [awaiting, { ...shipped, name: "awaiting delivery" }],
        ids,
      ).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([awaiting, { ...shipped, id: awaiting.id }], ids)
        .ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, statuses: ["nope"] }], ids).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, lane_ids: ["gone"] }], ids).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, outcome: "qa" }], ids).ok,
    ).toBe(false);
    expect(
      validateGatesForSave(
        [{ ...awaiting, statuses: [], lane_ids: [] }],
        ids,
      ).ok,
    ).toBe(false);
    expect(
      validateGatesForSave([{ ...awaiting, id: "" }], ids).ok,
    ).toBe(false);
  });
});
```

Do not import a Staffeto board. The name `Awaiting delivery` here is a fixture string only.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/gates.test.ts`

Expected: FAIL with `Cannot find module './gates'` (or the exports are missing).

- [ ] **Step 3: Write the minimal module**

Create `src/lib/gates.ts`. Behaviour, exactly:

**`resolveBoardGates`:** If `settings.gates` is an array and `parseGates(settings.gates, laneIdSet)` returns a list, return that list (`[]` included). Otherwise return `defaultBoardGates(settings, lanes)`.

**`parseGates` (private):** For each element: object; `id` non-empty string; `name` trimmed 1–80; `statuses` array of `CARD_STATUSES` values; `lane_ids` array of strings, then drop ids not in `laneIdSet`; `outcome` is `null`, omitted → `null`, `"built"`, or `"shipped"`. After dropping lanes, the gate must still have at least one status or one lane. Duplicate `id` in the list → fail the whole parse (`null`). Success returns the cleaned `BoardGate[]`.

**`defaultBoardGates`:** Use `statusList` from the existing timeline helper (the same validity rule as today's `timelineOutcomeStatuses`: non-empty array of known statuses, else the default tuple). Shipped first (`DEFAULT_SHIPPED_GATE_ID`, name `"Shipped"`, shipped statuses, every `kind==="done"` lane id, `outcome: "shipped"`), then Built (`DEFAULT_BUILT_GATE_ID`, `"Built"`, built statuses, every `kind==="built"` lane id, `outcome: "built"`).

**`cardGate`:** first gate where `statuses.includes(card.status)` or (`card.lane_id` and `lane_ids.includes(card.lane_id)`). Empty `statuses` does not match on status. Empty `lane_ids` does not match on lane.

**`gateOutcomeSets`:** union statuses and lane ids of gates with that `outcome`.

**`pulseHeading`:** if exactly one gate has that outcome, its `name`; else `"Built"` / `"Shipped"`.

**`validateGatesForSave`:** not an array → `{ ok: false, error: "Gates could not be saved." }`. Then the same field rules as parse, except **do not drop** unknown lane ids — unknown lane → `{ ok: false, error: "Unknown lane." }`. Duplicate id → `"Two gates cannot share an id."` Duplicate case-insensitive trimmed name → `"Two gates cannot share a name."` Blank/too-long name → `"Every gate needs a name (80 characters or fewer)."` Bad status → `"Unknown status."` Bad outcome → `"Choose None, Built, or Shipped."` Both lists empty → `"Each gate needs at least one status or one lane."` Missing/blank id → `"A gate is missing an id."` First failure wins. On success return cleaned gates with trimmed names and `outcome: null` when empty.

JSDoc on every export.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/gates.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gates.ts src/lib/gates.test.ts src/lib/timeline.ts
git commit -m "feat: resolve board gates from settings"
```

Only add `timeline.ts` if you moved the four constants.

---

### Task 2: Timeline signal, diagnostic line, milestones

**Files:**
- Modify: `src/lib/timeline.ts`
- Test: `src/lib/timeline.test.ts`
- Modify: `src/lib/board-data.ts`

**Interfaces:**
- Consumes: `resolveBoardGates`, `cardGate`, `gateOutcomeSets`, `BoardGate` from `./gates`
- Produces:

```ts
export function timelineSignal(
  card: Pick<
    Card,
    "raised_on" | "shipped_on" | "status" | "target_date" | "target_label"
  >,
  today: string | Date,
  watchDays: number,
  gate: BoardGate | null,
): TimelineSignal;

export function timelineDiagnosticLine(
  item: {
    signal: TimelineSignal;
    raisedOn: string;
    targetDate: string | null;
    targetLabel: string | null;
    deliveredAt: string | null;
  },
  today: string,
  watchDays: number,
): string;

export function timelineMilestones(
  cards: Pick<Card, "id" | "lane_id" | "created_at" | "status">[],
  lanes: Pick<Lane, "id" | "key" | "kind">[],
  events: TimelineHistoryEvent[],
  gates?: readonly BoardGate[],
): TimelineMilestones;
```

Default `gates` is `resolveBoardGates(null, lanes)` so existing calls that omit the fourth argument keep default Shipped/Built from lane kinds.

`timelineOutcomeStatuses(settings)` stays exported if tests still import it. Reimplement it as the status sets from `gateOutcomeSets(resolveBoardGates(settings, []))` so a saved `gates` array wins over the old keys. If you keep the function, add a one-line JSDoc that it is status-only and that milestones use gates.

- [ ] **Step 1: Write the failing tests**

In `src/lib/timeline.test.ts`, change every `timelineSignal(card, { kind: … }, today, 14)` call to `timelineSignal(card, today, 14, gate)`. For the old "done lane ⇒ delivered" case, pass a shipped-outcome gate (or `cardGate` against default resolved gates for a done-kind lane). For work-lane cases pass `null` unless the card would match a shipped gate.

Replace the last milestones test that passed `timelineOutcomeStatuses({ timeline_built_statuses: ["handed"] })` with `resolveBoardGates({ timeline_built_statuses: ["handed"] }, lanes)`.

Add:

```ts
import { resolveBoardGates, type BoardGate } from "./gates";
import { timelineDiagnosticLine } from "./timeline";

test("delivered is shipped_on or a shipped-outcome gate, not raw done status", () => {
  const today = "2026-08-31";
  expect(
    timelineSignal(card({ status: "done" }), today, 14, null),
  ).not.toBe("delivered");
  expect(
    timelineSignal(card({ shipped_on: "2026-08-20" }), today, 14, null),
  ).toBe("delivered");
  const shippedGate: BoardGate = {
    id: "g-ship",
    name: "Done",
    statuses: ["done"],
    lane_ids: [],
    outcome: "shipped",
  };
  expect(
    timelineSignal(card({ status: "done" }), today, 14, shippedGate),
  ).toBe("delivered");
});

test("planned / forgotten / overdue still follow the date rules", () => {
  const today = "2026-08-31";
  expect(
    timelineSignal(card({ target_date: "2026-09-15" }), today, 14, null),
  ).toBe("planned");
  expect(
    timelineSignal(card({ target_date: "2026-08-20" }), today, 14, null),
  ).toBe("overdue");
  expect(
    timelineSignal(card({ raised_on: "2026-08-17" }), today, 14, null),
  ).toBe("forgotten");
});

test("milestones follow saved gate lanes, not raw lane kinds", () => {
  const lanes = [
    { id: "gate-2", key: "gate-2", kind: "work" as const },
    { id: "built-id", key: "built", kind: "built" as const },
  ];
  const gates: BoardGate[] = [
    {
      id: "g-await",
      name: "Awaiting delivery",
      statuses: ["built"],
      lane_ids: ["gate-2"],
      outcome: "built",
    },
  ];
  const cards = [
    {
      id: "in-gate",
      lane_id: "gate-2",
      created_at: "2026-08-01T00:00:00Z",
      status: "backlog",
    },
    {
      id: "kind-built",
      lane_id: "built-id",
      created_at: "2026-08-02T00:00:00Z",
      status: "backlog",
    },
  ];
  const milestones = timelineMilestones(
    cards,
    lanes,
    [
      {
        card_id: "in-gate",
        kind: "moved",
        at: "2026-08-20T09:00:00Z",
        payload: { to_lane: "gate-2" },
      },
    ],
    gates,
  );
  expect(milestones.builtAt.get("in-gate")).toBe("2026-08-20T09:00:00Z");
  expect(milestones.builtAt.has("kind-built")).toBe(false);
});

test("diagnostic line prefixes the date word", () => {
  const today = "2026-08-31";
  const base = {
    raisedOn: "2026-08-27",
    targetDate: null as string | null,
    targetLabel: null as string | null,
    deliveredAt: null as string | null,
  };
  expect(
    timelineDiagnosticLine(
      { ...base, signal: "planned", targetDate: "2026-08-31" },
      today,
      14,
    ),
  ).toBe("Planned · Target Aug 31, 2026 · today");
  expect(
    timelineDiagnosticLine(
      { ...base, signal: "overdue", targetDate: "2026-08-20" },
      today,
      14,
    ),
  ).toBe("Overdue · Target was Aug 20, 2026");
  expect(
    timelineDiagnosticLine(
      { ...base, signal: "delivered", deliveredAt: "2026-08-27" },
      today,
      14,
    ),
  ).toBe("Delivered · Shipped Aug 27, 2026");
  expect(
    timelineDiagnosticLine({ ...base, signal: "active" }, today, 14),
  ).toBe("Open · No target yet");
  expect(
    timelineDiagnosticLine(
      { ...base, signal: "planned", targetLabel: "September" },
      today,
      14,
    ),
  ).toBe("Planned · Rough target · September");
});
```

Keep the existing forgotten-boundary and default-milestone tests, updated only for the new signatures. The UI-id / ETL-key milestone test must still pass with the default fourth argument (synthesized gates from `kind=built` / `kind=done` lanes).

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/timeline.test.ts`

Expected: FAIL on arity of `timelineSignal` and/or missing `timelineDiagnosticLine`.

- [ ] **Step 3: Implement**

**`timelineSignal`:** Drop the `lane` argument. First branch: `if (card.shipped_on || gate?.outcome === "shipped") return "delivered"`. Then overdue / forgotten / planned / active unchanged.

**`timelineDiagnosticLine`:** Move the rail's `destination()` copy here and prefix the diagnostic word as the spec table:

| signal | copy |
|---|---|
| `planned` + `targetDate` | `Planned · Target {date}{ · today \| · in N days}` (same remaining math as today's `destination`) |
| `planned` + `targetLabel` only | `Planned · Rough target · {label}` |
| `overdue` | `Overdue · Target was {date}` |
| `forgotten` | `Forgotten · No target · {beyond} days past the watch window` OR `Forgotten · No target · reached the {n}-day watch window` (keep today's beyond/reached split) |
| `delivered` + `deliveredAt` | `Delivered · Shipped {date}` |
| `delivered` without date | `Delivered` |
| `active` + `targetLabel` | `Open · Rough target · {label}` (should not happen if planned wins; still handle) |
| `active` | `Open · No target yet` |

Use the same UTC `en-US` `DateTimeFormat` as the rail (`month: "short", day: "numeric", year: "numeric"`).

**`timelineMilestones`:** Default `gates = resolveBoardGates(null, lanes)`. `const sets = gateOutcomeSets(gates)`. When walking events: a destination lane whose **id** is in `sets.built.laneIds` stamps `builtAt` (not `lane.kind === "built"`). Same for shipped / `deliveredAt`. Status transitions use `sets.built.statuses` / `sets.shipped.statuses` as today. Fallback: if `cardGate(card, gates)?.outcome === "built"` (resp. `"shipped"`) and no stamp yet, use created_at. Do not consult `lane.kind` in the fallback.

**`src/lib/board-data.ts`:** `const gates = resolveBoardGates((board.settings ?? {}) as Record<string, unknown>, (lanes ?? []) as Lane[]);` pass `gates` into `timelineMilestones` instead of `timelineOutcomeStatuses(...)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/timeline.test.ts src/lib/gates.test.ts`

Expected: PASS. Also run `bun test src/lib` if anything else imported the old `timelineSignal` arity (`grep timelineSignal`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts src/lib/timeline.test.ts src/lib/board-data.ts
git commit -m "feat: timeline diagnostics and milestones use gates"
```

---

### Task 3: Timeline rail, explorer, pulse, page

**Files:**
- Modify: `src/components/timeline-rail.tsx`
- Modify: `src/components/timeline-explorer.tsx`
- Modify: `src/components/recent-delivery-pulse.tsx`
- Modify: `src/app/p/[project]/b/[board]/timeline/page.tsx`

**Interfaces:**
- Consumes: `cardGate`, `resolveBoardGates`, `pulseHeading` from `@/lib/gates`; `timelineSignal`, `timelineDiagnosticLine` from `@/lib/timeline`
- Produces: `TimelineRailItem` gains `gateId: string | null` and `gateName: string | null`. `TimelineExplorer` gains `gates: { id: string; name: string }[]`. `RecentDeliveryPulse` / `OutcomeColumn` `title: string` (not `"Built" \| "Shipped"`). Heading id: `recent-` + lowercase title with non-alphanumerics turned into `-`, trimmed of leading/trailing `-`. If the slug is empty, use `recent-built` / `recent-shipped` from the outcome, not from the title — pass an `id` prop: `id: string` plus `title: string` to avoid collisions.

- [ ] **Step 1: Write the failing diagnostic-line tests if Task 2 did not already cover every spec row**

If forgotten copy is not asserted yet, add one test that the beyond/reached phrasing still matches today's rail (prefix `Forgotten · ` onto the old `No target · …` strings). Fail then implement in `timelineDiagnosticLine` only.

- [ ] **Step 2: Rail chrome**

`TimelineRailItem`:

```ts
gateId: string | null;
gateName: string | null;
```

Right-hand `<span>`: if `item.gateName`, render it with `className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)]"` and **no** diagnostic `style={{ color }}`. If no gate name, omit the span.

Dot: keep `SIGNAL_COLOR[item.signal]`.

Date line: `timelineDiagnosticLine(item, today, watchDays)` with `style={{ color: SIGNAL_COLOR[item.signal] }}` (keep `text-xs`). Remove the old `destination()` helper and the unused `SIGNAL_LABEL` import from the right-hand slot. Keep `SIGNAL_LABEL` out of this file if nothing else uses it.

Status chip: `{item.status !== "backlog" && !item.gateName && ( … existing chip … )}`.

- [ ] **Step 3: Explorer Gate filter**

Add props `gates: { id: string; name: string }[]`. State `gateFilter` default `"all"`. Select after State:

```tsx
<label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
  Gate
  <select
    value={gateFilter}
    onChange={(event) => setGateFilter(event.target.value)}
    className="paper-field mt-1 block h-8 min-w-36 max-w-56 px-2 text-xs normal-case tracking-normal"
  >
    <option value="all">Any gate</option>
    <option value="ungated">Ungated</option>
    {gates.map((gate) => (
      <option key={gate.id} value={gate.id}>
        {gate.name}
      </option>
    ))}
  </select>
</label>
```

Filter AND with the existing rules:

- `gateFilter === "ungated"` → keep when `!item.gateId`
- `gateFilter` is a gate id → keep when `item.gateId === gateFilter`

`clear()` resets `gateFilter` to `"all"`. `filtering` is true when `gateFilter !== "all"` as well.

- [ ] **Step 4: Pulse titles**

`OutcomeColumn` takes `title: string` and `headingId: string`. `aria-labelledby={headingId}` and `h3 id={headingId}`. Empty copy stays `Nothing {title.toLowerCase()} in this window.`

`RecentDeliveryPulse` takes `builtTitle` and `shippedTitle` (strings) plus the existing lists. Blurb: `What crossed {builtTitle} and {shippedTitle} during the last {windowDays} days.` Heading ids: `recent-built` and `recent-shipped` (stable, do not slug user names — screen-reader still reads the visible title). This keeps the existing e2e `getByRole("heading", { name: "Built" })` working **until** a board renames the gate; the demo board uses default names, so `e2e/timeline.spec.ts` stays green.

- [ ] **Step 5: Timeline page wiring**

After `laneById`:

```ts
const gates = resolveBoardGates(
  data.board.settings as Record<string, unknown>,
  data.lanes,
);
```

Signals:

```ts
timelineSignal(
  card,
  today,
  watchDays,
  cardGate(card, gates),
);
```

Each `TimelineRailItem` sets `gateId: cardGate(card, gates)?.id ?? null` and `gateName: cardGate(card, gates)?.name ?? null`.

Pass `gates={gates.map((g) => ({ id: g.id, name: g.name }))}` into `TimelineExplorer`.

Pulse:

```ts
<RecentDeliveryPulse
  built={recentBuilt}
  shipped={recentShipped}
  builtTitle={pulseHeading(gates, "built")}
  shippedTitle={pulseHeading(gates, "shipped")}
  ...
/>
```

`compactRow`: where the lane name is shown, use `cardGate(card, gates)?.name ?? lane?.name ?? "No lane"`. Needs-attention left label stays the diagnostic (`SIGNAL_LABEL[signal]`).

- [ ] **Step 6: Run unit tests and existing timeline e2e if the suite is up**

Run: `bun test src/lib/timeline.test.ts src/lib/gates.test.ts`

Expected: PASS.

If Playwright is available: `bunx playwright test e2e/timeline.spec.ts` — still looks for heading **Built** / **Shipped** on the demo board.

- [ ] **Step 7: Commit**

```bash
git add src/components/timeline-rail.tsx src/components/timeline-explorer.tsx src/components/recent-delivery-pulse.tsx src/app/p/[project]/b/[board]/timeline/page.tsx
git commit -m "feat: timeline rail shows gate then diagnostic"
```

---

### Task 4: Project-page editor and save

**Files:**
- Modify: `src/app/p/[project]/actions.ts`
- Create: `src/app/p/[project]/gates-editor.tsx`
- Modify: `src/app/p/[project]/page.tsx`

**Interfaces:**
- Consumes: `validateGatesForSave`, `resolveBoardGates`, `GATES_SETTING`, `GATE_NAME_MAX`, `BoardGate` from `@/lib/gates`; `CARD_STATUSES` from `@/lib/card-status`; `currentAccess`; `canManageProject` already used on the page
- Produces:

```ts
export type GatesResult = { error?: string; message?: string } | null;

export async function updateBoardGates(
  _previous: GatesResult,
  form: FormData,
): Promise<GatesResult>;
```

Form fields: `boardId`, `projectSlug`, `boardSlug`, `gates` (JSON string of `BoardGate[]`).

- [ ] **Step 1: Server action**

Same access pattern as `updateTimelineSettings`. Load the board (`id, project_id, settings, slug`) and its lanes (`id`). `project_id` must match the access project. Parse JSON; `validateGatesForSave(parsed, new Set(lane ids))`. On `{ ok: false }` return `{ error: result.error }`. On success write `{ ...board.settings, [GATES_SETTING]: result.gates }` (do not strip old status keys). `revalidatePath(`/p/${projectSlug}`)` and `revalidatePath(`/p/${projectSlug}/b/${boardSlug}/timeline`)`. Success message: `Gates saved.` Unauthorized: `Only an owner or project admin can change gates.`

- [ ] **Step 2: Editor**

Create `src/app/p/[project]/gates-editor.tsx` as a client component. Props:

```ts
{
  boardId: string;
  boardSlug: string;
  projectSlug: string;
  boardName: string;
  showBoardName: boolean;
  lanes: { id: string; name: string }[];
  initialGates: BoardGate[];
  canEdit: boolean;
}
```

If `!canEdit`, render the names as a static list and `Board setting` (same idea as the forgotten-window read-only block). No form.

If `canEdit`: one form, `useActionState(updateBoardGates)`. Hidden inputs for ids/slugs. Hold `gates` in `useState(initialGates)`. One sentence: `Order is first match. The timeline uses the name as the milestone.` Each row: name `<input maxLength={80} aria-label={gate.name ? `Name for ${gate.name}` : "Name for new gate"}>`; a checkbox per `CARD_STATUSES` value; a checkbox per lane (including archive); outcome `<select>` with `""` / `built` / `shipped` labelled None / Built / Shipped; Move up / Move down buttons (disable at ends); Delete. **Add gate** appends `{ id: crypto.randomUUID(), name: "", statuses: [], lane_ids: [], outcome: null }`. Persist the live array through `<input type="hidden" name="gates" value={JSON.stringify(gates)} />`. Submit button `Save gates`. Show `state.error` / `state.message` with `aria-live="polite"`.

Use existing paper/cta classes from `timeline-settings.tsx` (`cta`, `cta-title`, `cta-body`, `cta-button`, `paper-field`). Do not invent a graph layout. Checkboxes can be a wrapping flex of labels at `text-xs`.

Keep `default-built` / `default-shipped` ids when those rows came from defaults (do not regenerate on first save).

- [ ] **Step 3: Project page**

Extend the boards select to include `settings`:

```
boards(id, slug, name, settings, lanes(id, name, kind, position, color), cards(...))
```

Add `settings: Record<string, unknown> | null` on `BoardRow`.

New `ProjectSection id="gates-heading" title="gates"` **above** the settings section (board vocabulary, not the forgotten window). For each board:

```tsx
<GatesEditor
  boardId={board.id}
  boardSlug={board.slug}
  projectSlug={project.slug}
  boardName={board.name}
  showBoardName={boards.length > 1}
  lanes={[...(board.lanes ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((l) => ({ id: l.id, name: l.name }))}
  initialGates={resolveBoardGates(
    (board.settings ?? {}) as Record<string, unknown>,
    board.lanes ?? [],
  )}
  canEdit={canManage}
/>
```

Need `kind` on lanes for `resolveBoardGates` — the select already has `kind`.

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`

Expected: PASS. Fix any `timelineSignal` call sites still passing a lane.

- [ ] **Step 5: Commit**

```bash
git add src/app/p/[project]/actions.ts src/app/p/[project]/gates-editor.tsx src/app/p/[project]/page.tsx
git commit -m "feat: edit board gates on the project page"
```

---

### Task 5: Playwright and docs

**Files:**
- Create: `e2e/gates.spec.ts`
- Create: `docs/gates.md`
- Modify: `e2e/timeline.spec.ts` only if Task 3 changed a heading the existing spec asserts

**Interfaces:**
- Consumes: `admin` + `signIn` from `e2e/support/sign-in.ts`; demo board `demo` / `backlog`; card `#7` (`status: built`, lane Built, raised 2026-08-09, no target)

- [ ] **Step 1: Write the e2e**

`e2e/gates.spec.ts`. Restore board settings (and any card patch) in `finally`, same pattern as `e2e/timeline.spec.ts`.

```ts
import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

test("gates rename the milestone on the timeline without looking like Planned + Built", async ({
  page,
}) => {
  const { data: board } = await admin
    .from("boards")
    .select("id, settings, project_id")
    .eq("slug", "backlog")
    .single();
  const previous = (board?.settings as Record<string, unknown> | null) ?? {};

  const { data: card } = await admin
    .from("cards")
    .select("id, status, lane_id, target_date, target_label")
    .eq("external_id", "7")
    .eq("board_id", board!.id)
    .single();
  const previousCard = card!;

  try {
    await admin
      .from("cards")
      .update({ target_date: "2026-08-31", target_label: null })
      .eq("id", previousCard.id);

    await signIn(page);
    await page.goto("/p/demo");
    await expect(page.getByRole("heading", { name: "gates" })).toBeVisible();
    await expect(page.getByLabel("Name for Built")).toHaveValue("Built");
    await expect(page.getByLabel("Name for Shipped")).toHaveValue("Shipped");

    await page.getByLabel("Name for Built").fill("Awaiting delivery");
    await page.getByRole("checkbox", { name: "Now" }).check();
    await page.getByRole("button", { name: "Save gates" }).click();
    await expect(page.getByText("Gates saved.")).toBeVisible();

    await page.goto("/p/demo/b/backlog/timeline");
    const row = page.locator('[data-timeline-id="7"]');
    await expect(row.getByText("Awaiting delivery")).toBeVisible();
    await expect(row.getByText(/Planned · Target/)).toBeVisible();
    await expect(row.getByText("Planned", { exact: true })).toHaveCount(0);
    await expect(row.locator(".stat")).toHaveCount(0);
  } finally {
    if (board?.id)
      await admin.from("boards").update({ settings: previous }).eq("id", board.id);
    if (previousCard.id)
      await admin
        .from("cards")
        .update({
          target_date: previousCard.target_date,
          target_label: previousCard.target_label,
        })
        .eq("id", previousCard.id);
  }
});
```

Give the name inputs `aria-label={`Name for ${gate.name || "new gate"}`}` in the editor so these labels work. Checkboxes use the lane `name` as the accessible name (`<label><input type="checkbox" /> {lane.name}</label>`). Status checkboxes: `aria-label={`Status ${status}`}` so they do not collide with lane names.

If `#7` is Forgotten because 2026-08-31 is not "today" in the environment, set `target_date` to a far future (`2026-12-31`) instead; the assertion is `/Planned · Target/`.

- [ ] **Step 2: Run the e2e**

Run: `bunx playwright test e2e/gates.spec.ts e2e/timeline.spec.ts`

Expected: PASS. If the heading "gates" is lowercased by `ProjectSection` (it is — `title="gates"`), `getByRole("heading", { name: "gates" })` matches.

- [ ] **Step 3: Docs**

Create `docs/gates.md`:

```md
# Board gates

A gate is a named milestone for one board: a set of tracker statuses and/or
lanes. First match wins. The timeline prints the gate on the right and the
calendar diagnostic (Planned, Forgotten, Overdue, Delivered) on the date line.

Edit them on the project page, Gates section. Owners and project admins.
Saving writes `boards.settings.gates`. Until you save, the board behaves as
Built (`built` / `handed` plus `kind=built` lanes) then Shipped (`shipped` /
`done` plus `kind=done` lanes), with Shipped first.

New lanes do not join a saved gate until you tick them. Markdown files do not
carry a gate key.
```

- [ ] **Step 4: Commit**

```bash
git add e2e/gates.spec.ts docs/gates.md src/app/p/[project]/gates-editor.tsx
git commit -m "test: gates rename the timeline milestone"
```

Include the editor if you added aria-labels in this task.

---

## Self-review (spec coverage)

| Spec item | Task |
|---|---|
| `BoardGate` shape, `settings.gates`, first match, OR | 1 |
| Missing/malformed → defaults; `[]` → none; old keys ignored after save | 1 |
| `cardGate`, `gateOutcomeSets`, `pulseHeading`, save validation | 1 |
| Delivered = `shipped_on` or shipped-outcome gate | 2 |
| Planned / Forgotten / Overdue unchanged | 2 |
| Milestones use gate lanes/statuses, not raw kinds once saved | 2 |
| `board-data` passes resolved gates | 2 |
| Right-hand gate, diagnostic line, ink vs diagnostic colour, hide status chip | 3 |
| Two explorer filters, AND | 3 |
| Pulse titles from sole outcome gate; demo still says Built/Shipped | 3 |
| Compact row: gate name else lane | 3 |
| `updateBoardGates`, project Gates section, effective list, defaults ids | 4 |
| e2e rename + Now tick + timeline row | 5 |
| `docs/gates.md` | 5 |
| Non-goals (cockpit, markdown, table, pulse-per-gate, lane-kind behaviour) | not tasked |
