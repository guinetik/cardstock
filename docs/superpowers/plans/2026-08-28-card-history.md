# Card History Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-page History JSON dump with a three-column ledger (local clock, `.stat` kind, actor + facts) with no payload on the row.

**Architecture:** A React-free formatter (`src/lib/card-history.ts`) turns `card_events` + board lanes into `{ clock, kind, stat, actor, facts }`. A client list (`src/components/board/card-history.tsx`) paints that row so the clock uses the browser time zone. The card page passes events and lanes through and stops calling `JSON.stringify`. Writes, ETL, and the 50-event query stay unchanged.

**Tech Stack:** Next.js App Router (existing card page) · React 19 client component · bun test · Playwright · paper `.stat` pens already in `src/styles/components/paper.css`.

**Spec:** `docs/superpowers/specs/2026-08-28-card-history-design.md`

## Global Constraints

- No JSON on the row. No disclosure. Unknown events still get clock, kind, and actor.
- No new `.stat` variants, theme tokens, radii, or nested `.paper-card` / `.paper-lane`.
- Do not change what is written to `card_events`, the 50-event cap, or newest-first order.
- Clock: `Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })` assembled from `formatToParts` as `{day} {month}[ {year}] {hour}:{minute}`. Pad hour and minute to two digits. Year only when the event’s calendar year in that zone is not `now`’s. Invalid `at` → `—` (em dash, U+2014).
- Actor: substring before first `@` if present; else trimmed string; blank → `someone`. Never title-case.
- Lane lookup: match `id` then `key`. `moved` / `archived` / `restored` miss → `a lane`. `created` miss → the key string itself.
- Edited facts join with ` · ` (space, U+00B7, space). Effort facts are `effort L` / `M` / `H` (the letter, not `EFFORT_LABEL`).
- JSDoc on every exported function and type.
- Tests: `bun test src/lib/card-history.test.ts`. e2e: `bun run test:e2e e2e/board.spec.ts`.
- Commit messages: `feat: …` / `fix: …` / `docs: …`, short.
- Only touch files listed in this plan. The working tree has unrelated dirty files — leave them alone.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/card-history.ts` | Pure formatter. Types + `formatCardEvent`. |
| `src/lib/card-history.test.ts` | bun tests with `timeZone: 'UTC'` and a fixed `now`. |
| `src/components/board/card-history.tsx` | `"use client"` list. Heading `History`, empty copy, three-column row. |
| `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx` | Swap the dump for `<CardHistory>`. |
| `docs/card-detail.md` | History chrome rules. |
| `e2e/board.spec.ts` | Assert the History section has no `"from_lane"` / `"hash"` dump. |

---

### Task 1: Formatter

**Files:**
- Create: `src/lib/card-history.ts`
- Test: `src/lib/card-history.test.ts`

**Interfaces:**
- Consumes: `PRIORITY_LABEL` from `./types` (relative, like the other `src/lib` modules — bun test does not need the `@/` alias here)
- Produces: `CardHistoryLane`, `CardHistoryEvent`, `FormatCardEventOptions`, `FormattedCardEvent`, `formatCardEvent(event, lanes, options?)`

- [ ] **Step 1: Write the failing test**

Create `src/lib/card-history.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { formatCardEvent, type CardHistoryLane } from "./card-history";

const lanes: CardHistoryLane[] = [
  { id: "id-now", key: "now", name: "Now" },
  { id: "id-next", key: "next", name: "Next" },
  { id: "id-unsorted", key: "unsorted", name: "Unsorted" },
];

const NOW = new Date("2026-08-28T12:00:00.000Z");
const opts = { timeZone: "UTC", now: NOW };

function ev(
  partial: Partial<{
    id: string;
    actor: string | null;
    kind: string;
    payload: unknown;
    at: string;
  }>,
) {
  return {
    id: "e1",
    actor: "etl",
    kind: "moved",
    payload: {},
    at: "2026-08-28T02:28:00.000Z",
    ...partial,
  };
}

describe("actor", () => {
  test("email local-part, etl, blank → someone", () => {
    expect(
      formatCardEvent(ev({ actor: "joao@staffeto.com" }), lanes, opts).actor,
    ).toBe("joao");
    expect(formatCardEvent(ev({ actor: "etl" }), lanes, opts).actor).toBe("etl");
    expect(formatCardEvent(ev({ actor: "  etl  " }), lanes, opts).actor).toBe(
      "etl",
    );
    expect(formatCardEvent(ev({ actor: null }), lanes, opts).actor).toBe(
      "someone",
    );
    expect(formatCardEvent(ev({ actor: "   " }), lanes, opts).actor).toBe(
      "someone",
    );
    expect(formatCardEvent(ev({ actor: "@x.com" }), lanes, opts).actor).toBe(
      "someone",
    );
  });
});

