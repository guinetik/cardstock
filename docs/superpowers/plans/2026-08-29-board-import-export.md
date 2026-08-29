# Board import and export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An owner or project admin can drop a zip of `<n>.md` sheets onto a board (or, as owner, onto the projects page to make a new project), see a dry-run table, confirm, and later download the board back as a zip where untouched sheets are byte-identical and edited ones differ only where the board made a mark.

**Architecture:** The frontmatter contract (zod schema, lenient parser, tag mapping, writer) moves from `etl/` to `src/lib/frontmatter/` so the app and the CLI share one set of rules. A pure planner (`src/lib/import/plan.ts`) turns files + board state into a `Plan`; an applier writes it through the member's RLS client. Export is a line edit of the stored sheet (`cards.source_text`), never a render of the row unless there is no sheet. Server actions and one route handler expose it; two dialogs on the projects page drive it.

**Tech Stack:** bun · Next.js 16 App Router (server actions, route handlers) · React 19 · Supabase (RLS, `@supabase/ssr`) · zod 4 · `fflate` (zip, pure JS) · `bun test` · Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-board-import-export-design.md`

## Global Constraints

- The sheet wins on import; a key absent from the file leaves the board's value alone; import never deletes cards, lanes or tags; one invalid file blocks the whole import.
- Apply re-plans server-side from the same upload; nothing from the browser is trusted.
- `cards.source_text` is the base for export, not the truth. After export it is rebased to the exported text and `lane_from_source` to the lane key.
- `frontmatterSchema` is the contract: it validates, decides new-file key order, generates `docs/frontmatter.schema.json` and the dialog's instructions. `tracker-item` is no longer required.
- New lanes are `kind: 'work'`, named from the key, inserted before the first built/done/archive lane. `group:tag` refs create groups/tags; bare tags no group declares are reported as *not applied*, never guessed.
- Upload cap 4 MB (`MAX_UPLOAD_BYTES = 4 * 1024 * 1024`). Only entries whose basename matches `/^\d+\.md$/` count; any folder depth.
- Board import/export: owner or project admin. Project import: owner only.
- Paper, not shadcn defaults: verdicts are `.stat` in pen (`stat--success` new, `stat--wip` changed, plain unchanged, `stat--blocked` error); ids in mono; no toasts — errors render on the sheet.
- Existing e2e selectors stay stable: "Import project", "New project", "New board", label "Name".
- `bun run check` (biome + tsc) must be green at every commit. Commit messages end with `Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s`.
- Do not touch the user's uncommitted binder work beyond what a task names (`src/components/binder.tsx` is modified in Task 9 only, additively).

---

## File structure

| Path | Responsibility |
|---|---|
| `src/lib/frontmatter/schema.ts` | zod contract, `STATUSES`, `KNOWN_KEYS`, `MANAGED_KEYS`, `validateFrontmatter`, `jsonSchema`, `isoOrNull` (moved from `etl/schema.ts`; refine dropped) |
| `src/lib/frontmatter/parse.ts` | `parseFile`, `extractAsk`, `bodyWithoutH1`, `dequote` (moved) |
| `src/lib/frontmatter/mapping.ts` | tag/audience/lane rules (moved from `etl/mapping.ts`) |
| `src/lib/frontmatter/sheet.ts` | `CardSheet` — one card in file form — `sheetFromFrontmatter`, `diffSheets`, `SHEET_KEYS` |
| `src/lib/frontmatter/write.ts` | `cardToMarkdown`, `writeSheet`, `formatScalar` (replaces `etl/frontmatter-write.ts`) |
| `src/lib/frontmatter/schema-discipline.test.ts` | `docs/frontmatter.schema.json` equals `jsonSchema()` |
| `src/lib/import/types.ts` | `SheetFile`, `BoardState`, `ExistingCard`, `Plan`, `PlanRow`, `Change` |
| `src/lib/import/zip.ts` | `filesFromZip` (fflate) |
| `src/lib/import/plan.ts` | `planImport` — pure |
| `src/lib/import/apply.ts` | `applyPlan` — writes through a Supabase client |
| `src/lib/import/board-state.ts` | `loadBoardState(db, boardId)` — the planner's input from the DB |
| `src/app/import-actions.ts` | `planBoardImport`, `applyBoardImport`, `planProjectImport`, `applyProjectImport` |
| `src/app/p/[project]/b/[board]/export.zip/route.ts` | zip download + rebase |
| `src/components/import-plan-table.tsx` | the dry-run table, shared by both dialogs |
| `src/components/sheet-contract.tsx` | the instructions panel rendered from the schema |
| `src/components/board-import-dialog.tsx` | drop → plan → done, for one board |
| `src/components/import-project-dialog.tsx` | rewritten: drop + names → plan → create |
| `src/components/binder.tsx` | ↓ / ↑ on each board tab |
| `supabase/migrations/20260906000000_source_text.sql` | `cards.source_text` |
| `etl/schema.ts`, `etl/parse.ts`, `etl/mapping.ts`, `etl/frontmatter-write.ts` | re-export shims (kept so `etl/*.test.ts` and scripts keep their imports) |
| `etl/import.ts`, `etl/export.ts` | rebuilt on the shared modules |

---

### Task 1: Move the frontmatter contract into `src/lib/frontmatter/` and drop `tracker-item`

**Files:**
- Create: `src/lib/frontmatter/schema.ts`, `src/lib/frontmatter/parse.ts`, `src/lib/frontmatter/mapping.ts`, `src/lib/frontmatter/schema-discipline.test.ts`
- Modify: `etl/schema.ts`, `etl/parse.ts`, `etl/mapping.ts` (become re-export shims), `etl/etl.test.ts:92`, `etl/emit-schema.ts`, `docs/frontmatter.schema.json` (regenerated), `README.md` (ETL table row for `etl:schema` unchanged; no text change needed)

**Interfaces:**
- Produces: `frontmatterSchema`, `Frontmatter`, `STATUSES`, `KNOWN_KEYS: Set<string>`, `validateFrontmatter(raw, file?) → { data: Frontmatter; extra: Record<string, unknown> }`, `jsonSchema()`, `isoOrNull(v) → string | null` from `@/lib/frontmatter/schema`; `parseFile(text) → { frontmatter; body; hash }`, `extractAsk(body)`, `bodyWithoutH1(body)`, `dequote` from `@/lib/frontmatter/parse`; everything `etl/mapping.ts` exports today from `@/lib/frontmatter/mapping`.

- [ ] **Step 1: Move the three modules with `git mv`**

```bash
mkdir -p src/lib/frontmatter
git mv etl/schema.ts src/lib/frontmatter/schema.ts
git mv etl/parse.ts src/lib/frontmatter/parse.ts
git mv etl/mapping.ts src/lib/frontmatter/mapping.ts
```

- [ ] **Step 2: Fix the moved files' relative imports**

In `src/lib/frontmatter/schema.ts` change `from "../src/lib/card-color"` to `from "@/lib/card-color"`. In `src/lib/frontmatter/mapping.ts` change `from "../src/lib/card-color"` to `from "@/lib/card-color"` and `from "./schema"` stays.

- [ ] **Step 3: Drop the `tracker-item` refine**

In `src/lib/frontmatter/schema.ts` replace

```ts
  tags: strList.refine((t) => t.includes("tracker-item"), {
    message: "tags must include tracker-item",
  }),
```

with

```ts
  tags: strList,
```

- [ ] **Step 4: Write the re-export shims in `etl/`**

`etl/schema.ts`:
```ts
export * from "../src/lib/frontmatter/schema";
```
`etl/parse.ts`:
```ts
export * from "../src/lib/frontmatter/parse";
```
`etl/mapping.ts`:
```ts
export * from "../src/lib/frontmatter/mapping";
```

- [ ] **Step 5: Update the test that expected the refine**

In `etl/etl.test.ts` find the test around line 92 that asserts `.toThrow(/tracker-item/)`. Replace that assertion so the file without `tracker-item` validates:

```ts
  test("tags need not include tracker-item", () => {
    const { data } = validateFrontmatter({
      id: 1,
      title: "t",
      status: "backlog",
      epic: "e",
      area: "a",
      tags: ["bug"],
    });
    expect(data.tags).toEqual(["bug"]);
  });
```

(Keep the rest of that `describe` intact; only the assertion that a missing `tracker-item` throws is removed.)

- [ ] **Step 6: Write the drift test**

`src/lib/frontmatter/schema-discipline.test.ts`:
```ts
import { expect, test } from "bun:test";
import { jsonSchema } from "./schema";

/** docs/frontmatter.schema.json is generated; this fails when it goes stale. Regenerate with `bun run etl:schema`. */
test("docs/frontmatter.schema.json matches the zod contract", async () => {
  const onDisk = JSON.parse(
    await Bun.file("docs/frontmatter.schema.json").text(),
  );
  expect(onDisk).toEqual(jsonSchema());
});
```

- [ ] **Step 7: Regenerate the JSON schema and run the tests**

Run: `bun run etl:schema && bun test`
Expected: `wrote docs/frontmatter.schema.json`; all tests pass including the discipline test. `git diff docs/frontmatter.schema.json` should show no `tracker-item` reference any more.

- [ ] **Step 8: Check and commit**

Run: `bun run check`
Expected: no errors.

```bash
git add -A src/lib/frontmatter etl/schema.ts etl/parse.ts etl/mapping.ts etl/etl.test.ts docs/frontmatter.schema.json
git commit -m "frontmatter: the contract lives in src/lib, tracker-item is an ordinary tag

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 2: `CardSheet` — one card in file form, and the diff between two of them

**Files:**
- Create: `src/lib/frontmatter/sheet.ts`, `src/lib/frontmatter/sheet.test.ts`

**Interfaces:**
- Consumes: `Frontmatter`, `isoOrNull` (Task 1), `valueToPriority`, `extractAsk`, `bodyWithoutH1`.
- Produces:
  ```ts
  export interface CardSheet {
    externalId: string; title: string; status: string; epic: string; area: string;
    tags: string[];              // board refs `group:tag`, or bare when unresolved
    raisedBy: string | null; raisedOn: string | null; shippedOn: string | null;
    needs: string | null; summary: string | null; relates: number[];
    lane: string | null; rank: number | null; priority: 1 | 2 | 3 | null;
    effort: "L" | "M" | "H" | null; plannedStart: string | null;
    target: string | null;       // ISO date or the rough label
    archived: string | null; archivedBy: string | null; color: string | null;
    extra: Record<string, unknown>; bodyMd: string;
  }
  export type SheetKey = keyof typeof SHEET_KEYS;   // frontmatter key names
  export interface Change { key: SheetKey | "body"; from: string | null; to: string | null }
  export function sheetFromFrontmatter(fm: Frontmatter, extra, body: string, tagRefs: string[]): CardSheet
  export function presentKeys(raw: Record<string, unknown>): Set<SheetKey | "body">
  export function diffSheets(file: CardSheet, board: CardSheet, present: Set<SheetKey | "body">): Change[]
  export const SHEET_KEYS: Record<string, { get(s: CardSheet): string | string[] | number | null }>
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/frontmatter/sheet.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { parseFile } from "./parse";
import { validateFrontmatter } from "./schema";
import { diffSheets, presentKeys, sheetFromFrontmatter } from "./sheet";

const FILE = `---
id: 7
title: Rename the button
status: backlog
epic: Billing
area: Product
value: H
target: 2026-10-01
custom: keep
tags:
  - kind:bug
---
# #7 — Rename the button

## Ask

Please.
`;

function load(text: string) {
  const parsed = parseFile(text);
  const { data, extra } = validateFrontmatter(parsed.frontmatter);
  return {
    sheet: sheetFromFrontmatter(data, extra, parsed.body, data.tags),
    present: presentKeys(parsed.frontmatter),
  };
}

describe("sheetFromFrontmatter", () => {
  test("maps value to priority, keeps extra, strips the H1", () => {
    const { sheet } = load(FILE);
    expect(sheet.priority).toBe(1);
    expect(sheet.extra).toEqual({ custom: "keep" });
    expect(sheet.bodyMd.startsWith("## Ask")).toBe(true);
    expect(sheet.summary).toBe("Please.");
    expect(sheet.target).toBe("2026-10-01");
  });
});

describe("presentKeys", () => {
  test("value counts as priority; body is always present", () => {
    const { present } = load(FILE);
    expect(present.has("priority")).toBe(true);
    expect(present.has("effort")).toBe(false);
    expect(present.has("body")).toBe(true);
  });
});

describe("diffSheets", () => {
  test("reports only keys the file states and that differ", () => {
    const { sheet, present } = load(FILE);
    const board = { ...sheet, priority: 2 as const, effort: "M" as const, title: "Old" };
    const changes = diffSheets(sheet, board, present);
    expect(changes).toEqual([
      { key: "title", from: "Old", to: "Rename the button" },
      { key: "priority", from: "2", to: "1" },
    ]);
  });
  test("tags compare as a set, body as text", () => {
    const { sheet, present } = load(FILE);
    const board = { ...sheet, tags: ["kind:bug", "area:billing"], bodyMd: "## Ask\n\nNo." };
    const changes = diffSheets(sheet, board, present);
    expect(changes.map((c) => c.key)).toEqual(["tags", "body"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/lib/frontmatter/sheet.test.ts`
Expected: FAIL — cannot resolve `./sheet`.