describe("clock", () => {
  test("this year is day month hour:minute", () => {
    expect(formatCardEvent(ev({}), lanes, opts).clock).toBe("28 Aug 02:28");
  });

  test("other year includes the year", () => {
    expect(
      formatCardEvent(ev({ at: "2025-01-02T03:04:00.000Z" }), lanes, opts)
        .clock,
    ).toBe("2 Jan 2025 03:04");
  });

  test("invalid at is an em dash", () => {
    expect(formatCardEvent(ev({ at: "nope" }), lanes, opts).clock).toBe("—");
  });
});

describe("kind pens", () => {
  test("maps known kinds and unknown to existing modifiers", () => {
    expect(formatCardEvent(ev({ kind: "moved" }), lanes, opts).stat).toBe(
      "stat--info",
    );
    expect(formatCardEvent(ev({ kind: "restored" }), lanes, opts).stat).toBe(
      "stat--info",
    );
    expect(formatCardEvent(ev({ kind: "commented" }), lanes, opts).stat).toBe(
      "stat--info",
    );
    expect(formatCardEvent(ev({ kind: "created" }), lanes, opts).stat).toBe(
      "stat--success",
    );
    expect(formatCardEvent(ev({ kind: "imported" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
    expect(formatCardEvent(ev({ kind: "edited" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
    expect(formatCardEvent(ev({ kind: "archived" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
    expect(formatCardEvent(ev({ kind: "frobbed" }), lanes, opts).stat).toBe(
      "stat--muted",
    );
  });
});

describe("moved", () => {
  test("both lanes by id, rank omitted", () => {
    const row = formatCardEvent(
      ev({
        payload: { from_lane: "id-now", to_lane: "id-next", rank: 3.5 },
      }),
      lanes,
      opts,
    );
    expect(row.facts).toBe("Now → Next");
    expect(row.facts).not.toContain("3.5");
  });

  test("unknown ids become a lane; only-from and only-to", () => {
    expect(
      formatCardEvent(
        ev({ payload: { from_lane: "missing", to_lane: "id-next" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("a lane → Next");
    expect(
      formatCardEvent(ev({ payload: { to_lane: "id-next" } }), lanes, opts)
        .facts,
    ).toBe("→ Next");
    expect(
      formatCardEvent(ev({ payload: { from_lane: "id-now" } }), lanes, opts)
        .facts,
    ).toBe("Now →");
    expect(formatCardEvent(ev({ payload: {} }), lanes, opts).facts).toBe("");
  });
});

describe("imported", () => {
  test("source basename, hash omitted", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "imported",
          payload: {
            source: "foo/bar/156.md",
            hash: "abc",
            status: "wip",
            lane: "now",
          },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("156.md");
    expect(
      formatCardEvent(
        ev({
          kind: "imported",
          payload: { source: "foo\\bar\\156.md", hash: "abc" },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("156.md");
    expect(
      formatCardEvent(ev({ kind: "imported", payload: { hash: "abc" } }), lanes, opts)
        .facts,
    ).toBe("");
  });
});

describe("created", () => {
  test("lane key resolves to name, else the key, never a lane", () => {
    expect(
      formatCardEvent(
        ev({ kind: "created", payload: { lane: "unsorted", hash: "x" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("Unsorted");
    expect(
      formatCardEvent(
        ev({ kind: "created", payload: { lane: "gone" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("gone");
    expect(
      formatCardEvent(ev({ kind: "created", payload: {} }), lanes, opts).facts,
    ).toBe("");
  });
});

describe("edited", () => {
  test("known fields in order, values only where specified", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "edited",
          payload: {
            summary: "hi",
            priority: 2,
            effort: "M",
            tags: ["t1"],
            body: true,
            extra_uuid: "nope",
          },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("priority P2 · effort M · summary · tags · body · extra_uuid");
  });

  test("bad values fall back to the field word", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "edited",
          payload: { priority: 9, effort: "X", target_date: "", audience: "x" },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("priority · effort · target date · audience");
  });
});

describe("archived and restored", () => {
  test("lane it left or returned to", () => {
    expect(
      formatCardEvent(
        ev({ kind: "archived", payload: { from_lane: "id-now" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("Now");
    expect(
      formatCardEvent(
        ev({ kind: "archived", payload: { from_lane: "missing" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("a lane");
    expect(
      formatCardEvent(ev({ kind: "archived", payload: {} }), lanes, opts).facts,
    ).toBe("");
    expect(
      formatCardEvent(
        ev({ kind: "restored", payload: { to_lane: "id-next" } }),
        lanes,
        opts,
      ).facts,
    ).toBe("Next");
  });
});

describe("commented and unknown", () => {
  test("preview only; unknown kind has empty facts", () => {
    expect(
      formatCardEvent(
        ev({
          kind: "commented",
          payload: { author: "a@b.c", at: "x", preview: "Need a decision" },
        }),
        lanes,
        opts,
      ).facts,
    ).toBe("Need a decision");
    expect(
      formatCardEvent(ev({ kind: "frobbed", payload: { hash: "x" } }), lanes, opts)
        .facts,
    ).toBe("");
    expect(
      formatCardEvent(ev({ kind: "moved", payload: ["not", "an", "object"] }), lanes, opts)
        .facts,
    ).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/card-history.test.ts`

Expected: FAIL — cannot find module `./card-history` (or `formatCardEvent` is not exported).

- [ ] **Step 3: Write the formatter**

Create `src/lib/card-history.ts`:

```ts
import { PRIORITY_LABEL } from "./types";

/** Board lane fields History needs to turn ids/keys into names. */
export type CardHistoryLane = {
  id: string;
  key: string;
  name: string;
};

/** One `card_events` row as the card page already selects it. */
export type CardHistoryEvent = {
  id: string;
  actor: string | null;
  kind: string;
  payload: unknown;
  at: string;
};

/** Test hooks. The UI omits both and uses the browser zone and real now. */
export type FormatCardEventOptions = {
  timeZone?: string;
  now?: Date;
};

/** One ledger line. `stat` is the modifier only (`stat--info`, …). */
export type FormattedCardEvent = {
  clock: string;
  kind: string;
  stat: string;
  actor: string;
  facts: string;
};

const EDIT_ORDER = [
  "priority",
  "effort",
  "target_date",
  "target_label",
  "audience",
  "title",
  "summary",
  "tags",
  "body",
] as const;

/**
 * Turn one event into a ledger line: local clock, kind pen, actor, facts.
 *
 * Never stringifies `payload`. Unknown kinds still return clock, kind, and actor.
 *
 * @param event - A `card_events` row.
 * @param lanes - The card's board lanes, for id/key → name.
 * @param options - `timeZone` / `now` for tests; omit in the UI.
 */
export function formatCardEvent(
  event: CardHistoryEvent,
  lanes: CardHistoryLane[],
  options?: FormatCardEventOptions,
): FormattedCardEvent {
  return {
    clock: formatClock(event.at, options?.now ?? new Date(), options?.timeZone),
    kind: event.kind,
    stat: statFor(event.kind),
    actor: formatActor(event.actor),
    facts: formatFacts(event.kind, event.payload, lanes),
  };
}

/**
 * Email local-part, otherwise the trimmed actor. Blank → `someone`.
 */
function formatActor(actor: string | null | undefined): string {
  const raw = actor?.trim() ?? "";
  if (!raw) return "someone";
  if (!raw.includes("@")) return raw;
  const local = raw.slice(0, raw.indexOf("@")).trim();
  return local || "someone";
}

/**
 * `28 Aug 02:28`, with year when it is not `now`'s calendar year in `timeZone`.
 */
function formatClock(at: string, now: Date, timeZone?: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "—";
  const eventYear = calendarYear(date, timeZone);
  const nowYear = calendarYear(now, timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
    ...(eventYear !== nowYear ? { year: "numeric" as const } : {}),
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const day = pick("day");
  const month = pick("month");
  const year = eventYear !== nowYear ? ` ${pick("year")}` : "";
  const hour = pick("hour").padStart(2, "0");
  const minute = pick("minute").padStart(2, "0");
  return `${day} ${month}${year} ${hour}:${minute}`;
}

function calendarYear(date: Date, timeZone?: string): number {
  const year = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone,
  })
    .formatToParts(date)
    .find((p) => p.type === "year")?.value;
  return Number(year);
}

function statFor(kind: string): string {
  if (kind === "moved" || kind === "restored" || kind === "commented")
    return "stat--info";
  if (kind === "created") return "stat--success";
  return "stat--muted";
}

function asPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function formatFacts(
  kind: string,
  raw: unknown,
  lanes: CardHistoryLane[],
): string {
  const payload = asPayload(raw);
  switch (kind) {
    case "moved":
      return movedFacts(payload, lanes);
    case "imported":
      return importedFacts(payload);
    case "created":
      return createdFacts(payload, lanes);
    case "edited":
      return editedFacts(payload);
    case "archived":
      return laneFact(payload.from_lane, lanes, "a-lane");
    case "restored":
      return laneFact(payload.to_lane, lanes, "a-lane");
    case "commented":
      return typeof payload.preview === "string" && payload.preview
        ? payload.preview
        : "";
    default:
      return "";
  }
}

function movedFacts(
  payload: Record<string, unknown>,
  lanes: CardHistoryLane[],
): string {
  const from = laneFact(payload.from_lane, lanes, "a-lane");
  const to = laneFact(payload.to_lane, lanes, "a-lane");
  if (from && to) return `${from} → ${to}`;
  if (to) return `→ ${to}`;
  if (from) return `${from} →`;
  return "";
}

function importedFacts(payload: Record<string, unknown>): string {
  if (typeof payload.source !== "string" || !payload.source) return "";
  const parts = payload.source.split(/[/\\]/);
  return parts[parts.length - 1] || "";
}

function createdFacts(
  payload: Record<string, unknown>,
  lanes: CardHistoryLane[],
): string {
  return laneFact(payload.lane, lanes, "key");
}

/**
 * @param missing - `a-lane` for UUID fields; `key` for ETL lane keys (`created`).
 */
function laneFact(
  idOrKey: unknown,
  lanes: CardHistoryLane[],
  missing: "a-lane" | "key",
): string {
  if (typeof idOrKey !== "string" || idOrKey === "") return "";
  const hit = lanes.find((l) => l.id === idOrKey || l.key === idOrKey);
  if (hit) return hit.name;
  return missing === "a-lane" ? "a lane" : idOrKey;
}

function editedFacts(payload: Record<string, unknown>): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const key of EDIT_ORDER) {
    if (!(key in payload)) continue;
    seen.add(key);
    parts.push(editField(key, payload[key]));
  }
  const extra = Object.keys(payload)
    .filter((key) => !seen.has(key))
    .sort();
  for (const key of extra) parts.push(key);
  return parts.join(" · ");
}

function editField(key: (typeof EDIT_ORDER)[number], value: unknown): string {
  if (key === "priority") {
    if (value === 1 || value === 2 || value === 3)
      return `priority ${PRIORITY_LABEL[value]}`;
    return "priority";
  }
  if (key === "effort") {
    if (value === "L" || value === "M" || value === "H")
      return `effort ${value}`;
    return "effort";
  }
  if (key === "target_date") {
    return typeof value === "string" && value ? value : "target date";
  }
  if (key === "target_label") {
    return typeof value === "string" && value ? value : "target label";
  }
  if (key === "audience") {
    if (value === "all" || value === "internal") return `audience ${value}`;
    return "audience";
  }
  if (key === "title") return "title";
  if (key === "summary") return "summary";
  if (key === "tags") return "tags";
  return "body";
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `bun test src/lib/card-history.test.ts`

Expected: PASS. If the other-year clock fails because Intl emits `02` vs `2` for the day, keep the test’s `2 Jan 2025 03:04` (`day: "numeric"` is unpadded) and only pad hour/minute.

If `en-GB` emits a different month abbreviation, do not change the locale — fix the test only after confirming `formatToParts` in that runtime. The stamp must still be `{day} {month}[ {year}] {hour}:{minute}` with no comma.

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-history.ts src/lib/card-history.test.ts
git commit -m "feat: format card history as ledger lines"
```

---

### Task 2: History section UI

**Files:**
- Create: `src/components/board/card-history.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx` (replace the History `<section>` at the bottom; add the import)
- Modify: `docs/card-detail.md` (append a History section)

**Interfaces:**
- Consumes: `formatCardEvent`, `CardHistoryEvent`, `CardHistoryLane` from `src/lib/card-history.ts`
- Produces: `CardHistory({ events, lanes })` — heading accessible name `History`

- [ ] **Step 1: Add the client list**

Create `src/components/board/card-history.tsx`:

```tsx
"use client";

import {
  formatCardEvent,
  type CardHistoryEvent,
  type CardHistoryLane,
} from "@/lib/card-history";

/**
 * Card-page stamp log: clock, kind pen, actor, facts. No payload dump.
 *
 * Client so the clock uses the browser time zone. Kind/actor/facts are
 * deterministic; only `<time>` may differ between SSR and hydrate.
 */
export function CardHistory({
  events,
  lanes,
}: {
  events: CardHistoryEvent[];
  lanes: CardHistoryLane[];
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        History
      </h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing recorded.</p>
      ) : (
        <ul className="grid gap-y-1 text-xs">
          {events.map((event) => {
            const row = formatCardEvent(event, lanes);
            return (
              <li
                key={event.id}
                className="grid grid-cols-[7.5rem_auto_minmax(0,1fr)] items-baseline gap-x-2"
              >
                <time
                  dateTime={event.at}
                  suppressHydrationWarning
                  className="font-mono text-muted-foreground tabular-nums"
                >
                  {row.clock}
                </time>
                <span className={`stat ${row.stat}`}>{row.kind}</span>
                <span>
                  <span className="font-mono text-muted-foreground">
                    {row.actor}
                  </span>
                  {row.facts ? <> {row.facts}</> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire the card page**

In `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx`:

Add import next to `CardEditor`:

```ts
import { CardHistory } from "@/components/board/card-history";
```

Replace the History `<section>…</section>` (the block that `JSON.stringify`s `e.payload`) with:

```tsx
      <CardHistory events={events ?? []} lanes={lanes ?? []} />
```

Do not change the events query (`limit(50)`, `order at descending`). Do not load tags for History.

- [ ] **Step 3: Document the chrome**

Append to `docs/card-detail.md`:

```md
## History

Last on the page. One `.paper-card--static` already wraps the issue; do not nest a lane or a second card around the log.

Each `card_events` row is three columns: local clock in IBM Plex Mono (`28 Aug 02:28`, year only when it is not this year), kind as `.stat` (moved / restored / commented → `stat--info`, created → `stat--success`, everything else → `stat--muted`), then actor (email local-part; `etl` stays `etl`) and a short fact line. Facts use lane **names**, the import basename, and edited field words. Never `JSON.stringify` the payload. Empty copy is `Nothing recorded.` Cap 50, newest first.

The formatter lives in `src/lib/card-history.ts`. The full contract is `docs/superpowers/specs/2026-08-28-card-history-design.md`.
```

- [ ] **Step 4: Typecheck the page**

Run: `bun run check`

Expected: PASS. If `lanes` is typed too narrowly, pass `(lanes ?? []).map(({ id, key, name }) => ({ id, key, name }))` instead of widening the formatter.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/card-history.tsx src/app/p/[project]/b/[board]/c/[externalId]/page.tsx docs/card-detail.md
git commit -m "feat: paint card history as a ledger"
```

---

### Task 3: e2e — no dump

**Files:**
- Modify: `e2e/board.spec.ts` (the test `card title and hover pill open the card page with the full body`)

**Interfaces:**
- Consumes: heading `History` already asserted in that test
- Produces: same test also asserts the History **section** does not contain `"from_lane"` or `"hash"`

- [ ] **Step 1: Extend the existing card-page test**

In `e2e/board.spec.ts`, keep the heading assertion and add, immediately after it:

```ts
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History$/i }),
  });
  await expect(history).not.toContainText('"from_lane"');
  await expect(history).not.toContainText('"hash"');
```

Do not assert on `{` — a comment preview can contain one.

- [ ] **Step 2: Run the spec**

Run: `bun run test:e2e e2e/board.spec.ts`

Expected: PASS (needs local Supabase + `.env.local`, same as the rest of board e2e). If the environment cannot run Playwright, still land the assertion; do not skip it.

- [ ] **Step 3: Commit**

```bash
git add e2e/board.spec.ts
git commit -m "test: history section is not a json dump"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| Date-gutter ledger, three columns | 2 |
| No JSON / no disclosure | 1, 2, 3 |
| Clock format, year rule, invalid `—`, local zone | 1 (logic), 2 (`suppressHydrationWarning`, no `timeZone`) |
| Kind pens | 1, 2 (`className={stat …}`) |
| Actor local-part / etl / someone | 1 |
| moved / imported / created / edited / archived / restored / commented / unknown | 1 |
| created miss shows the key, not `a lane` | 1 |
| Empty `Nothing recorded.` Heading `History` | 2 |
| Cap 50 unchanged | 2 (do not touch the query) |
| `docs/card-detail.md` | 2 |
| bun tests | 1 |
| e2e no `"from_lane"` / `"hash"` | 3 |
| No new tokens / writes / pagination | all (omitted) |