- [ ] **Step 3: Implement `sheet.ts`**

```ts
/**
 * A card as a sheet: the values a tracker file states, in file form.
 *
 * Both halves of the round trip speak this shape. Import builds one from a
 * file and compares it with one built from the row; export builds one from
 * the row and writes only the keys that differ from the file it was given.
 */
import { extractAsk, bodyWithoutH1 } from "./parse";
import { valueToPriority } from "./mapping";
import { type Frontmatter, isoOrNull } from "./schema";

export interface CardSheet {
  externalId: string;
  title: string;
  status: string;
  epic: string;
  area: string;
  tags: string[];
  raisedBy: string | null;
  raisedOn: string | null;
  shippedOn: string | null;
  needs: string | null;
  summary: string | null;
  relates: number[];
  lane: string | null;
  rank: number | null;
  priority: 1 | 2 | 3 | null;
  effort: "L" | "M" | "H" | null;
  plannedStart: string | null;
  target: string | null;
  archived: string | null;
  archivedBy: string | null;
  color: string | null;
  extra: Record<string, unknown>;
  bodyMd: string;
}

type Scalar = string | number | null;
type Value = Scalar | string[] | number[];

/**
 * Frontmatter key → how to read it off a sheet. The order here is the order
 * new files are written in and the order appended keys take.
 */
export const SHEET_KEYS = {
  title: { get: (s: CardSheet) => s.title },
  status: { get: (s: CardSheet) => s.status },
  epic: { get: (s: CardSheet) => s.epic },
  area: { get: (s: CardSheet) => s.area },
  raised_by: { get: (s: CardSheet) => s.raisedBy },
  raised: { get: (s: CardSheet) => s.raisedOn },
  shipped: { get: (s: CardSheet) => s.shippedOn },
  needs: { get: (s: CardSheet) => s.needs },
  summary: { get: (s: CardSheet) => s.summary },
  relates: { get: (s: CardSheet) => s.relates },
  tags: { get: (s: CardSheet) => s.tags },
  lane: { get: (s: CardSheet) => s.lane },
  rank: { get: (s: CardSheet) => s.rank },
  priority: { get: (s: CardSheet) => s.priority },
  effort: { get: (s: CardSheet) => s.effort },
  planned_start: { get: (s: CardSheet) => s.plannedStart },
  target: { get: (s: CardSheet) => s.target },
  archived: { get: (s: CardSheet) => s.archived },
  archived_by: { get: (s: CardSheet) => s.archivedBy },
  color: { get: (s: CardSheet) => s.color },
} as const satisfies Record<string, { get(s: CardSheet): Value }>;

export type SheetKey = keyof typeof SHEET_KEYS;
export const SHEET_KEY_ORDER = Object.keys(SHEET_KEYS) as SheetKey[];

export interface Change {
  key: SheetKey | "body";
  from: string | null;
  to: string | null;
}

/** Build a sheet from validated frontmatter. `tagRefs` are the file's tags already resolved to board refs. */
export function sheetFromFrontmatter(
  fm: Frontmatter,
  extra: Record<string, unknown>,
  body: string,
  tagRefs: string[],
): CardSheet {
  const iso = (v: string | null | undefined) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
  const bodyMd = bodyWithoutH1(body);
  return {
    externalId: String(fm.id),
    title: fm.title,
    status: fm.status,
    epic: fm.epic,
    area: fm.area,
    tags: tagRefs,
    raisedBy: fm.raised_by ?? null,
    raisedOn: isoOrNull(fm.raised),
    shippedOn: isoOrNull(fm.shipped),
    needs: fm.needs ?? null,
    summary: fm.summary ?? (extractAsk(body) || null),
    relates: fm.relates ?? [],
    lane: fm.lane ?? null,
    rank: fm.rank ?? null,
    priority: (fm.priority as 1 | 2 | 3 | undefined) ?? valueToPriority(fm.value ?? null),
    effort: fm.effort ?? null,
    plannedStart: isoOrNull(fm.planned_start),
    target: fm.target ? (iso(fm.target) ?? fm.target) : null,
    archived: fm.archived ?? null,
    archivedBy: fm.archived ? (fm.archived_by ?? null) : null,
    color: fm.color ?? null,
    extra,
    bodyMd,
  };
}

/** Which sheet keys a raw frontmatter states. `value` states priority; the body is always stated. */
export function presentKeys(raw: Record<string, unknown>): Set<SheetKey | "body"> {
  const present = new Set<SheetKey | "body">(["body"]);
  for (const k of Object.keys(raw)) {
    if (k in SHEET_KEYS) present.add(k as SheetKey);
    if (k === "value") present.add("priority");
  }
  // summary is derived from the body when absent, so it is only "stated" when written
  if (!("summary" in raw)) present.delete("summary");
  return present;
}

function norm(v: Value): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return [...(v as (string | number)[])].map(String).sort().join(",");
  return String(v).trim();
}

/** The changes the board would take from the file: keys the file states whose value differs. */
export function diffSheets(
  file: CardSheet,
  board: CardSheet,
  present: Set<SheetKey | "body">,
): Change[] {
  const changes: Change[] = [];
  for (const key of SHEET_KEY_ORDER) {
    if (!present.has(key)) continue;
    const from = norm(SHEET_KEYS[key].get(board));
    const to = norm(SHEET_KEYS[key].get(file));
    if (from !== to) changes.push({ key, from, to });
  }
  if (present.has("body") && file.bodyMd !== board.bodyMd)
    changes.push({ key: "body", from: null, to: null });
  return changes;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/lib/frontmatter/sheet.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add src/lib/frontmatter/sheet.ts src/lib/frontmatter/sheet.test.ts
git commit -m "frontmatter: CardSheet, a card in file form, and the diff between two

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 3: `cardToMarkdown` and `writeSheet` — the writer

**Files:**
- Create: `src/lib/frontmatter/write.ts`, `src/lib/frontmatter/write.test.ts`
- Leave alone: `etl/frontmatter-write.ts` and `etl/export.test.ts` keep working as they are; Task 11 deletes both once the CLI runs on the new writer.

**Interfaces:**
- Consumes: `CardSheet`, `SHEET_KEYS`, `SHEET_KEY_ORDER` (Task 2), `parseFile`, `bodyWithoutH1`, `dequote`.
- Produces:
  ```ts
  export const MANAGED_KEYS = ["lane","rank","priority","effort","planned_start","target","archived","archived_by","color"] as const;
  export function formatScalar(v: string | number): string
  export function cardToMarkdown(sheet: CardSheet): string
  export function writeSheet(sourceText: string, sheet: CardSheet, opts?: { tagRef?: (tag: string) => string | null }): string
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/frontmatter/write.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { parseFile } from "./parse";
import { validateFrontmatter } from "./schema";
import { type CardSheet, sheetFromFrontmatter } from "./sheet";
import { cardToMarkdown, writeSheet } from "./write";

const FILE = `---
id: 152
title: "Filter what to sync — drop the yes/no gate"
status: backlog
epic: Validation Tables
area: Designer
raised_by: Sam
raised: 2026-08-21
effort: L
target: after the September release
relates: [63, 78]
custom_key: keep me
tags:
  - designer
  - wizard
lane: next
rank: 2
---
# #152 — Filter what to sync

## Ask

Body stays byte-identical.
`;

function sheetOf(text: string): CardSheet {
  const p = parseFile(text);
  const { data, extra } = validateFrontmatter(p.frontmatter);
  return sheetFromFrontmatter(data, extra, p.body, data.tags);
}

describe("writeSheet", () => {
  test("a sheet the board agrees with comes back byte-identical", () => {
    expect(writeSheet(FILE, sheetOf(FILE))).toBe(FILE);
  });
  test("a changed priority rewrites one line, appended in schema order", () => {
    const out = writeSheet(FILE, { ...sheetOf(FILE), priority: 1 });
    const a = FILE.split("\n");
    const b = out.split("\n");
    expect(b.filter((l) => !a.includes(l))).toEqual(["priority: 1"]);
    expect(b.indexOf("priority: 1")).toBe(b.indexOf("rank: 2") + 1);
  });
  test("a changed key present in the file is rewritten in place", () => {
    const out = writeSheet(FILE, { ...sheetOf(FILE), lane: "now", rank: 1 });
    const lines = out.split("\n");
    expect(lines[lines.indexOf("custom_key: keep me") + 4]).toBe("lane: now");
    expect(lines).toContain("rank: 1");
    expect(lines).not.toContain("lane: next");
  });
  test("a nulled key is removed", () => {
    const out = writeSheet(FILE, { ...sheetOf(FILE), effort: null });
    expect(out).not.toContain("effort:");
    expect(out).toContain("raised: 2026-08-21");
  });
  test("tags keep file order and append new refs", () => {
    const out = writeSheet(FILE, {
      ...sheetOf(FILE),
      tags: ["wizard", "designer", "kind:bug"],
    });
    expect(out).toContain("tags:\n  - designer\n  - wizard\n  - kind:bug\n");
  });
  test("an appended comment is written as an append", () => {
    const s = sheetOf(FILE);
    const out = writeSheet(FILE, {
      ...s,
      bodyMd: `${s.bodyMd}\n\n## Comments\n\n### 2026-08-29 10:00 · joao\n\n> Looks good.`,
    });
    expect(out.startsWith(FILE.replace(/\n$/, ""))).toBe(true);
    expect(out.endsWith("> Looks good.\n")).toBe(true);
  });
  test("an edited body is replaced with the H1 restored", () => {
    const out = writeSheet(FILE, { ...sheetOf(FILE), bodyMd: "## Ask\n\nNew." });
    expect(out.endsWith("---\n# #152 — Filter what to sync — drop the yes/no gate\n\n## Ask\n\nNew.\n")).toBe(true);
  });
  test("unknown keys survive, CRLF stays CRLF", () => {
    const crlf = FILE.replace(/\n/g, "\r\n");
    const out = writeSheet(crlf, { ...sheetOf(crlf), priority: 2 });
    expect(out).toContain("custom_key: keep me\r\n");
    expect(out.split("\r\n").join("").includes("\n")).toBe(false);
  });
});

describe("cardToMarkdown", () => {
  test("writes schema order, extras, managed block, H1, body — and round-trips", () => {
    const s = sheetOf(FILE);
    const out = cardToMarkdown(s);
    expect(out.startsWith("---\nid: 152\ntitle:")).toBe(true);
    expect(out).toContain("custom_key: keep me");
    expect(out).toContain("# #152 — Filter what to sync — drop the yes/no gate");
    expect(sheetOf(out)).toEqual(s);
    expect(writeSheet(out, s)).toBe(out);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/lib/frontmatter/write.test.ts`
Expected: FAIL — cannot resolve `./write`.

- [ ] **Step 3: Implement `write.ts`**

```ts
/**
 * Writing a sheet back out.
 *
 * `writeSheet` is a line edit: it takes the file that was handed to us and
 * rewrites only the keys whose value the board disagrees with, in place.
 * Every other byte — quoting, order, comments, unknown keys, the body — is
 * left alone. `cardToMarkdown` builds a file from nothing, for a card that
 * never had one.
 */
import { bodyWithoutH1, dequote, parseFile } from "./parse";
import { type CardSheet, SHEET_KEY_ORDER, SHEET_KEYS, type SheetKey } from "./sheet";

export const MANAGED_KEYS = [
  "lane",
  "rank",
  "priority",
  "effort",
  "planned_start",
  "target",
  "archived",
  "archived_by",
  "color",
] as const;

/** Quote only when the tracker's lenient parser would otherwise misread the value. */
export function formatScalar(v: string | number): string {
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
  const s = String(v);
  if (/^[\w./:@ -]*$/.test(s) && !s.startsWith("[") && !s.includes(": "))
    return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const KEY_LINE = /^([A-Za-z_][\w-]*):/;

type Value = string | number | null | (string | number)[];

function fileLines(key: string, value: Value, indent: string): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return [`${key}:`, ...value.map((v) => `${indent}- ${formatScalar(v)}`)];
  }
  return [`${key}: ${formatScalar(value)}`];
}

/** Where `key` sits in the frontmatter: its line and any `- item` lines under it. */
function locate(fm: string[], key: string): { start: number; end: number; indent: string } | null {
  for (let i = 0; i < fm.length; i++) {
    const m = KEY_LINE.exec(fm[i]);
    if (!m || m[1] !== key) continue;
    let end = i + 1;
    let indent = "  ";
    while (end < fm.length && fm[end].trim().startsWith("- ")) {
      indent = fm[end].slice(0, fm[end].indexOf("-"));
      end++;
    }
    return { start: i, end, indent };
  }
  return null;
}

function norm(v: Value): string | null {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).sort().join(",");
  return String(v).trim();
}

/** Split a file into frontmatter lines (between the fences), the fence index, and the body lines. */
function split(text: string) {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---")
    throw new Error("file does not open with a --- frontmatter fence");
  let end = -1;
  for (let i = 1; i < lines.length; i++)
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  if (end < 0) throw new Error("frontmatter fence is never closed");
  return { nl, fm: lines.slice(1, end), body: lines.slice(end + 1) };
}

/**
 * The file as it was handed to us, with the board's marks written in.
 *
 * @param sourceText - The stored sheet (`cards.source_text`).
 * @param sheet - The card as the board has it now.
 * @param opts.tagRef - Resolve a bare tag in the file to a board ref, so `bug` and `kind:bug` compare equal.
 */
export function writeSheet(
  sourceText: string,
  sheet: CardSheet,
  opts: { tagRef?: (tag: string) => string | null } = {},
): string {
  const { nl, fm, body } = split(sourceText);
  const parsed = parseFile(sourceText).frontmatter;
  const tagRef = opts.tagRef ?? ((t: string) => t);

  // The file's own view of each key, normalised the way the sheet is.
  const have = (key: SheetKey): Value => {
    const raw = parsed[key];
    if (key === "tags")
      return ((raw as string[] | undefined) ?? []).map((t) => tagRef(t) ?? t);
    if (key === "priority" && raw == null && parsed.value != null) {
      const v = String(parsed.value).trim().toUpperCase()[0];
      return v === "H" ? 1 : v === "M" ? 2 : v === "L" ? 3 : null;
    }
    if (Array.isArray(raw)) return raw.map((x) => String(dequote(x)));
    return raw == null ? null : (dequote(raw) as string);
  };

  let lines = [...fm];
  const append: string[] = [];
  for (const key of SHEET_KEY_ORDER) {
    const want = SHEET_KEYS[key].get(sheet) as Value;
    if (norm(want) === norm(have(key))) continue;
    const at = locate(lines, key);
    if (at) {
      let replacement: string[];
      if (key === "tags") {
        // keep the file's own lines for tags that survive, append the new refs
        const fileTags = ((parsed.tags as string[] | undefined) ?? []);
        const wanted = new Set((want as string[]) ?? []);
        const kept = lines.slice(at.start + 1, at.end).filter((ln, i) => {
          const t = fileTags[i];
          return t != null && wanted.has(tagRef(t) ?? t);
        });
        const keptRefs = new Set(fileTags.map((t) => tagRef(t) ?? t).filter((r) => wanted.has(r)));
        const added = ((want as string[]) ?? []).filter((r) => !keptRefs.has(r));
        replacement = kept.length + added.length
          ? [`${key}:`, ...kept, ...added.map((r) => `${at.indent}- ${formatScalar(r)}`)]
          : [];
      } else replacement = fileLines(key, want, at.indent);
      lines.splice(at.start, at.end - at.start, ...replacement);
    } else append.push(...fileLines(key, want, "  "));
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines = [...lines, ...append];

  // Body: untouched, appended to, or replaced — in that order of preference.
  const srcBody = body.join("\n");
  const base = bodyWithoutH1(srcBody);
  let outBody: string[];
  if (sheet.bodyMd === base) outBody = body;
  else if (base && sheet.bodyMd.startsWith(base)) {
    const tail = sheet.bodyMd.slice(base.length).replace(/^\n+/, "");
    const trimmed = [...body];
    while (trimmed.length && !trimmed[trimmed.length - 1].trim()) trimmed.pop();
    outBody = [...trimmed, "", ...tail.split("\n"), ""];
  } else {
    outBody = [
      `# #${sheet.externalId} — ${sheet.title}`,
      "",
      ...sheet.bodyMd.replace(/\n+$/, "").split("\n"),
      "",
    ];
  }
  const out = ["---", ...lines, "---", ...outBody].join(nl);
  const hadTrailing = /\r?\n$/.test(sourceText);
  return hadTrailing ? (out.endsWith(nl) ? out : out + nl) : out.replace(/(\r?\n)+$/, "");
}

/** A complete file for a card that never had one: schema order, extras, managed keys, H1, body. */
export function cardToMarkdown(sheet: CardSheet): string {
  const lines: string[] = ["---", `id: ${sheet.externalId}`];
  const managed = new Set<string>(MANAGED_KEYS);
  for (const key of SHEET_KEY_ORDER)
    if (!managed.has(key))
      lines.push(...fileLines(key, SHEET_KEYS[key].get(sheet) as Value, "  "));
  for (const [k, v] of Object.entries(sheet.extra))
    lines.push(...fileLines(k, v as Value, "  "));
  for (const key of MANAGED_KEYS)
    lines.push(...fileLines(key, SHEET_KEYS[key].get(sheet) as Value, "  "));
  lines.push("---", `# #${sheet.externalId} — ${sheet.title}`, "", sheet.bodyMd.replace(/\n+$/, ""));
  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Run to verify pass; iterate on the line arithmetic until every test passes**

Run: `bun test src/lib/frontmatter/write.test.ts`
Expected: PASS (9 tests). The "in place" test asserts `lane: now` sits four lines under `custom_key` (after `tags:` and its two items) — if it lands elsewhere the `locate` end index is off.

- [ ] **Step 5: Check and commit**

```bash
bun run check && bun test
git add src/lib/frontmatter/write.ts src/lib/frontmatter/write.test.ts
git commit -m "frontmatter: writeSheet — the sheet you handed us plus the board's marks

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---
### Task 4: Reading sheets out of a zip

**Files:**
- Create: `src/lib/import/types.ts`, `src/lib/import/zip.ts`, `src/lib/import/zip.test.ts`
- Modify: `package.json` (dependency `fflate`)

**Interfaces:**
- Produces: `SheetFile { name: string; text: string }`, `MAX_UPLOAD_BYTES`, `filesFromZip(bytes: Uint8Array) → SheetFile[]` (throws `Error` with a human message: "That zip has no <n>.md files", "The upload is over 4 MB — use the command line for a tracker that size").

- [ ] **Step 1: Install fflate**

Run: `bun add fflate`
Expected: `fflate` in `dependencies`.

- [ ] **Step 2: Write `types.ts`**

```ts
import type { Change } from "@/lib/frontmatter/sheet";

export interface SheetFile {
  /** `<n>.md`, folder stripped. */
  name: string;
  text: string;
}

export interface BoardLane {
  id: string;
  key: string;
  name: string;
  kind: string;
  position: number;
}
export interface BoardGroup {
  id: string;
  key: string;
  name: string;
  position: number;
  color: string | null;
  tags: { id: string; key: string; name: string }[];
}
/** The columns the planner compares and the applier patches. */
export interface ExistingCard {
  id: string;
  external_id: string;
  title: string;
  status: string;
  epic: string | null;
  area: string | null;
  raised_by: string | null;
  raised_on: string | null;
  shipped_on: string | null;
  needs: string | null;
  summary: string | null;
  body_md: string | null;
  lane_id: string | null;
  rank: number;
  priority: 1 | 2 | 3 | null;
  effort: "L" | "M" | "H" | null;
  planned_start_date: string | null;
  target_date: string | null;
  target_label: string | null;
  archived_at: string | null;
  archived_by: string | null;
  color: string | null;
  source_hash: string | null;
  frontmatter_extra: Record<string, unknown>;
  tag_ids: string[];
  relates: number[];
}
export interface BoardState {
  id: string;
  lanes: BoardLane[];
  groups: BoardGroup[];
  cards: Map<string, ExistingCard>;
  /** epic source_name → id */
  epics: Map<string, string>;
}

/** What the applier writes for one card. Lane and tags are keys/refs; the applier resolves ids after creating what is new. */
export interface CardPatch {
  columns: Record<string, unknown>;
  laneKey: string | null;
  /** undefined: keep the rank the board has (or append for a new card). */
  rank: number | undefined;
  tagRefs: string[] | undefined;
  relates: number[] | undefined;
  epic: string | undefined;
}

export type PlanRow =
  | { id: string; title: string; verdict: "new"; lane: string; changes: Change[]; patch: CardPatch; hash: string }
  | { id: string; title: string; verdict: "changed"; changes: Change[]; patch: CardPatch; hash: string }
  | { id: string; title: string; verdict: "unchanged" }
  | { id: string; title?: string; verdict: "error"; message: string };

export interface Plan {
  ok: boolean;
  rows: PlanRow[];
  newLanes: { key: string; name: string }[];
  newGroups: { key: string; name: string }[];
  newTags: { groupKey: string; key: string; name: string }[];
  unappliedTags: { tag: string; cards: string[] }[];
  ambiguousTags: { tag: string; cards: string[] }[];
  counts: { new: number; changed: number; unchanged: number; error: number };
}
```

- [ ] **Step 3: Write the failing test**

`src/lib/import/zip.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import { filesFromZip, MAX_UPLOAD_BYTES } from "./zip";

const enc = (s: string) => new TextEncoder().encode(s);

describe("filesFromZip", () => {
  test("keeps <n>.md at any depth, ignores the rest, sorts by id", () => {
    const zip = zipSync({
      "tracker/10.md": enc("---\nid: 10\n---\n"),
      "tracker/2.md": enc("---\nid: 2\n---\n"),
      "tracker/README.md": enc("# no"),
      "notes.txt": enc("no"),
      "tracker/nested/3.md": enc("---\nid: 3\n---\n"),
    });
    expect(filesFromZip(zip).map((f) => f.name)).toEqual(["2.md", "3.md", "10.md"]);
    expect(filesFromZip(zip)[0].text).toBe("---\nid: 2\n---\n");
  });
  test("rejects a zip with no sheets", () => {
    expect(() => filesFromZip(zipSync({ "a.txt": enc("x") }))).toThrow(/no <n>\.md/);
  });
  test("rejects an oversized upload before unzipping", () => {
    expect(() => filesFromZip(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toThrow(/over 4 MB/);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `bun test src/lib/import/zip.test.ts`
Expected: FAIL — cannot resolve `./zip`.

- [ ] **Step 5: Implement `zip.ts`**

```ts
import { unzipSync } from "fflate";
import type { SheetFile } from "./types";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const SHEET = /(^|\/)(\d+)\.md$/;

/** The sheets in an upload: every `<n>.md` at any depth, sorted by id. Everything else is ignored. */
export function filesFromZip(bytes: Uint8Array): SheetFile[] {
  if (bytes.byteLength > MAX_UPLOAD_BYTES)
    throw new Error("The upload is over 4 MB — use the command line for a tracker that size.");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("That file is not a zip.");
  }
  const dec = new TextDecoder("utf-8");
  const files: SheetFile[] = [];
  for (const [path, data] of Object.entries(entries)) {
    const m = SHEET.exec(path);
    if (!m || path.endsWith("/")) continue;
    files.push({ name: `${m[2]}.md`, text: dec.decode(data) });
  }
  if (!files.length) throw new Error("That zip has no <n>.md files.");
  return files.sort((a, b) => Number.parseInt(a.name, 10) - Number.parseInt(b.name, 10));
}
```

- [ ] **Step 6: Run to verify pass, check, commit**

Run: `bun test src/lib/import/zip.test.ts && bun run check`
Expected: PASS (3 tests).

```bash
git add package.json bun.lock src/lib/import/types.ts src/lib/import/zip.ts src/lib/import/zip.test.ts
git commit -m "import: read sheets out of a zip

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 5: The planner

**Files:**
- Create: `src/lib/import/plan.ts`, `src/lib/import/plan.test.ts`

**Interfaces:**
- Consumes: Task 2 (`sheetFromFrontmatter`, `presentKeys`, `diffSheets`), Task 1 (`parseFile`, `validateFrontmatter`, `buildVocabulary`, `mapTags`, `mapAudience`, `laneForNewCard`, `valueToPriority`, `isoOrNull`), Task 4 types.
- Produces: `planImport(files: SheetFile[], state: BoardState) → Plan`, `sheetFromCard(card: ExistingCard, state: BoardState) → CardSheet`, `DEFAULT_MAPPING`, `laneNameFromKey(key) → string`.

- [ ] **Step 1: Write the failing tests**

`src/lib/import/plan.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { planImport } from "./plan";
import type { BoardState, ExistingCard } from "./types";

const sheet = (id: number, fm: string, body = "## Ask\n\nHi.") =>
  ({ name: `${id}.md`, text: `---\nid: ${id}\ntitle: Card ${id}\nstatus: backlog\nepic: E\narea: A\n${fm}\n---\n# #${id} — Card ${id}\n\n${body}\n` });

function state(cards: Partial<ExistingCard>[] = []): BoardState {
  const base: ExistingCard = {
    id: "c", external_id: "1", title: "Card 1", status: "backlog", epic: "E", area: "A",
    raised_by: null, raised_on: null, shipped_on: null, needs: null, summary: "Hi.",
    body_md: "## Ask\n\nHi.", lane_id: "L-unsorted", rank: 1, priority: null, effort: null,
    planned_start_date: null, target_date: null, target_label: null, archived_at: null,
    archived_by: null, color: null, source_hash: null, frontmatter_extra: {}, tag_ids: [], relates: [],
  };
  return {
    id: "b",
    lanes: [
      { id: "L-unsorted", key: "unsorted", name: "Unsorted", kind: "inbox", position: 0 },
      { id: "L-now", key: "now", name: "Now", kind: "work", position: 1 },
      { id: "L-done", key: "done", name: "Done", kind: "done", position: 2 },
    ],
    groups: [{ id: "G-kind", key: "kind", name: "Kind", position: 0, color: null, tags: [{ id: "T-bug", key: "bug", name: "Bug" }] }],
    cards: new Map(cards.map((c) => [String(c.external_id ?? base.external_id), { ...base, ...c }])),
    epics: new Map([["E", "epic-1"]]),
  };
}

describe("planImport", () => {
  test("a new card lands in the lane it names, or the inbox", () => {
    const plan = planImport([sheet(5, "lane: now\nrank: 3"), sheet(6, "")], state());
    expect(plan.rows.map((r) => r.verdict)).toEqual(["new", "new"]);
    expect(plan.rows[0]).toMatchObject({ lane: "now", patch: { laneKey: "now", rank: 3 } });
    expect(plan.rows[1]).toMatchObject({ lane: "unsorted", patch: { rank: undefined } });
    expect(plan.counts).toEqual({ new: 2, changed: 0, unchanged: 0, error: 0 });
  });
  test("an existing card with the same hash is unchanged", () => {
    const f = sheet(1, "");
    const hash = new Bun.CryptoHasher("sha256").update(f.text).digest("hex");
    const plan = planImport([f], state([{ source_hash: hash }]));
    expect(plan.rows[0].verdict).toBe("unchanged");
  });
  test("the sheet wins; a key it does not state is left alone", () => {
    const plan = planImport([sheet(1, "priority: 1")], state([{ effort: "M" }]));
    const row = plan.rows[0];
    expect(row.verdict).toBe("changed");
    if (row.verdict !== "changed") throw new Error();
    expect(row.changes).toEqual([{ key: "priority", from: null, to: "1" }]);
    expect(row.patch.columns).toMatchObject({ priority: 1 });
    expect("effort" in row.patch.columns).toBe(false);
  });
  test("a changed body clears body_edited_at", () => {
    const plan = planImport([sheet(1, "", "## Ask\n\nChanged.")], state([{}]));
    const row = plan.rows[0];
    if (row.verdict !== "changed") throw new Error(row.verdict);
    expect(row.patch.columns).toMatchObject({ body_md: "## Ask\n\nChanged.", body_edited_at: null });
  });
  test("unknown lanes, groups and tags are listed to create; bare unknown tags are not applied", () => {
    const plan = planImport([sheet(9, "lane: gate-1\ntags:\n  - kind:bug\n  - step:filter\n  - mystery")], state());
    expect(plan.newLanes).toEqual([{ key: "gate-1", name: "Gate 1" }]);
    expect(plan.newGroups).toEqual([{ key: "step", name: "Step" }]);
    expect(plan.newTags).toEqual([{ groupKey: "step", key: "filter", name: "Filter" }]);
    expect(plan.unappliedTags).toEqual([{ tag: "mystery", cards: ["9"] }]);
  });
  test("one bad file blocks the plan", () => {
    const bad = { name: "4.md", text: "---\nid: 4\ntitle: x\n---\n" };
    const plan = planImport([bad, sheet(5, "")], state());
    expect(plan.ok).toBe(false);
    expect(plan.rows[0]).toMatchObject({ verdict: "error", id: "4" });
    expect(plan.rows[0].verdict === "error" && /status/.test(plan.rows[0].message)).toBe(true);
  });
  test("an id that does not match its filename is an error", () => {
    const plan = planImport([{ name: "4.md", text: sheet(5, "").text }], state());
    expect(plan.rows[0]).toMatchObject({ verdict: "error", message: expect.stringMatching(/filename/) });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test src/lib/import/plan.test.ts`
Expected: FAIL — cannot resolve `./plan`.

- [ ] **Step 3: Implement `plan.ts`**

```ts
/**
 * Dry run: what filing these sheets on this board would do. Pure — the same
 * files and board state always give the same plan, which is why the applier
 * can re-plan and trust its own result instead of the browser's.
 */
import {
  buildVocabulary,
  laneForNewCard,
  type Mapping,
  mapAudience,
  mapTags,
} from "@/lib/frontmatter/mapping";
import { bodyWithoutH1, extractAsk, parseFile } from "@/lib/frontmatter/parse";
import { validateFrontmatter } from "@/lib/frontmatter/schema";
import {
  type CardSheet,
  type Change,
  diffSheets,
  presentKeys,
  sheetFromFrontmatter,
} from "@/lib/frontmatter/sheet";
import type { BoardState, CardPatch, ExistingCard, Plan, PlanRow, SheetFile } from "./types";

export const DEFAULT_MAPPING: Mapping = {
  audience_internal_when: { tags: ["internal"] },
};

/** `gate-1` → `Gate 1`. */
export function laneNameFromKey(key: string): string {
  return key
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** The board's view of a card, in file form, for the diff. */
export function sheetFromCard(card: ExistingCard, state: BoardState): CardSheet {
  const lane = state.lanes.find((l) => l.id === card.lane_id);
  const refs: string[] = [];
  for (const g of state.groups)
    for (const t of g.tags) if (card.tag_ids.includes(t.id)) refs.push(`${g.key}:${t.key}`);
  return {
    externalId: card.external_id,
    title: card.title,
    status: card.status,
    epic: card.epic ?? "",
    area: card.area ?? "",
    tags: refs,
    raisedBy: card.raised_by,
    raisedOn: card.raised_on,
    shippedOn: card.shipped_on,
    needs: card.needs,
    summary: card.summary,
    relates: card.relates,
    lane: lane?.key ?? null,
    rank: card.rank,
    priority: card.priority,
    effort: card.effort,
    plannedStart: card.planned_start_date,
    target: card.target_date ?? card.target_label,
    archived: card.archived_at ? card.archived_at.slice(0, 19).replace("T", " ") : null,
    archivedBy: card.archived_at ? card.archived_by : null,
    color: card.color,
    extra: card.frontmatter_extra ?? {},
    bodyMd: card.body_md ?? "",
  };
}

/** DB columns for the sheet keys in `changes` (plus the ones every write carries). */
function columnsFor(sheet: CardSheet, changes: Change[], isNew: boolean, audience: "all" | "internal") {
  const keys = new Set(changes.map((c) => c.key));
  const cols: Record<string, unknown> = {};
  const set = (k: Change["key"], v: () => Record<string, unknown>) => {
    if (isNew || keys.has(k)) Object.assign(cols, v());
  };
  set("title", () => ({ title: sheet.title }));
  set("status", () => ({ status: sheet.status }));
  set("area", () => ({ area: sheet.area }));
  set("raised_by", () => ({ raised_by: sheet.raisedBy }));
  set("raised", () => ({ raised_on: sheet.raisedOn }));
  set("shipped", () => ({ shipped_on: sheet.shippedOn }));
  set("needs", () => ({ needs: sheet.needs }));
  set("summary", () => ({ summary: sheet.summary }));
  set("priority", () => ({ priority: sheet.priority }));
  set("effort", () => ({ effort: sheet.effort }));
  set("planned_start", () => ({ planned_start_date: sheet.plannedStart }));
  set("target", () => {
    const iso = sheet.target && /^\d{4}-\d{2}-\d{2}$/.test(sheet.target);
    return { target_date: iso ? sheet.target : null, target_label: sheet.target && !iso ? sheet.target : null };
  });
  set("archived", () => ({
    archived_at: sheet.archived ? new Date(`${sheet.archived.replace(" ", "T")}Z`).toISOString() : null,
    archived_by: sheet.archived ? sheet.archivedBy : null,
  }));
  set("color", () => ({ color: sheet.color }));
  set("body", () => ({ body_md: sheet.bodyMd, body_edited_at: null }));
  if (isNew) cols.audience = audience;
  return cols;
}

export function planImport(files: SheetFile[], state: BoardState, mapping: Mapping = DEFAULT_MAPPING): Plan {
  const laneKeys = new Set(state.lanes.map((l) => l.key));
  const inboxKey = state.lanes.find((l) => l.kind === "inbox")?.key ?? null;
  const groupByKey = new Map(state.groups.map((g) => [g.key, g]));
  const vocab = buildVocabulary(
    state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)),
  );

  const rows: PlanRow[] = [];
  const newLanes = new Map<string, { key: string; name: string }>();
  const newGroups = new Map<string, { key: string; name: string }>();
  const newTags = new Map<string, { groupKey: string; key: string; name: string }>();
  const unapplied = new Map<string, string[]>();
  const ambiguous = new Map<string, string[]>();
  const counts = { new: 0, changed: 0, unchanged: 0, error: 0 };

  for (const file of files) {
    const id = file.name.replace(/\.md$/, "");
    try {
      const parsed = parseFile(file.text);
      const { data: fm, extra } = validateFrontmatter(parsed.frontmatter, file.name);
      if (String(fm.id) !== id)
        throw new Error(`id ${fm.id} does not match the filename ${file.name}`);

      const prev = state.cards.get(id);
      if (prev && prev.source_hash === parsed.hash) {
        rows.push({ id, title: fm.title, verdict: "unchanged" });
        counts.unchanged++;
        continue;
      }

      // Tags: refs resolve or are created; bare unknowns are reported, never guessed.
      const mapped = mapTags(fm, mapping, vocab);
      for (const t of mapped.ambiguous) ambiguous.set(t, [...(ambiguous.get(t) ?? []), id]);
      for (const t of fm.tags)
        if (!t.includes(":") && !vocab.byTagKey.has(t.trim().toLowerCase()))
          unapplied.set(t, [...(unapplied.get(t) ?? []), id]);
      for (const ref of mapped.refs) {
        const [g, t] = ref.split(":");
        const group = groupByKey.get(g);
        if (!group) newGroups.set(g, { key: g, name: laneNameFromKey(g) });
        if (!group?.tags.some((x) => x.key === t))
          newTags.set(ref, { groupKey: g, key: t, name: laneNameFromKey(t) });
      }

      const sheet = sheetFromFrontmatter(fm, extra, parsed.body, mapped.refs);
      const present = presentKeys(parsed.frontmatter);
      if (fm.lane && !laneKeys.has(fm.lane))
        newLanes.set(fm.lane, { key: fm.lane, name: laneNameFromKey(fm.lane) });

      const audience = mapAudience(fm, mapping);
      const shared = {
        external_id: id,
        epic: sheet.epic,
        source_path: file.name,
        source_hash: parsed.hash,
        source_text: file.text,
        frontmatter_extra: extra,
        lane_from_source: fm.lane ?? null,
      };

      if (!prev) {
        const laneKey = fm.lane && !laneKeys.has(fm.lane) ? fm.lane : laneForNewCard(fm.lane, laneKeys, inboxKey);
        const changes = diffSheets(sheet, { ...sheet, bodyMd: "" }, present).filter((c) => c.key === "body");
        const patch: CardPatch = {
          columns: { ...shared, ...columnsFor(sheet, changes, true, audience) },
          laneKey,
          rank: fm.rank != null && fm.lane === laneKey ? Number(fm.rank) : undefined,
          tagRefs: mapped.refs,
          relates: fm.relates ?? [],
          epic: sheet.epic,
        };
        rows.push({ id, title: fm.title, verdict: "new", lane: laneKey, changes: [], patch, hash: parsed.hash });
        counts.new++;
        continue;
      }

      const board = sheetFromCard(prev, state);
      const changes = diffSheets(sheet, board, present);
      if (!changes.length) {
        // Same content, different bytes (whitespace, key order): record the new sheet, nothing else.
        rows.push({ id, title: fm.title, verdict: "changed", changes, hash: parsed.hash, patch: {
          columns: shared, laneKey: null, rank: undefined, tagRefs: undefined, relates: undefined, epic: undefined,
        } });
        counts.changed++;
        continue;
      }
      const keys = new Set(changes.map((c) => c.key));
      const patch: CardPatch = {
        columns: { ...shared, ...columnsFor(sheet, changes, false, audience) },
        laneKey: keys.has("lane") ? sheet.lane : null,
        rank: keys.has("rank") || keys.has("lane") ? (sheet.rank ?? undefined) : undefined,
        tagRefs: keys.has("tags") ? mapped.refs : undefined,
        relates: keys.has("relates") ? (fm.relates ?? []) : undefined,
        epic: keys.has("epic") ? sheet.epic : undefined,
      };
      rows.push({ id, title: fm.title, verdict: "changed", changes, patch, hash: parsed.hash });
      counts.changed++;
    } catch (e) {
      rows.push({ id, verdict: "error", message: (e as Error).message });
      counts.error++;
    }
  }

  return {
    ok: counts.error === 0,
    rows,
    newLanes: [...newLanes.values()],
    newGroups: [...newGroups.values()],
    newTags: [...newTags.values()],
    unappliedTags: [...unapplied].map(([tag, cards]) => ({ tag, cards })),
    ambiguousTags: [...ambiguous].map(([tag, cards]) => ({ tag, cards })),
    counts,
  };
}
```

Note the `extractAsk` and `bodyWithoutH1` imports are used through `sheetFromFrontmatter`; remove them from the import list if biome flags them unused.

- [ ] **Step 4: Run to verify pass**

Run: `bun test src/lib/import/plan.test.ts`
Expected: PASS (7 tests). If "the sheet wins" fails on `changes`, check that `presentKeys` excludes `summary` when the file has none (the fixture's `Hi.` summary equals the board's, but the key must not even be compared).

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add src/lib/import/plan.ts src/lib/import/plan.test.ts
git commit -m "import: the planner — a dry run that is the same every time

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 6: `source_text`, board state from the database, and the applier

**Files:**
- Create: `supabase/migrations/20260906000000_source_text.sql`, `src/lib/import/board-state.ts`, `src/lib/import/apply.ts`, `src/lib/import/apply.integration.test.ts`
- Modify: `etl/import.ts` (store `source_text`) — one line, see Step 6

**Interfaces:**
- Consumes: Task 4 types, Task 5 `planImport`.
- Produces:
  ```ts
  // board-state.ts
  export async function loadBoardState(db: SupabaseClient, boardId: string): Promise<BoardState>
  // apply.ts
  export async function applyPlan(db: SupabaseClient, state: BoardState, plan: Plan, actor: string): Promise<{ created: number; updated: number }>
  ```
  `applyPlan` throws if `plan.ok` is false.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260906000000_source_text.sql`:
```sql
-- The sheet as it was handed to us. Export is a line edit of this, never a
-- render of the row, so an untouched file comes back byte-identical.
alter table public.cards add column source_text text;
```

Run: `bun run db:reset`
Expected: migrations apply, seed runs.

- [ ] **Step 2: Write `board-state.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardState, ExistingCard } from "./types";

/** Everything the planner compares against, from the database, through whatever client the caller holds. */
export async function loadBoardState(db: SupabaseClient, boardId: string): Promise<BoardState> {
  const [{ data: lanes }, { data: groups }, { data: cards }, { data: epics }] = await Promise.all([
    db.from("lanes").select("id, key, name, kind, position").eq("board_id", boardId).order("position"),
    db.from("tag_groups").select("id, key, name, position, color, tags(id, key, name)").eq("board_id", boardId).order("position"),
    db
      .from("cards")
      .select(
        "id, external_id, title, status, epic, area, raised_by, raised_on, shipped_on, needs, summary, body_md, lane_id, rank, priority, effort, planned_start_date, target_date, target_label, archived_at, archived_by, color, source_hash, frontmatter_extra, card_tags(tag_id), card_links!card_links_from_card_fkey(to_card, kind)",
      )
      .eq("board_id", boardId),
    db.from("epics").select("id, source_name").eq("board_id", boardId),
  ]);
  const idToExternal = new Map((cards ?? []).map((c) => [c.id as string, c.external_id as string]));
  const map = new Map<string, ExistingCard>();
  for (const c of cards ?? []) {
    const links = (c.card_links as { to_card: string; kind: string }[] | null) ?? [];
    map.set(c.external_id as string, {
      ...(c as unknown as ExistingCard),
      frontmatter_extra: (c.frontmatter_extra as Record<string, unknown>) ?? {},
      tag_ids: ((c.card_tags as { tag_id: string }[] | null) ?? []).map((t) => t.tag_id),
      relates: links
        .filter((l) => l.kind === "relates")
        .map((l) => Number(idToExternal.get(l.to_card)))
        .filter((n) => Number.isInteger(n)),
    });
  }
  return {
    id: boardId,
    lanes: (lanes ?? []) as BoardState["lanes"],
    groups: (groups ?? []) as BoardState["groups"],
    cards: map,
    epics: new Map((epics ?? []).map((e) => [e.source_name as string, e.id as string])),
  };
}
```

If the `card_links!card_links_from_card_fkey` hint fails on your schema, check `supabase/migrations/20260826000000_init.sql` for the constraint name on `card_links.from_card` and use that.

- [ ] **Step 3: Write the integration test (runs only against the local stack)**

`src/lib/import/apply.integration.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";
import { applyPlan } from "./apply";
import { loadBoardState } from "./board-state";
import { planImport } from "./plan";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = !!url && !!key && /127\.0\.0\.1|localhost/.test(url);

describe.skipIf(!local)("applyPlan against the local database", () => {
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const sheet = (id: number, fm: string, body = "## Ask\n\nHi.") =>
    ({ name: `${id}.md`, text: `---\nid: ${id}\ntitle: Card ${id}\nstatus: backlog\nepic: Apply\narea: A\n${fm}\n---\n# #${id} — Card ${id}\n\n${body}\n` });

  async function demoBoard() {
    const { data } = await db.from("boards").select("id, projects!inner(slug)").eq("slug", "backlog").eq("projects.slug", "demo").single();
    return data!.id as string;
  }

  test("creates lanes, groups, tags and cards; never deletes; second run is unchanged", async () => {
    const boardId = await demoBoard();
    await db.from("cards").delete().eq("board_id", boardId).in("external_id", ["9001", "9002"]);
    const files = [
      sheet(9001, "lane: gate-9\ntags:\n  - kind:bug\n  - zone:north\npriority: 2"),
      sheet(9002, ""),
    ];
    let state = await loadBoardState(db, boardId);
    let plan = planImport(files, state);
    expect(plan.ok).toBe(true);
    const r = await applyPlan(db, state, plan, "test@example.test");
    expect(r).toEqual({ created: 2, updated: 0 });

    state = await loadBoardState(db, boardId);
    expect(state.lanes.some((l) => l.key === "gate-9" && l.kind === "work")).toBe(true);
    const done = state.lanes.find((l) => l.kind === "done")!;
    const gate = state.lanes.find((l) => l.key === "gate-9")!;
    expect(gate.position).toBeLessThan(done.position);
    expect(state.groups.some((g) => g.key === "zone" && g.tags.some((t) => t.key === "north"))).toBe(true);
    const c = state.cards.get("9001")!;
    expect(c.lane_id).toBe(gate.id);
    expect(c.priority).toBe(2);
    expect(c.tag_ids).toHaveLength(2);

    plan = planImport(files, state);
    expect(plan.counts).toMatchObject({ unchanged: 2, changed: 0, new: 0 });

    // the sheet wins, and what it does not say stays
    await db.from("cards").update({ effort: "H" }).eq("id", c.id);
    state = await loadBoardState(db, boardId);
    plan = planImport([sheet(9001, "lane: gate-9\ntags:\n  - kind:bug\n  - zone:north\npriority: 1")], state);
    await applyPlan(db, state, plan, "test@example.test");
    state = await loadBoardState(db, boardId);
    expect(state.cards.get("9001")).toMatchObject({ priority: 1, effort: "H" });
    expect(state.cards.get("9002")).toBeDefined();

    const { data: events } = await db.from("card_events").select("kind, actor").eq("card_id", c.id).order("at");
    expect(events!.map((e) => e.kind)).toEqual(["created", "imported"]);
    expect(events![0].actor).toBe("test@example.test");
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `bun test src/lib/import/apply.integration.test.ts`
Expected: FAIL — cannot resolve `./apply` (with the local stack up and `.env.local` loaded via `bunfig.toml`; if it reports *skipped*, run `bunx supabase start` first).

- [ ] **Step 5: Implement `apply.ts`**

```ts
/**
 * File the plan. Creates what is new first (lanes, groups, tags), then
 * writes cards in file order, then links. Never deletes anything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardState, Plan } from "./types";

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

export async function applyPlan(
  db: SupabaseClient,
  state: BoardState,
  plan: Plan,
  actor: string,
): Promise<{ created: number; updated: number }> {
  if (!plan.ok) throw new Error("The plan has errors; fix the files and try again.");
  const boardId = state.id;

  // Lanes: `create_work_lane` positions a new work lane before the first done/archive lane in one transaction.
  const laneId = new Map(state.lanes.map((l) => [l.key, l.id]));
  for (const l of plan.newLanes) {
    const { data, error } = await db.rpc("create_work_lane", { p_board_id: boardId, p_key: l.key, p_name: l.name });
    if (error || !data) fail(`lane ${l.key}`, error);
    laneId.set(l.key, (data as { id: string }).id);
  }

  // Groups and tags.
  const groupId = new Map(state.groups.map((g) => [g.key, g.id]));
  let nextGroupPos = state.groups.reduce((m, g) => Math.max(m, g.position + 1), 0);
  for (const g of plan.newGroups) {
    const { data, error } = await db
      .from("tag_groups")
      .insert({ board_id: boardId, key: g.key, name: g.name, position: nextGroupPos++ })
      .select("id")
      .single();
    if (error || !data) fail(`tag group ${g.key}`, error);
    groupId.set(g.key, data.id);
  }
  const tagId = new Map<string, string>();
  for (const g of state.groups) for (const t of g.tags) tagId.set(`${g.key}:${t.key}`, t.id);
  for (const t of plan.newTags) {
    const gid = groupId.get(t.groupKey);
    if (!gid) throw new Error(`tag group ${t.groupKey} was not created`);
    const { data, error } = await db
      .from("tags")
      .insert({ group_id: gid, key: t.key, name: t.name })
      .select("id")
      .single();
    if (error || !data) fail(`tag ${t.groupKey}:${t.key}`, error);
    tagId.set(`${t.groupKey}:${t.key}`, data.id);
  }

  // Epics are upserted by source name as they appear.
  const epicId = new Map(state.epics);
  async function epic(name: string): Promise<string> {
    const known = epicId.get(name);
    if (known) return known;
    const { data, error } = await db
      .from("epics")
      .upsert({ board_id: boardId, source_name: name }, { onConflict: "board_id,source_name" })
      .select("id")
      .single();
    if (error || !data) fail(`epic ${name}`, error);
    epicId.set(name, data.id);
    return data.id;
  }

  // Rank: append after the last card in the lane when the file gives none.
  const maxRank = new Map<string, number>();
  for (const c of state.cards.values())
    if (c.lane_id) maxRank.set(c.lane_id, Math.max(maxRank.get(c.lane_id) ?? 0, c.rank));
  const nextRank = (lane: string) => {
    const r = (maxRank.get(lane) ?? 0) + 1;
    maxRank.set(lane, r);
    return r;
  };

  let created = 0;
  let updated = 0;
  const idByExternal = new Map<string, string>();
  for (const c of state.cards.values()) idByExternal.set(c.external_id, c.id);
  const pendingLinks: { from: string; relates: number[] }[] = [];

  for (const row of plan.rows) {
    if (row.verdict === "unchanged" || row.verdict === "error") continue;
    const prev = state.cards.get(row.id);
    const columns: Record<string, unknown> = { board_id: boardId, ...row.patch.columns };
    if (row.patch.epic !== undefined) columns.epic_id = await epic(row.patch.epic);
    if (row.patch.laneKey) {
      const lid = laneId.get(row.patch.laneKey);
      if (!lid) throw new Error(`lane ${row.patch.laneKey} was not created`);
      columns.lane_id = lid;
      columns.rank = row.patch.rank ?? nextRank(lid);
    } else if (row.patch.rank !== undefined && prev?.lane_id) columns.rank = row.patch.rank;

    const { data, error } = await db
      .from("cards")
      .upsert(columns, { onConflict: "board_id,external_id" })
      .select("id")
      .single();
    if (error || !data) fail(`#${row.id}`, error);
    idByExternal.set(row.id, data.id);

    if (row.patch.tagRefs !== undefined) {
      const { error: de } = await db.from("card_tags").delete().eq("card_id", data.id);
      if (de) fail(`#${row.id} tags`, de);
      const ids = row.patch.tagRefs.map((r) => tagId.get(r)).filter((x): x is string => !!x);
      if (ids.length) {
        const { error: ie } = await db.from("card_tags").insert(ids.map((tag_id) => ({ card_id: data.id, tag_id })));
        if (ie) fail(`#${row.id} tags`, ie);
      }
    }
    if (row.patch.relates !== undefined) pendingLinks.push({ from: data.id, relates: row.patch.relates });

    const { error: ee } = await db.from("card_events").insert({
      card_id: data.id,
      actor,
      kind: prev ? "imported" : "created",
      payload: { source: `${row.id}.md`, hash: row.hash, changes: row.changes },
    });
    if (ee) fail(`#${row.id} event`, ee);
    prev ? updated++ : created++;
  }

  for (const { from, relates } of pendingLinks) {
    const { error: de } = await db.from("card_links").delete().eq("from_card", from).eq("kind", "relates");
    if (de) fail("links", de);
    const rows = relates
      .map((n) => idByExternal.get(String(n)))
      .filter((x): x is string => !!x)
      .map((to_card) => ({ from_card: from, to_card, kind: "relates" }));
    if (rows.length) {
      const { error: ie } = await db.from("card_links").insert(rows);
      if (ie) fail("links", ie);
    }
  }
  return { created, updated };
}
```

- [ ] **Step 6: Make the CLI import store the sheet too**

In `etl/import.ts`, in the `row` object literal (around `source_hash: parsed.hash,`), add:
```ts
    source_text: text,
```

- [ ] **Step 7: Run to verify pass**

Run: `bun test src/lib/import/apply.integration.test.ts`
Expected: PASS (1 test). Then `bun run db:reset && bun run etl:import --project demo --board backlog --source examples/tracker` to leave the demo board clean, and confirm with `docker exec -i supabase_db_cardstock psql -U postgres -c "select count(*) from cards where source_text is not null"` → 13.

- [ ] **Step 8: Check and commit**

```bash
bun run check
git add supabase/migrations/20260906000000_source_text.sql src/lib/import/board-state.ts src/lib/import/apply.ts src/lib/import/apply.integration.test.ts etl/import.ts
git commit -m "import: cards.source_text, board state from the database, and the applier

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 7: Server actions

**Files:**
- Create: `src/app/import-actions.ts`

**Interfaces:**
- Consumes: Tasks 4–6; `currentMember`, `supabaseServer`; `currentAccess(projectId)` from `@/lib/access-server` (its `canManage` is owner-or-project-admin); `cleanName`, `keyFromName` from `@/lib/keys`.
- Produces:
  ```ts
  export type ImportPlanResult = { plan: Plan; boardName: string } | { error: string };
  export type ImportApplyResult = { ok: true; created: number; updated: number; href: string } | { error: string; href?: string };
  export async function planBoardImport(form: FormData): Promise<ImportPlanResult>      // boardId, file
  export async function applyBoardImport(form: FormData): Promise<ImportApplyResult>    // boardId, file
  export async function planProjectImport(form: FormData): Promise<ImportPlanResult>    // name, boardName, file
  export async function applyProjectImport(form: FormData): Promise<ImportApplyResult>  // name, boardName, description?, file
  ```

- [ ] **Step 1: Write the actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { applyPlan } from "@/lib/import/apply";
import { loadBoardState } from "@/lib/import/board-state";
import { planImport } from "@/lib/import/plan";
import type { BoardState, Plan } from "@/lib/import/types";
import { filesFromZip } from "@/lib/import/zip";
import { currentAccess } from "@/lib/access-server";
import { cleanName, keyFromName } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export type ImportPlanResult = { plan: Plan; boardName: string } | { error: string };
export type ImportApplyResult =
  | { ok: true; created: number; updated: number; href: string }
  | { error: string; href?: string };

async function sheets(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a zip first.");
  return filesFromZip(new Uint8Array(await file.arrayBuffer()));
}

/** The board and its project, through RLS, for someone allowed to manage it (owner or project admin). */
async function board(boardId: string) {
  const db = await supabaseServer();
  const { data } = await db
    .from("boards")
    .select("id, slug, name, project_id, projects!inner(slug)")
    .eq("id", boardId)
    .maybeSingle();
  if (!data) throw new Error("Board not found.");
  const access = await currentAccess(data.project_id as string);
  if (!access?.canManage) throw new Error("Only an owner or a project admin can import into this board.");
  const project = data.projects as unknown as { slug: string };
  return { db, id: data.id as string, name: data.name as string, href: `/p/${project.slug}/b/${data.slug}`, email: access.member.email as string };
}

export async function planBoardImport(form: FormData): Promise<ImportPlanResult> {
  try {
    const b = await board(String(form.get("boardId") ?? ""));
    const files = await sheets(form);
    const state = await loadBoardState(b.db, b.id);
    return { plan: planImport(files, state), boardName: b.name };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function applyBoardImport(form: FormData): Promise<ImportApplyResult> {
  try {
    const b = await board(String(form.get("boardId") ?? ""));
    const files = await sheets(form);
    const state = await loadBoardState(b.db, b.id);
    const plan = planImport(files, state);
    if (!plan.ok) return { error: "Some files did not validate; nothing was imported." };
    const r = await applyPlan(b.db, state, plan, b.email);
    revalidatePath("/");
    revalidatePath(b.href);
    return { ok: true, ...r, href: b.href };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** A board that does not exist yet, shaped like `create_board` will make it. */
function freshBoardState(): BoardState {
  const lane = (key: string, name: string, position: number, kind: string) => ({ id: `new:${key}`, key, name, position, kind });
  return {
    id: "new",
    lanes: [lane("unsorted", "Unsorted", 0, "inbox"), lane("now", "Now", 1, "work"), lane("next", "Next", 2, "work"), lane("done", "Done", 3, "done"), lane("archive", "Archive", 4, "archive")],
    groups: [],
    cards: new Map(),
    epics: new Map(),
  };
}

function names(form: FormData) {
  const name = cleanName(String(form.get("name") ?? ""));
  const boardName = cleanName(String(form.get("boardName") ?? ""));
  if (!name) throw new Error("Enter a project name (80 characters or fewer).");
  if (!boardName) throw new Error("Enter a board name (80 characters or fewer).");
  const slug = keyFromName(name);
  const boardSlug = keyFromName(boardName);
  if (!slug || !boardSlug) throw new Error("Names need a letter or number.");
  return { name, boardName, slug, boardSlug, description: String(form.get("description") ?? "") };
}

export async function planProjectImport(form: FormData): Promise<ImportPlanResult> {
  try {
    const me = await currentMember();
    if (!me) return { error: "Not signed in." };
    if (me.role !== "owner") return { error: "Only an owner can import a project." };
    const n = names(form);
    const files = await sheets(form);
    return { plan: planImport(files, freshBoardState()), boardName: n.boardName };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function applyProjectImport(form: FormData): Promise<ImportApplyResult> {
  let href: string | undefined;
  try {
    const me = await currentMember();
    if (!me) return { error: "Not signed in." };
    if (me.role !== "owner") return { error: "Only an owner can import a project." };
    const n = names(form);
    const files = await sheets(form);
    if (!planImport(files, freshBoardState()).ok)
      return { error: "Some files did not validate; nothing was created." };

    const db = await supabaseServer();
    const { data: projectId, error: pe } = await db.rpc("create_project", {
      p_slug: n.slug,
      p_name: n.name,
      p_description: n.description || null,
    });
    if (pe) return { error: pe.code === "23505" ? `A project is already filed as /p/${n.slug}.` : pe.message };
    href = `/p/${n.slug}`;
    const { data: boardId, error: be } = await db.rpc("create_board", {
      p_project_id: projectId,
      p_slug: n.boardSlug,
      p_name: n.boardName,
    });
    if (be) return { error: be.message, href };
    href = `/p/${n.slug}/b/${n.boardSlug}`;

    const state = await loadBoardState(db, boardId as string);
    const plan = planImport(files, state);
    const r = await applyPlan(db, state, plan, me.email);
    revalidatePath("/");
    return { ok: true, ...r, href };
  } catch (e) {
    return { error: (e as Error).message, href };
  }
}
```

- [ ] **Step 2: Type-check and commit**

Run: `bun run check`
Expected: clean. (There is no unit test for actions; Tasks 9 and 10 cover them end to end.)

```bash
git add src/app/import-actions.ts
git commit -m "import: server actions — plan and apply, for a board and for a new project

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 8: The export route

**Files:**
- Create: `src/app/p/[project]/b/[board]/export.zip/route.ts`, `e2e/export-zip.spec.ts`

**Interfaces:**
- Consumes: `loadBoardState`, `sheetFromCard` (Task 5), `writeSheet`, `cardToMarkdown` (Task 3), `buildVocabulary`, `tagRef` (Task 1), `fflate.zipSync`.

- [ ] **Step 1: Write the failing e2e test**

`e2e/export-zip.spec.ts`:
```ts
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { signIn } from "./support/sign-in";

test("the export zip gives back the sheets that were imported, byte for byte", async ({ page }) => {
  await signIn(page);
  const res = await page.request.get("/p/demo/b/backlog/export.zip");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("application/zip");
  const files = unzipSync(new Uint8Array(await res.body()));
  const five = new TextDecoder().decode(files["5.md"]);
  expect(five).toBe(readFileSync("examples/tracker/5.md", "utf8"));
  expect(Object.keys(files).length).toBeGreaterThanOrEqual(13);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test:e2e -- e2e/export-zip.spec.ts`
Expected: FAIL — 404.

- [ ] **Step 3: Implement the route**

```ts
import { zipSync } from "fflate";
import { currentAccess } from "@/lib/access-server";
import { buildVocabulary, tagRef } from "@/lib/frontmatter/mapping";
import { cardToMarkdown, writeSheet } from "@/lib/frontmatter/write";
import { loadBoardState } from "@/lib/import/board-state";
import { sheetFromCard } from "@/lib/import/plan";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/**
 * The board as a folder of sheets. Each file is the one that was handed to us
 * with the board's marks written in; a card that never had one is written
 * from scratch. Downloading rebases: the next diff shows only what changed
 * after this.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/p/[project]/b/[board]/export.zip">,
) {
  const me = await currentMember();
  if (!me) return new Response("unauthorized", { status: 401 });
  const { project, board } = await ctx.params;
  const db = await supabaseServer();
  const { data: b } = await db
    .from("boards")
    .select("id, project_id, projects!inner(slug)")
    .eq("slug", board)
    .eq("projects.slug", project)
    .maybeSingle();
  if (!b) return new Response("not found", { status: 404 });
  const access = await currentAccess(b.project_id as string);
  if (!access?.canManage) return new Response("forbidden", { status: 403 });

  const state = await loadBoardState(db, b.id as string);
  const { data: sources } = await db
    .from("cards")
    .select("id, source_text")
    .eq("board_id", b.id);
  const sourceOf = new Map((sources ?? []).map((s) => [s.id as string, s.source_text as string | null]));
  const vocab = buildVocabulary(state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)));
  const resolve = (t: string) => {
    const r = tagRef(t, vocab);
    return r && "ref" in r ? r.ref : null;
  };

  const entries: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  const rebase: { id: string; source_text: string; lane_from_source: string | null }[] = [];
  for (const card of state.cards.values()) {
    const sheet = sheetFromCard(card, state);
    const src = sourceOf.get(card.id);
    const text = src ? writeSheet(src, sheet, { tagRef: resolve }) : cardToMarkdown(sheet);
    entries[`${card.external_id}.md`] = enc.encode(text);
    if (text !== src) rebase.push({ id: card.id, source_text: text, lane_from_source: sheet.lane });
  }
  for (const r of rebase)
    await db.from("cards").update({ source_text: r.source_text, lane_from_source: r.lane_from_source }).eq("id", r.id);

  const zip = zipSync(entries, { level: 6 });
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${project}-${board}-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test:e2e -- e2e/export-zip.spec.ts`
Expected: PASS. (The global setup re-imports `examples/tracker` through the CLI, which now stores `source_text`, so `5.md` has a sheet to write from.)

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add "src/app/p/[project]/b/[board]/export.zip/route.ts" e2e/export-zip.spec.ts
git commit -m "export: the board as a zip of sheets, rebased on download

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 9: Board import dialog, the plan table, the contract panel, and the binder affordances

**Files:**
- Create: `src/components/sheet-contract.tsx`, `src/components/import-plan-table.tsx`, `src/components/board-import-dialog.tsx`, `e2e/board-import.spec.ts`
- Modify: `src/components/binder.tsx` (add ↓ / ↑ to `.binder-foot`; needs `id` on `BinderBoard`), `src/app/page.tsx` (pass board `id`), `src/styles/components/paper.css` (a few rules, appended)

**Interfaces:**
- Consumes: `planBoardImport`, `applyBoardImport` (Task 7), `jsonSchema` (Task 1), `cardToMarkdown` (Task 3), `Plan`/`PlanRow` (Task 4).
- Produces: `<SheetContract />` (server-safe, no hooks), `<ImportPlanTable plan boardName />`, `<BoardImportDialog boardId boardName />`; `BinderBoard.id: string`; `BinderProject.canManage: boolean` (owner or project admin — the ↓/↑ controls render only when true).

- [ ] **Step 1: Write the failing e2e test**

`e2e/board-import.spec.ts`:
```ts
import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { zipSync } from "fflate";
import { signIn } from "./support/sign-in";

function trackerZip(edit?: (name: string, text: string) => string) {
  const entries: Record<string, Uint8Array> = {};
  for (const f of readdirSync("examples/tracker").filter((n) => /^\d+\.md$/.test(n))) {
    let text = readFileSync(`examples/tracker/${f}`, "utf8");
    if (edit) text = edit(f, text);
    entries[`tracker/${f}`] = new TextEncoder().encode(text);
  }
  return Buffer.from(zipSync(entries));
}

test("dropping the tracker on the demo board shows a plan, and a re-import is all unchanged", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Import into Product backlog" }).click();
  await page.getByLabel("Zip of sheets").setInputFiles({ name: "tracker.zip", mimeType: "application/zip", buffer: trackerZip() });
  await expect(page.getByRole("heading", { name: "Importing into Product backlog" })).toBeVisible();
  await expect(page.getByTestId("plan-counts")).toContainText("13 unchanged");
  await expect(page.getByRole("button", { name: /^Import 0 cards$/ })).toBeDisabled();
});

test("a changed sheet shows as changed, imports, and the board reflects it", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Import into Product backlog" }).click();
  await page.getByLabel("Zip of sheets").setInputFiles({
    name: "tracker.zip",
    mimeType: "application/zip",
    buffer: trackerZip((name, text) => (name === "5.md" ? text.replace(/^title: .*$/m, 'title: "Should trials require a card?"') : text)),
  });
  const row = page.getByTestId("plan-row-5");
  await expect(row).toContainText("changed");
  await expect(row).toContainText("title");
  await page.getByRole("button", { name: "Import 1 card" }).click();
  await expect(page.getByTestId("import-done")).toContainText("1 changed");
  await page.goto("/p/demo/b/backlog");
  await expect(page.getByText("Should trials require a card?")).toBeVisible();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test:e2e -- e2e/board-import.spec.ts`
Expected: FAIL — no button "Import into Product backlog".

- [ ] **Step 3: The contract panel, rendered from the schema**

`src/components/sheet-contract.tsx`:
```tsx
import { jsonSchema } from "@/lib/frontmatter/schema";
import { MANAGED_KEYS, cardToMarkdown } from "@/lib/frontmatter/write";

/**
 * What a sheet must look like, read off the schema so it cannot drift.
 * Required keys, then the optional ones, then the keys the board writes.
 */
const SAMPLE = cardToMarkdown({
  externalId: "42", title: "Should trials require a credit card?", status: "backlog", epic: "Billing", area: "Product",
  tags: ["kind:question"], raisedBy: "Ana", raisedOn: "2026-08-07", shippedOn: null, needs: null, summary: null,
  relates: [], lane: "next", rank: 1, priority: 2, effort: "M", plannedStart: null, target: "2026-10-01",
  archived: null, archivedBy: null, color: null, extra: {}, bodyMd: "## Ask\n\nAna asked after reviewing the billing flow.",
});

export function SheetContract() {
  const s = jsonSchema() as { properties: Record<string, { enum?: string[]; type?: string }>; required?: string[] };
  const required = new Set(s.required ?? []);
  const managed = new Set<string>(MANAGED_KEYS);
  const keys = Object.keys(s.properties);
  const line = (k: string) => {
    const p = s.properties[k];
    return p.enum ? p.enum.join(" | ") : (p.type ?? "text");
  };
  return (
    <aside className="contract" aria-label="Sheet contract">
      <p className="contract-lede">
        One <code>&lt;n&gt;.md</code> per card, named by its id, frontmatter between <code>---</code> fences, the body below. Any folder depth. Keys the schema does not know are kept verbatim.
      </p>
      <dl className="contract-keys">
        {keys.filter((k) => required.has(k)).map((k) => (
          <div key={k}><dt>{k}</dt><dd>{line(k)} <span className="stat stat--blocked">required</span></dd></div>
        ))}
        {keys.filter((k) => !required.has(k) && !managed.has(k)).map((k) => (
          <div key={k}><dt>{k}</dt><dd>{line(k)}</dd></div>
        ))}
        {keys.filter((k) => managed.has(k)).map((k) => (
          <div key={k}><dt>{k}</dt><dd>{line(k)} <span className="stat stat--info">written by the board</span></dd></div>
        ))}
      </dl>
      <pre className="contract-sample"><code>{SAMPLE}</code></pre>
    </aside>
  );
}
```

- [ ] **Step 4: The plan table**

`src/components/import-plan-table.tsx`:
```tsx
import type { Plan, PlanRow } from "@/lib/import/types";

const VERDICT: Record<PlanRow["verdict"], string> = {
  new: "stat stat--success",
  changed: "stat stat--wip",
  unchanged: "stat",
  error: "stat stat--blocked",
};

function Side({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <details className="plan-side">
      <summary className="stat">{items.length} {label}</summary>
      <ul>{items.map((i) => <li key={i} className="font-mono text-[11px]">{i}</li>)}</ul>
    </details>
  );
}

export function ImportPlanTable({ plan }: { plan: Plan }) {
  return (
    <div className="plan">
      <div className="plan-sides">
        <Side label="lanes to create" items={plan.newLanes.map((l) => `${l.key} — ${l.name}`)} />
        <Side label="tag groups to create" items={plan.newGroups.map((g) => g.key)} />
        <Side label="tags to create" items={plan.newTags.map((t) => `${t.groupKey}:${t.key}`)} />
        <Side label="tags not applied" items={plan.unappliedTags.map((t) => `${t.tag} — ${t.cards.length} card(s)`)} />
        <Side label="ambiguous tags" items={plan.ambiguousTags.map((t) => `${t.tag} — ${t.cards.length} card(s)`)} />
      </div>
      <div className="plan-scroll">
        <table className="plan-table">
          <thead><tr><th>#</th><th>Title</th><th>Verdict</th><th>Changes</th></tr></thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.id} data-testid={`plan-row-${r.id}`}>
                <td className="font-mono">{r.id}</td>
                <td>{r.title ?? ""}</td>
                <td><span className={VERDICT[r.verdict]}>{r.verdict}</span></td>
                <td className="plan-changes">
                  {r.verdict === "error" && <span className="text-[var(--pen-red)]">{r.message}</span>}
                  {r.verdict === "new" && <span className="font-mono text-[11px]">→ {r.lane}</span>}
                  {r.verdict === "changed" &&
                    r.changes.map((c) => (
                      <span key={c.key} className="plan-chip font-mono text-[11px]">
                        {c.key === "body" ? "body" : `${c.key}: ${c.from ?? "—"} → ${c.to ?? "—"}`}
                      </span>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="plan-counts font-mono text-[11px]" data-testid="plan-counts">
        {plan.counts.new} new · {plan.counts.changed} changed · {plan.counts.unchanged} unchanged
        {plan.counts.error ? ` · ${plan.counts.error} error(s)` : ""}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: The dialog**

`src/components/board-import-dialog.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { type ImportApplyResult, type ImportPlanResult, applyBoardImport, planBoardImport } from "@/app/import-actions";
import { ImportPlanTable } from "@/components/import-plan-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Drop → plan → done. The file stays in state and is posted twice: once to
 * plan, once to apply, and the server plans again before it writes.
 */
export function BoardImportDialog({ boardId, boardName }: { boardId: string; boardName: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [planned, setPlanned] = useState<ImportPlanResult | null>(null);
  const [done, setDone] = useState<ImportApplyResult | null>(null);
  const [pending, start] = useTransition();

  const reset = () => { setFile(null); setPlanned(null); setDone(null); };
  const form = (f: File) => { const fd = new FormData(); fd.set("boardId", boardId); fd.set("file", f); return fd; };
  const choose = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setDone(null);
    start(async () => setPlanned(await planBoardImport(form(f))));
  };
  const apply = () => { if (file) start(async () => setDone(await applyBoardImport(form(file)))); };
  const plan = planned && "plan" in planned ? planned.plan : null;
  const toImport = plan ? plan.counts.new + plan.counts.changed : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={<button type="button" className="binder-import paper-link" aria-label={`Import into ${boardName}`}>↑</button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importing into {boardName}</DialogTitle>
          <DialogDescription>The sheet wins: whatever a file states replaces what the board has. Nothing is deleted. You see the plan before anything is filed.</DialogDescription>
        </DialogHeader>
        {done && "ok" in done ? (
          <p className="stat stat--success" data-testid="import-done">{done.created} new · {done.updated} changed — filed.</p>
        ) : plan ? (
          <>
            <ImportPlanTable plan={plan} />
            {done && "error" in done && <p className="text-sm text-[var(--pen-red)]" role="alert">{done.error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>
              <Button size="sm" disabled={pending || !plan.ok || toImport === 0} onClick={apply}>
                {pending ? "Filing…" : `Import ${toImport} ${toImport === 1 ? "card" : "cards"}`}
              </Button>
            </div>
          </>
        ) : (
          <div className="import-drop">
            <label
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0] ?? null); }}
            >
              <span>{pending ? "Reading the sheets…" : "Drop a zip of the tracker here — one <n>.md per card — or choose one."}</span>
              <input type="file" accept=".zip,application/zip" aria-label="Zip of sheets" className="sr-only" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
            </label>
            {planned && "error" in planned && <p className="text-sm text-[var(--pen-red)]" role="alert">{planned.error}</p>}
            <SheetContract />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: The binder affordances and the board id**

In `src/components/binder.tsx`: add `id: string;` to `BinderBoard` and `canManage: boolean;` to `BinderProject`; import `BoardImportDialog`; in `.binder-foot`, after `binder-count`, add:
```tsx
                  {project.canManage && (
                    <span className="binder-io">
                      <a href={`${href}/b/${b.slug}/export.zip`} className="binder-export paper-link" aria-label={`Download ${b.name} as sheets`} title="Download sheets">↓</a>
                      <BoardImportDialog boardId={b.id} boardName={b.name} />
                    </span>
                  )}
```
In `src/app/page.tsx`: select `boards(id, slug, name, cards(count))`, add `id: string` to `ProjectRow["boards"]` items, map `id: b.id`; load the member's project roles once (`db.from("project_members").select("project_id, role").eq("member_id", member.id)`) and set `canManage: canManageProject({ siteRole: member.role, projectRole: roleByProject.get(p.id) ?? null })` per project, importing `canManageProject` from `@/lib/access`. Read `src/components/binder.tsx` and `src/app/page.tsx` as they are on the branch first — both changed after the plan was written; add to them, do not replace them.

- [ ] **Step 7: Paper rules**

Append to `src/styles/components/paper.css` (inside the same layer/section the `.binder-*` rules live in; if the user's binder rules use a different block, append at the end of that block):
```css
  .binder-io { display: inline-flex; gap: 10px; margin-left: auto; margin-right: 10px; font-family: var(--font-mono); font-size: 12px; }
  .binder-import, .binder-export { line-height: 1; }
  .dropzone { display: grid; place-items: center; min-height: 160px; padding: 24px; border: 1px dashed var(--border-strong); background: var(--surface-well); text-align: center; cursor: pointer; }
  .import-drop { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .contract { font-size: 12px; }
  .contract-keys { display: grid; gap: 2px; margin: 8px 0; }
  .contract-keys div { display: grid; grid-template-columns: 120px 1fr; gap: 8px; }
  .contract-keys dt { font-family: var(--font-mono); }
  .contract-sample { max-height: 220px; overflow: auto; padding: 8px; border: 1px solid var(--border); background: var(--surface-card); font-size: 11px; }
  .plan-sides { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }
  .plan-scroll { max-height: 50vh; overflow: auto; border: 1px solid var(--border); }
  .plan-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .plan-table th, .plan-table td { padding: 4px 8px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
  .plan-table th { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--color-grey); }
  .plan-chip { display: inline-block; margin: 0 6px 2px 0; padding: 0 4px; border: 1px solid var(--border); }
  .plan-counts { margin-top: 8px; color: var(--color-grey); }
  @media (max-width: 720px) { .import-drop { grid-template-columns: 1fr; } }
```
If any token name (`--border`, `--border-strong`, `--surface-well`, `--surface-card`) is not in `src/styles/themes/tokens.css`, use the one that is; do not invent tokens (the theme discipline test will fail).

- [ ] **Step 8: Run the e2e, iterate, then check**

Run: `bun run test:e2e -- e2e/board-import.spec.ts && bun run check`
Expected: both tests PASS; check clean. Note the first test's "13 unchanged" relies on the global setup having imported the same files through the CLI (same hashes).

- [ ] **Step 9: Commit**

```bash
git add src/components/sheet-contract.tsx src/components/import-plan-table.tsx src/components/board-import-dialog.tsx src/components/binder.tsx src/app/page.tsx src/styles/components/paper.css e2e/board-import.spec.ts
git commit -m "board import: drop a zip, see the plan, file it

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 10: Project import from a zip

**Files:**
- Modify: `src/components/import-project-dialog.tsx` (rewrite), `README.md` (move the four CLI steps under **ETL**)
- Create: `e2e/project-import.spec.ts`

**Interfaces:**
- Consumes: `planProjectImport`, `applyProjectImport` (Task 7), `ImportPlanTable` (Task 9). `SheetContract` is server-only: the dialog takes it as a `contract: React.ReactNode` prop, rendered by the server component `src/app/page.tsx` (`<ImportProjectDialog contract={<SheetContract />} />`) — same pattern `BoardImportDialog` uses after Task 9's fix round. Never import `SheetContract` into a `"use client"` file.

- [ ] **Step 1: Write the failing e2e test**

`e2e/project-import.spec.ts`:
```ts
import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { zipSync } from "fflate";
import { admin, signIn } from "./support/sign-in";

const SLUG = "e2e-imported";

test("an owner imports a zip as a new project", async ({ page }) => {
  await admin.from("projects").delete().eq("slug", SLUG);
  try {
    const entries: Record<string, Uint8Array> = {};
    for (const f of readdirSync("examples/tracker").filter((n) => /^\d+\.md$/.test(n)))
      entries[`tracker/${f}`] = new TextEncoder().encode(readFileSync(`examples/tracker/${f}`, "utf8"));
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Import project" }).click();
    await page.getByLabel("Name").fill("E2E imported");
    await page.getByLabel("First board").fill("Backlog");
    await page.getByLabel("Zip of sheets").setInputFiles({ name: "t.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(entries)) });
    await expect(page.getByTestId("plan-counts")).toContainText("13 new");
    await page.getByRole("button", { name: "Create project and import 13 cards" }).click();
    await page.waitForURL(`/p/${SLUG}/b/backlog`);
    await expect(page.getByText("Needs input", { exact: true })).toBeVisible();
  } finally {
    await admin.from("projects").delete().eq("slug", SLUG);
  }
});
```

(`Needs input` is the name `laneNameFromKey("needs-input")` gives the lane `5.md` names; it proves lanes came from the sheets.)

- [ ] **Step 2: Run to verify failure**

Run: `bun run test:e2e -- e2e/project-import.spec.ts`
Expected: FAIL — no label "First board".

- [ ] **Step 3: Rewrite the dialog**

`src/components/import-project-dialog.tsx`:
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type ImportApplyResult, type ImportPlanResult, applyProjectImport, planProjectImport } from "@/app/import-actions";
import { ImportPlanTable } from "@/components/import-plan-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { keyFromName } from "@/lib/keys";

/** A binder from a folder of sheets: name it, name its first board, drop the zip, read the plan, create. */
/** `contract` is `<SheetContract />` rendered by the server page, so the schema never reaches the client bundle. */
export function ImportProjectDialog({ contract }: { contract: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [boardName, setBoardName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [planned, setPlanned] = useState<ImportPlanResult | null>(null);
  const [done, setDone] = useState<ImportApplyResult | null>(null);
  const [pending, start] = useTransition();

  const form = (f: File) => {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("boardName", boardName);
    fd.set("file", f);
    return fd;
  };
  const reset = () => { setFile(null); setPlanned(null); setDone(null); };
  const choose = (f: File | null) => {
    if (!f) return;
    setFile(f);
    start(async () => setPlanned(await planProjectImport(form(f))));
  };
  const create = () => {
    if (!file) return;
    start(async () => {
      const r = await applyProjectImport(form(file));
      setDone(r);
      if ("ok" in r) router.push(r.href);
    });
  };
  const plan = planned && "plan" in planned ? planned.plan : null;
  const ready = !!name.trim() && !!boardName.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={<Button variant="outline" size="sm">Import project</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import a project</DialogTitle>
          <DialogDescription>A folder of sheets becomes a binder: its lanes and tag groups come from what the sheets say.</DialogDescription>
        </DialogHeader>
        {plan ? (
          <>
            <p className="font-mono text-[11px] text-[var(--color-grey)]">/p/{keyFromName(name)}/b/{keyFromName(boardName)}</p>
            <ImportPlanTable plan={plan} />
            {done && "error" in done && (
              <p className="text-sm text-[var(--pen-red)]" role="alert">
                {done.error}{done.href ? ` The project exists and is empty: ${done.href}` : ""}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Back</Button>
              <Button size="sm" disabled={pending || !plan.ok} onClick={create}>
                {pending ? "Creating…" : `Create project and import ${plan.counts.new} cards`}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor="import-project-name" className="block space-y-1.5 text-sm">
                <span className="font-medium">Name</span>
                <Input id="import-project-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="What the team calls it" />
              </label>
              <label htmlFor="import-board-name" className="block space-y-1.5 text-sm">
                <span className="font-medium">First board</span>
                <Input id="import-board-name" required maxLength={80} value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="Backlog" />
              </label>
            </div>
            <div className="import-drop">
              <label
                className={`dropzone${ready ? "" : " opacity-50"}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (ready) choose(e.dataTransfer.files[0] ?? null); }}
              >
                <span>{!ready ? "Name the project and its first board, then drop the zip." : pending ? "Reading the sheets…" : "Drop a zip of the tracker here — one <n>.md per card — or choose one."}</span>
                <input type="file" accept=".zip,application/zip" aria-label="Zip of sheets" className="sr-only" disabled={!ready} onChange={(e) => choose(e.target.files?.[0] ?? null)} />
              </label>
              {planned && "error" in planned && <p className="text-sm text-[var(--pen-red)]" role="alert">{planned.error}</p>}
              {contract}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3b: Pass the contract from the server page**

In `src/app/page.tsx` (a server component), import `SheetContract` from `@/components/sheet-contract` and change `<ImportProjectDialog />` to `<ImportProjectDialog contract={<SheetContract />} />`. Also add `import type React from "react"` in the dialog if tsc needs the `React.ReactNode` namespace.

- [ ] **Step 4: Move the CLI explainer to the README**

In `README.md`, under **## ETL**, after the table, add:

```markdown
### Importing a project from the command line

The projects page can do this from a zip. The command line is for trackers over 4 MB or for scripted seeds:

1. Write a seed next to the tracker — project, board, lanes in order with kinds, tag groups — and apply it: `bun run db:apply --file path/to/seed.sql`.
2. `bun run etl:import --project <slug> --board <slug> --source path/to/tracker`.
3. `bun run db:seed-members --project <slug>` to let people in.
```

- [ ] **Step 5: Run the e2e and the whole suite**

Run: `bun run test:e2e -- e2e/project-import.spec.ts e2e/management.spec.ts && bun run check`
Expected: PASS — the management spec still finds "Import project", "New project", label "Name".

- [ ] **Step 6: Commit**

```bash
git add src/components/import-project-dialog.tsx src/app/page.tsx README.md e2e/project-import.spec.ts
git commit -m "project import: a folder of sheets becomes a binder

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

### Task 11: Rebuild the CLI on the shared modules

**Files:**
- Modify: `etl/export.ts` (rewrite on `writeSheet`/`cardToMarkdown`), `etl/import.ts` (use `planImport` + `applyPlan` with the service client; keep the CLI's *sync* semantics only where the spec says: the merge rule for lane), `docs/fichario.md` "Where it shows up" (paths), `README.md` (ETL table)
- Delete: `etl/frontmatter-write.ts`, `etl/export.test.ts` (their subject is gone; Task 3's tests cover the guarantees more strictly)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Rewrite `etl/export.ts`**

```ts
/**
 * Board → markdown tracker, from the command line.
 *
 *   bun run etl:export --project <slug> --board <slug> --source <dir> [--dry-run]
 *
 * The same writer the download uses: a file that exists under --source and has a
 * stored sheet is line-edited; a card with no file is written from scratch.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildVocabulary, tagRef } from "../src/lib/frontmatter/mapping";
import { cardToMarkdown, writeSheet } from "../src/lib/frontmatter/write";
import { loadBoardState } from "../src/lib/import/board-state";
import { sheetFromCard } from "../src/lib/import/plan";
import { arg, flag, loadBoard, serviceClient } from "./db";

const projectSlug = arg("project");
const boardSlug = arg("board");
const source = arg("source");
const dryRun = flag("dry-run");

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const state = await loadBoardState(db, ctx.board.id);
const { data: sources } = await db.from("cards").select("id, source_text").eq("board_id", ctx.board.id);
const sourceOf = new Map((sources ?? []).map((s) => [s.id as string, s.source_text as string | null]));
const vocab = buildVocabulary(state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)));
const resolve = (t: string) => {
  const r = tagRef(t, vocab);
  return r && "ref" in r ? r.ref : null;
};

let changed = 0;
let unchanged = 0;
for (const card of state.cards.values()) {
  const file = path.join(source, `${card.external_id}.md`);
  const sheet = sheetFromCard(card, state);
  let before: string | null = null;
  try {
    await stat(file);
    before = await readFile(file, "utf8");
  } catch {
    before = null;
  }
  // The file on disk is the base when it exists; the stored sheet otherwise; nothing for an app-born card.
  const base = before ?? sourceOf.get(card.id) ?? null;
  const after = base ? writeSheet(base, sheet, { tagRef: resolve }) : cardToMarkdown(sheet);
  if (after === before) {
    unchanged++;
    continue;
  }
  changed++;
  if (dryRun) {
    console.log(`would ${before ? "update" : "create"} ${card.external_id}.md → ${sheet.lane}#${sheet.rank ?? ""}`);
    continue;
  }
  await writeFile(file, after, "utf8");
  await db.from("cards").update({ source_text: after, lane_from_source: sheet.lane }).eq("id", card.id);
}
console.log(`${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug} → ${source}: ${changed} files created or updated, ${unchanged} unchanged`);
```

- [ ] **Step 2: Delete the shim and run the CLI against the demo board**

```bash
git rm etl/frontmatter-write.ts etl/export.test.ts
bun run etl:export --project demo --board backlog --source examples/tracker --dry-run
```
Expected: `0 files created or updated, 13 unchanged` (the fixtures were imported through the CLI, which stored their sheets, and nothing has been edited).

- [ ] **Step 3: Rewrite `etl/import.ts` on the planner**

Replace the file body with:
```ts
/**
 * Markdown tracker → board, from the command line.
 *
 *   bun run etl:import --project <slug> --board <slug> --source <dir> [--dry-run]
 *
 * The same planner the projects page uses, with one difference the spec keeps:
 * this is a *sync*, so a file moves an existing card between lanes only when
 * its `lane:` differs from what it said at the last sync (`lane_from_source`).
 * Everything else the file states wins, as on the page.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { laneMoveFromSource, type Mapping } from "../src/lib/frontmatter/mapping";
import { applyPlan } from "../src/lib/import/apply";
import { loadBoardState } from "../src/lib/import/board-state";
import { DEFAULT_MAPPING, planImport } from "../src/lib/import/plan";
import type { SheetFile } from "../src/lib/import/types";
import { arg, flag, loadBoard, serviceClient } from "./db";

const projectSlug = arg("project");
const boardSlug = arg("board");
const source = arg("source");
const dryRun = flag("dry-run");
const mappingPath = arg("mapping", "");

const db = serviceClient();
const ctx = await loadBoard(db, projectSlug, boardSlug);
const mapping: Mapping = mappingPath ? JSON.parse(await readFile(mappingPath, "utf8")) : DEFAULT_MAPPING;

const names = (await readdir(source)).filter((f) => /^\d+\.md$/.test(f));
if (!names.length) throw new Error(`no <id>.md files in ${source}`);
const files: SheetFile[] = [];
for (const name of names) files.push({ name, text: await readFile(path.join(source, name), "utf8") });

const state = await loadBoardState(db, ctx.board.id);
const { data: bases } = await db.from("cards").select("external_id, lane_from_source").eq("board_id", ctx.board.id);
const baseOf = new Map((bases ?? []).map((b) => [b.external_id as string, b.lane_from_source as string | null]));

const plan = planImport(files, state, mapping);
// Sync rule: an existing card only moves when the file changed its mind.
for (const row of plan.rows) {
  if (row.verdict !== "changed" || !row.patch.laneKey) continue;
  if (!laneMoveFromSource(row.patch.laneKey, baseOf.get(row.id))) {
    row.patch.laneKey = null;
    row.patch.rank = undefined;
    row.changes = row.changes.filter((c) => c.key !== "lane" && c.key !== "rank");
  }
}

for (const row of plan.rows)
  if (row.verdict === "error") console.error(`${row.id}.md: ${row.message}`);
if (!plan.ok) process.exit(1);

if (dryRun) {
  for (const row of plan.rows)
    if (row.verdict !== "unchanged")
      console.log(`${row.verdict} #${row.id}${row.verdict === "new" ? ` → ${row.lane}` : ""}${row.verdict === "changed" ? ` [${row.changes.map((c) => c.key).join(", ")}]` : ""}`);
} else {
  await applyPlan(db, state, plan, "etl");
}
console.log(`${dryRun ? "[dry-run] " : ""}${projectSlug}/${boardSlug}: ${plan.counts.new} created, ${plan.counts.changed} updated, ${plan.counts.unchanged} unchanged (${files.length} files)`);
if (plan.unappliedTags.length) {
  console.warn(`\n${plan.unappliedTags.length} tag(s) no group declares were NOT applied:`);
  for (const t of plan.unappliedTags) console.warn(`  ${t.tag} — ${t.cards.length} card(s): ${t.cards.slice(0, 8).join(", ")}`);
}
```

- [ ] **Step 4: Prove the round trip from the command line**

```bash
bun run db:reset
bun run etl:import --project demo --board backlog --source examples/tracker
bun run etl:import --project demo --board backlog --source examples/tracker --dry-run
```
Expected: first run `13 created`; second `0 created, 0 updated, 13 unchanged`.

Then, without editing anything: `bun run etl:export --project demo --board backlog --source examples/tracker --dry-run` → `13 unchanged`, and `git status examples/tracker` clean.

- [ ] **Step 5: Update the doc pointers**

In `docs/fichario.md` "Where it shows up", change `etl/import.ts`, `etl/export.ts` — *sheets in, margin out* to: `src/lib/import/plan.ts`, `src/lib/frontmatter/write.ts` — *sheets in, sheets out* and add `docs/superpowers/specs/2026-08-29-board-import-export-design.md`. In `README.md`'s ETL table, update the `etl:import` row's text to: *"Same planner as the projects page; a file only moves an existing card when its `lane:` changed since the last sync."*

- [ ] **Step 6: Full suite, check, commit**

```bash
bun test && bun run check && bun run test:e2e
git add -A etl docs/fichario.md README.md
git commit -m "etl: the command line runs on the same planner and writer as the page

Claude-Session: https://claude.ai/code/session_01Qg7CHv1VLuHeppZ1ADEc3s"
```

---

## Self-review

- **Spec coverage.** Semantics (Task 5, 6), dry run + re-plan on apply (Task 7), all-or-nothing (Task 5 `ok`, Task 6 throws), `source_text` + rebase (Tasks 6, 8, 11), line-edit export with the three body modes (Task 3), schema as contract incl. drift test, generated contract panel, `tracker-item` dropped (Tasks 1, 9), `fflate` + 4 MB cap (Task 4), lane/group/tag creation rules (Tasks 5, 6), no compensating delete + "exists and is empty" message (Tasks 7, 10), binder affordances and the two dialogs (Tasks 9, 10), owner/member gates (Task 7), CLI rebuilt on shared modules (Task 11), e2e for import-twice, changed row, export byte-identity, project import (Tasks 8–10). The seven writer guarantees in the spec map to the nine tests in Task 3 plus the CLI proof in Task 11 Step 4.
- **Gaps accepted.** The e2e "post a comment → export diff is only the comment" guarantee is covered at unit level (Task 3) rather than end to end; adding it to `e2e/export-zip.spec.ts` is a small follow-up once the comment composer is stable under Playwright.
- **Type consistency.** `Plan`/`PlanRow`/`CardPatch` defined in Task 4 and used unchanged in 5, 6, 7, 9, 11; `CardSheet`/`SHEET_KEYS`/`SHEET_KEY_ORDER` from Task 2 used in 3, 5, 8; `sheetFromCard` lives in `plan.ts` (Task 5) and is imported by 8 and 11; `writeSheet(sourceText, sheet, { tagRef })` signature identical in 3, 8, 11; `applyPlan(db, state, plan, actor)` identical in 6, 7, 11; `BinderBoard.id` added in Task 9 and supplied by `page.tsx`.
