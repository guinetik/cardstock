# Card Assignee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every card one optional assignee drawn from its project roster, settable on the card page and in the create dialog, filterable on the board, and stated in frontmatter as an email.

**Architecture:** Two new columns on `cards` — `assignee_id uuid` (the live relation) and `assignee citext` (what the file says) — mirroring the existing `epic_id` / `epic` pair. The frontmatter layer treats `assignee` as one more `SHEET_KEYS` entry; the importer resolves the email to a member id through a map loaded once per run and keeps the text when it resolves to nobody. All three UI surfaces read one roster loaded by `loadBoard`.

**Tech Stack:** Next.js (App Router, server actions), Supabase Postgres with RLS, TypeScript, zod, Bun test runner, Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-09-03-card-assignee-design.md`

## Global Constraints

- **One assignee per card.** No join table, no array. A card has an assignee or it does not.
- **The frontmatter key is `assignee` and its value is an email**, e.g. `assignee: joao@gmail.com`. Never a display name, never a bare local-part.
- **An email that matches no member is never an error and is never dropped.** Import keeps the text and leaves `assignee_id` null.
- **`assignee_id` and `assignee` are always written in the same patch.** No code path sets one without the other.
- **Roster membership is enforced in the server action only**, never by a database constraint — import must be able to write off-roster text.
- **No RLS migration.** `members_read` already allows `shares_project_with(id)` and `cards_rw` already gates the write; adding policies is out of scope.
- **House style:** Biome formatting (`bun run check` must pass — that is `biome check && tsc --noEmit`). Field labels in the card editor use the existing `fieldLabel` / `field` class constants. History facts are verbs, never field dumps, and never `JSON.stringify(payload)`.
- **Copy:** the empty option in every assignee select reads `Unassigned`. The filter chip for nobody reads `unassigned` (lowercase, matching the epic filter). The chip for the signed-in member reads `Me`.
- **Commit style:** Conventional Commits (`feat:`, `test:`, `docs:`), matching the existing log.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260909000000_card_assignee.sql` | The two columns and their index. |
| `src/lib/assignee.ts` | Pure helpers shared by every surface: normalising an email, and labelling a person. No React, no database — so it can be unit-tested directly and imported by both server and client code. |
| `src/lib/assignee.test.ts` | Tests for the above. |
| `e2e/assignee.spec.ts` | The three browser journeys. |

**Modified**

| File | Change |
|---|---|
| `src/lib/frontmatter/schema.ts` | `assignee` key on `frontmatterSchema`. |
| `src/lib/frontmatter/sheet.ts` | `CardSheet.assignee`, a `SHEET_KEYS` entry, and the read in `sheetFromFrontmatter`. |
| `src/lib/frontmatter/write.test.ts` | Round-trip coverage. |
| `src/lib/import/types.ts` | `assignee` / `assignee_id` on `ExistingCard`; `members` on `BoardState`. |
| `src/lib/import/board-state.ts` | Select the columns; load the roster map. |
| `src/lib/import/plan.ts` | `sheetFromCard` reads it; `columnsFor` writes the text column. |
| `src/lib/import/apply.ts` | Resolve email → member id, write `assignee_id`. |
| `src/lib/types.ts` | `assignee_id` / `assignee` on `Card`; `BoardData.people`. |
| `src/lib/board-data.ts` | Card select list; the roster query. |
| `src/lib/filters.ts` | `Filters.assignee`, `ASSIGNEE_FILTER_NONE`, `matches`, `isFiltering`, `emptyFilters`, `toCsv`. |
| `src/lib/filters.test.ts` | Filter coverage. |
| `src/lib/card-history.ts` | `assignee` in `EDIT_ORDER` and `editField`. |
| `src/lib/card-history.test.ts` | History coverage. |
| `src/app/p/[project]/b/[board]/actions.ts` | `assignCard`; card select list; `createCard` accepts `assigneeId`. |
| `src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx` | The Assignee select. |
| `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx` | Pass the roster to the editor. |
| `src/components/board/board-view.tsx` | Pass the roster and the signed-in member to the filter bar. |
| `src/components/board/filter-bar.tsx` | The Assignee fieldset. |
| `src/components/board/card-create-dialog.tsx` | The Assignee select. |
| `docs/frontmatter.schema.json` | The `assignee` property. |
| `docs/card-detail.md`, `docs/board-cards.md` | Document the field. |

**Task order.** Tasks 1–2 are the foundation (schema, shared helpers). Tasks 3–5 are the file round trip, which is testable with no UI at all. Tasks 6–7 are the data load and write path. Tasks 8–10 are the three surfaces. Task 11 is history. Task 12 is docs and the browser pass. Each task ends green and committed.

---

### Task 1: Schema

**Files:**
- Create: `supabase/migrations/20260909000000_card_assignee.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.cards.assignee_id uuid null` (FK → `public.members(id)`, `on delete set null`) and `public.cards.assignee citext null`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260909000000_card_assignee.sql`:

```sql
-- One assignee per card, drawn from the project roster.
-- Spec: docs/superpowers/specs/2026-09-03-card-assignee-design.md
--
-- Two columns, exactly as `epic_id` / `epic`: the FK is the live relation the
-- app joins on, the text is what the tracker file says. A file may name an
-- email that belongs to nobody yet — import keeps the text and leaves the FK
-- null rather than dropping the line, because the file is the source of truth.
--
-- There is deliberately NO constraint tying the assignee to `project_members`:
-- import must be able to carry an off-roster email. The roster rule is enforced
-- in `assignCard`, the only path a person takes interactively.
alter table public.cards
  add column assignee_id uuid references public.members(id) on delete set null,
  add column assignee    citext;

create index cards_board_assignee on public.cards (board_id, assignee_id);
```

- [ ] **Step 2: Apply it and verify the columns exist**

Run:

```bash
bun run db:reset
```

Then:

```bash
docker exec -i supabase_db_cardstock psql -U postgres -c "\d public.cards" | grep assignee
```

Expected: two rows, `assignee_id | uuid` and `assignee | citext`.

- [ ] **Step 3: Verify RLS still passes**

Run: `bun run db:test`
Expected: PASS — the owner RLS suite is unaffected, which is the point of adding no policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260909000000_card_assignee.sql
git commit -m "feat: add assignee columns to cards"
```

---

### Task 2: Shared assignee helpers

A tiny module so the select, the filter chips, and the history line all label a person the same way, and so email comparison is case-insensitive in TypeScript the way `citext` is in Postgres.

**Files:**
- Create: `src/lib/assignee.ts`
- Test: `src/lib/assignee.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export interface Person { memberId: string; email: string; displayName: string | null }`
  - `export function normaliseEmail(value: string | null | undefined): string | null` — trimmed and lowercased, or null when blank.
  - `export function personLabel(person: Person): string` — `displayName` when it has content, else the email.
  - `export function findPerson(people: readonly Person[], email: string | null | undefined): Person | null` — case-insensitive lookup.

- [ ] **Step 1: Write the failing test**

Create `src/lib/assignee.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { findPerson, normaliseEmail, type Person, personLabel } from "./assignee";

const JOAO: Person = {
  memberId: "11111111-1111-4111-8111-111111111111",
  email: "joao@example.test",
  displayName: "Joao",
};
const SAM: Person = {
  memberId: "22222222-2222-4222-8222-222222222222",
  email: "sam@example.test",
  displayName: null,
};

describe("normaliseEmail", () => {
  test("trims and lowercases", () => {
    expect(normaliseEmail("  Joao@Example.Test ")).toBe("joao@example.test");
  });
  test("blank and nullish become null", () => {
    expect(normaliseEmail("   ")).toBeNull();
    expect(normaliseEmail(null)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
  });
});

describe("personLabel", () => {
  test("prefers the display name", () => {
    expect(personLabel(JOAO)).toBe("Joao");
  });
  test("falls back to the email when there is no name", () => {
    expect(personLabel(SAM)).toBe("sam@example.test");
  });
  test("a blank display name is not a name", () => {
    expect(personLabel({ ...SAM, displayName: "  " })).toBe("sam@example.test");
  });
});

describe("findPerson", () => {
  test("matches regardless of case, like citext", () => {
    expect(findPerson([JOAO, SAM], "JOAO@example.test")).toBe(JOAO);
  });
  test("an unknown or blank email finds nobody", () => {
    expect(findPerson([JOAO, SAM], "nobody@example.test")).toBeNull();
    expect(findPerson([JOAO, SAM], null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test src/lib/assignee.test.ts`
Expected: FAIL — `Cannot find module './assignee'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/assignee.ts`:

```ts
/**
 * One assignee, three surfaces. The card select, the filter chips, and the
 * history line all label a person through here so a name never reads two ways.
 *
 * `members.email` is `citext`, so every comparison in TypeScript lowercases
 * first — otherwise a file saying `Joao@x.test` would resolve in Postgres and
 * miss in the browser.
 */

export interface Person {
  memberId: string;
  email: string;
  displayName: string | null;
}

/** Trimmed and lowercased, or null when there is nothing there. */
export function normaliseEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/** How a person is written on screen: their name, or their email when they have none. */
export function personLabel(person: Person): string {
  return person.displayName?.trim() || person.email;
}

/** The roster entry for an email, case-insensitively. Null when nobody matches. */
export function findPerson(
  people: readonly Person[],
  email: string | null | undefined,
): Person | null {
  const wanted = normaliseEmail(email);
  if (!wanted) return null;
  return people.find((p) => p.email.toLowerCase() === wanted) ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/assignee.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assignee.ts src/lib/assignee.test.ts
git commit -m "feat: add shared assignee helpers"
```

---

### Task 3: Frontmatter reads and writes `assignee`

**Files:**
- Modify: `src/lib/frontmatter/schema.ts`
- Modify: `src/lib/frontmatter/sheet.ts`
- Modify: `docs/frontmatter.schema.json`
- Test: `src/lib/frontmatter/write.test.ts`

**Interfaces:**
- Consumes: `normaliseEmail` from Task 2.
- Produces: `CardSheet.assignee: string | null`, and a `SHEET_KEYS.assignee` entry positioned between `area` and `raised_by` — which fixes where the key lands in newly written files and in `SHEET_KEY_ORDER`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/frontmatter/write.test.ts`, inside the existing `describe("writeSheet", …)` block:

```ts
  test("an added assignee is written after area", () => {
    const out = writeSheet(FILE, {
      ...sheetOf(FILE),
      assignee: "joao@example.test",
    });
    const lines = out.split("\n");
    expect(lines).toContain("assignee: joao@example.test");
    expect(lines.indexOf("assignee: joao@example.test")).toBe(
      lines.indexOf("area: Designer") + 1,
    );
  });

  test("an assignee already in the file round-trips byte-identically", () => {
    const withAssignee = FILE.replace(
      "raised_by: Sam",
      "assignee: joao@example.test\nraised_by: Sam",
    );
    expect(writeSheet(withAssignee, sheetOf(withAssignee))).toBe(withAssignee);
  });

  test("an email belonging to nobody is still read off the file", () => {
    const withStranger = FILE.replace(
      "raised_by: Sam",
      "assignee: stranger@nowhere.test\nraised_by: Sam",
    );
    expect(sheetOf(withStranger).assignee).toBe("stranger@nowhere.test");
  });

  test("a cleared assignee removes the line", () => {
    const withAssignee = FILE.replace(
      "raised_by: Sam",
      "assignee: joao@example.test\nraised_by: Sam",
    );
    const out = writeSheet(withAssignee, {
      ...sheetOf(withAssignee),
      assignee: null,
    });
    expect(out).not.toContain("assignee:");
    expect(out).toContain("raised_by: Sam");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test src/lib/frontmatter/write.test.ts`
Expected: FAIL — TypeScript rejects `assignee` as an unknown property of `CardSheet`, and the round-trip test finds `assignee:` treated as an unknown extra key.

- [ ] **Step 3: Add the schema key**

In `src/lib/frontmatter/schema.ts`, inside `frontmatterSchema`, add the line immediately **after** `area: z.string().min(1),`:

```ts
  assignee: z.string().nullable().optional(),
```

`KNOWN_KEYS` is derived from `frontmatterSchema.shape`, so this also stops `assignee` being collected as an unknown `extra` key.

- [ ] **Step 4: Add it to the sheet**

In `src/lib/frontmatter/sheet.ts`, three edits.

Add to the `CardSheet` interface, after `area: string;`:

```ts
  /** The assignee's email as the file states it. May match no member. */
  assignee: string | null;
```

Add to `SHEET_KEYS`, between the `area` and `raised_by` entries — this position is what the ordering test pins:

```ts
  assignee: { get: (s: CardSheet) => s.assignee },
```

Add to the object returned by `sheetFromFrontmatter`, after `area: fm.area,`:

```ts
    assignee: normaliseEmail(fm.assignee),
```

and add the import at the top of the file:

```ts
import { normaliseEmail } from "@/lib/assignee";
```

- [ ] **Step 5: Add the key to the published schema**

In `docs/frontmatter.schema.json`, add this property immediately after the `"area"` property object:

```json
    "assignee": {
      "anyOf": [
        {
          "type": "string"
        },
        {
          "type": "null"
        }
      ]
    },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test src/lib/frontmatter/`
Expected: PASS — the four new tests plus every existing frontmatter test. If an existing test fails on `CardSheet` missing `assignee`, add `assignee: null` to that test's literal; do not change `SHEET_KEYS`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/frontmatter/schema.ts src/lib/frontmatter/sheet.ts src/lib/frontmatter/write.test.ts docs/frontmatter.schema.json
git commit -m "feat: read and write the assignee frontmatter key"
```

---

### Task 4: The planner carries the assignee text

**Files:**
- Modify: `src/lib/import/types.ts`
- Modify: `src/lib/import/board-state.ts`
- Modify: `src/lib/import/plan.ts`
- Test: `src/lib/import/plan.test.ts`

**Interfaces:**
- Consumes: `CardSheet.assignee` (Task 3), `Person` (Task 2).
- Produces: `BoardState.members: Person[]`; a `columnsFor` branch writing `{ assignee: … }`.

**Already done in Task 3 — do not redo:** `ExistingCard.assignee` /
`ExistingCard.assignee_id` exist, `board-state.ts`'s cards `select(…)` already
carries both columns, and `sheetFromCard` already returns `assignee: card.assignee`.
Task 3's fix round pulled these forward, because leaving them until now made an
export between the two commits strip a stated `assignee:` line and rebase the
loss into `source_text`. Steps 3-5 below are written against the original state;
apply only the parts not already present, and say in your report which were
already there.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/import/plan.test.ts`:

```ts
test("a file naming an assignee plans the text column", () => {
  const state = emptyState();
  const plan = planImport(
    [{ name: "1.md", text: fileWith("assignee: joao@example.test") }],
    state,
  );
  expect(plan.rows[0].verdict).toBe("new");
  expect(plan.rows[0].patch?.columns.assignee).toBe("joao@example.test");
});

test("an email belonging to nobody is planned, not dropped", () => {
  const state = emptyState();
  const plan = planImport(
    [{ name: "1.md", text: fileWith("assignee: stranger@nowhere.test") }],
    state,
  );
  expect(plan.rows[0].patch?.columns.assignee).toBe("stranger@nowhere.test");
});

test("a file that drops the assignee line leaves the board's value alone", () => {
  // Absent is not the same as empty: a key the file does not state is not a
  // change, so an unassigned file must not unassign a card the app assigned.
  const state = emptyState();
  state.cards.set("1", {
    ...existingCard(),
    external_id: "1",
    assignee: "joao@example.test",
    assignee_id: "11111111-1111-4111-8111-111111111111",
  });
  const plan = planImport([{ name: "1.md", text: fileWith("") }], state);
  expect(plan.rows[0].patch?.columns).not.toHaveProperty("assignee");
});
```

Use whatever fixture helpers `plan.test.ts` already defines. If it has no `fileWith` / `emptyState` / `existingCard` helper, build the fixtures the way the tests already in that file do — the point of each test is the assertion, not the fixture shape.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test src/lib/import/plan.test.ts`
Expected: FAIL — `columns.assignee` is `undefined`, and TypeScript rejects `assignee` on `ExistingCard`.

- [ ] **Step 3: Extend the import types**

In `src/lib/import/types.ts`, add to `ExistingCard` after `area: string | null;`:

```ts
  assignee: string | null;
  assignee_id: string | null;
```

and add to `BoardState` after the `epics` field:

```ts
  /** The project roster, for resolving an assignee email to a member id. */
  members: Person[];
```

with the import at the top of the file:

```ts
import type { Person } from "@/lib/assignee";
```

- [ ] **Step 4: Load the columns and the roster**

In `src/lib/import/board-state.ts`:

Add `assignee, assignee_id, ` to the cards `select(…)` string, immediately after `area, `.

Add a fifth promise to the `Promise.all` array, after the epics query:

```ts
    db
      .from("boards")
      .select("project_id, projects!inner(project_members(members(id, email, display_name)))")
      .eq("id", boardId)
      .maybeSingle(),
```

destructured as `{ data: roster, error: rosterError }`, with the matching guard beside the others:

```ts
  if (rosterError) throw new Error(`board state: roster: ${rosterError.message}`);
```

and shape it just before the `return`:

```ts
  // The roster is read through the board's project so import resolves an
  // assignee email without the caller having to know the project id.
  const memberships =
    (roster as unknown as {
      projects?: { project_members?: { members?: { id: string; email: string; display_name: string | null } | null }[] } | null;
    } | null)?.projects?.project_members ?? [];
  const members: Person[] = memberships
    .map((m) => m.members)
    .filter((m): m is { id: string; email: string; display_name: string | null } => m != null)
    .map((m) => ({ memberId: m.id, email: m.email, displayName: m.display_name }));
```

then add `members,` to the returned object, and import `Person`:

```ts
import type { Person } from "@/lib/assignee";
```

- [ ] **Step 5: Read and write it in the planner**

In `src/lib/import/plan.ts`, `sheetFromCard` already returns `assignee: card.assignee` (Task 3). Widen it to prefer the member's live email:

```ts
    // Prefer the member's current email over the stored text: the owner may
    // have corrected an address, and the export should carry the live one.
    assignee:
      state.members.find((m) => m.memberId === card.assignee_id)?.email ??
      card.assignee,
```

and add to `columnsFor`, immediately after the `set("area", …)` line:

```ts
  set("assignee", () => ({ assignee: sheet.assignee }));
```

`set` already respects `presentKeys`, so a file that does not state `assignee` produces no column — which is what the third test asserts.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test src/lib/import/`
Expected: PASS — the three new tests plus every existing import test. Existing `ExistingCard` fixtures will need `assignee: null, assignee_id: null` added; existing `BoardState` fixtures will need `members: []`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/import/types.ts src/lib/import/board-state.ts src/lib/import/plan.ts src/lib/import/plan.test.ts
git commit -m "feat: plan the assignee column on import"
```

---

### Task 5: The applier resolves the email to a member

**Files:**
- Modify: `src/lib/import/apply.ts`

**Interfaces:**
- Consumes: `BoardState.members` (Task 4), `findPerson` (Task 2).
- Produces: a written `assignee_id` on every row whose patch carries `assignee`.

- [ ] **Step 1: Resolve alongside the epic**

In `src/lib/import/apply.ts`, add this immediately after the `epic()` helper (the block ending `return data.id; }`):

```ts
  // Unlike an epic, a person is never created by an import. An email that
  // matches nobody leaves the FK null and keeps the text, so a sheet written
  // before someone was invited still says who it is for.
  const memberByEmail = (email: unknown): string | null =>
    typeof email === "string"
      ? (findPerson(state.members, email)?.memberId ?? null)
      : null;
```

and add the import at the top of the file:

```ts
import { findPerson } from "@/lib/assignee";
```

- [ ] **Step 2: Write the FK with the row**

In the `for (const row of plan.rows)` loop, immediately after the `if (row.patch.epic !== undefined) …` line, add:

```ts
    if ("assignee" in columns)
      columns.assignee_id = memberByEmail(columns.assignee);
```

`columns` is spread from `row.patch.columns` above, so the key is present exactly when the file stated one — the FK and the text stay in step, per the global constraint.

- [ ] **Step 3: Verify the whole import suite passes**

Run: `bun test src/lib/import/`
Expected: PASS.

- [ ] **Step 4: Verify the round trip end to end**

Run: `bun run check`
Expected: PASS — no type errors, no lint findings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/apply.ts
git commit -m "feat: resolve the assignee email to a member on import"
```

---

### Task 6: The board loads its roster

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/board-data.ts`

**Interfaces:**
- Consumes: `Person` (Task 2).
- Produces: `Card.assignee_id: string | null`, `Card.assignee: string | null`, and `BoardData.people: Person[]` — sorted by `personLabel`, which every surface in Tasks 8–10 reads.

- [ ] **Step 1: Extend the card type**

In `src/lib/types.ts`, add to the `Card` interface, next to `raised_by`:

```ts
  assignee_id: string | null;
  /** The assignee's email. Set even when `assignee_id` is null (an off-roster file). */
  assignee: string | null;
```

and add to `BoardData`:

```ts
  /** This board's project roster, for the assignee select and filter. */
  people: Person[];
```

with `import type { Person } from "@/lib/assignee";` at the top.

- [ ] **Step 2: Select the columns and the roster**

In `src/lib/board-data.ts`, add `assignee_id, assignee, ` to the cards `select(…)` string immediately after `area, `.

Add a seventh promise to the `Promise.all`, after the epics query:

```ts
    db
      .from("project_members")
      .select("members(id, email, display_name)")
      .eq("project_id", project.id),
```

destructured as `{ data: memberships }`, and build the list before the return:

```ts
  const people: Person[] = ((memberships ?? []) as unknown as {
    members: { id: string; email: string; display_name: string | null } | null;
  }[])
    .map((row) => row.members)
    .filter((m): m is { id: string; email: string; display_name: string | null } => m != null)
    .map((m) => ({ memberId: m.id, email: m.email, displayName: m.display_name }))
    .sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
```

then add `people,` to the returned `BoardData`, and import:

```ts
import { type Person, personLabel } from "@/lib/assignee";
```

- [ ] **Step 3: Add the columns to the board actions select**

In `src/app/p/[project]/b/[board]/actions.ts`, add `assignee_id, assignee, ` to the card `select(…)` string (around line 220), immediately after `area, `, so a card refetched after a write carries the same shape the page loaded.

- [ ] **Step 4: Verify it type-checks and the app boots**

Run: `bun run check`
Expected: PASS. Any card fixture in a `.test.ts` that now fails needs `assignee_id: null, assignee: null` added.

Run: `bun run dev`, open a board, confirm it renders. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/board-data.ts "src/app/p/[project]/b/[board]/actions.ts"
git commit -m "feat: load the project roster with the board"
```

---

### Task 7: The `assignCard` server action

**Files:**
- Modify: `src/app/p/[project]/b/[board]/actions.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime; mirrors `assignCardEpic` in `src/app/p/[project]/b/[board]/cockpit/actions.ts`.
- Produces: `export async function assignCard(cardId: string, memberId: string | null): Promise<{ ok: true } | { ok: false; error: string }>` — used by Tasks 8 and 10.

- [ ] **Step 1: Write the action**

Add to `src/app/p/[project]/b/[board]/actions.ts`. Reuse the `UUID` regexp already in the file if there is one; if not, copy the constant from `cockpit/actions.ts`.

```ts
/**
 * Hand a card to somebody on its project, or take it back.
 *
 * Writes the FK and the tracker text in one patch so exported frontmatter
 * always mirrors the assignment, exactly as `assignCardEpic` does. The roster
 * check here is the only one there is — the database deliberately allows an
 * off-roster email so that import can carry a file naming someone not yet
 * invited.
 */
export async function assignCard(
  cardId: string,
  memberId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await currentMember();
  if (!me) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  if (memberId !== null && !UUID.test(memberId))
    return { ok: false, error: "Invalid person." };

  const db = await supabaseServer();
  let email: string | null = null;
  if (memberId) {
    const { data: card } = await db
      .from("cards")
      .select("board_id, boards!inner(project_id)")
      .eq("id", cardId)
      .maybeSingle();
    const projectId = (card as unknown as { boards?: { project_id: string } } | null)
      ?.boards?.project_id;
    if (!projectId) return { ok: false, error: "Card not found." };
    const { data: membership } = await db
      .from("project_members")
      .select("members!inner(email)")
      .eq("project_id", projectId)
      .eq("member_id", memberId)
      .maybeSingle();
    const found = (membership as unknown as { members?: { email: string } } | null)
      ?.members?.email;
    if (!found) return { ok: false, error: "That person is not on this project." };
    email = found;
  }

  const { error } = await db
    .from("cards")
    .update({ assignee_id: memberId, assignee: email })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };

  // One key, not the two-column patch: the history formatter turns
  // `{assignee}` into a sentence, while `{assignee_id, assignee}` would read
  // "changed assignee_id and changed assignee".
  await db.from("card_events").insert({
    card_id: cardId,
    actor: me.email,
    kind: "edited",
    payload: { assignee: email },
  });

  revalidatePath("/p/[project]/b/[board]", "page");
  revalidatePath("/p/[project]/b/[board]/c/[externalId]", "page");
  return { ok: true };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/p/[project]/b/[board]/actions.ts"
git commit -m "feat: add the assignCard server action"
```

---

### Task 8: The card page select

**Files:**
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx`

**Interfaces:**
- Consumes: `assignCard` (Task 7), `BoardData.people` (Task 6), `findPerson` / `personLabel` (Task 2).
- Produces: a `people: Person[]` prop on the card editor.

- [ ] **Step 1: Extract the roster load, then pass it in**

`page.tsx` is a thin wrapper: it renders `<CardSheet>`, and `card-sheet.tsx` is
the server component that runs its own queries (including the `epics` one) and
renders `<CardEditor>`. It never sees `BoardData`, so there is no `data.people`
to hand down — the roster has to be queried there.

Rather than write the roster query and its shaping a third time (`board-data.ts`
and `import/board-state.ts` already have one each, and the Task 6 review flagged
the drift risk), extract it once. In `src/lib/board-data.ts`, pull the roster
query and shaping out of `loadBoard` into an exported function beside it:

```ts
/**
 * A project's roster as `Person[]`, sorted by label.
 *
 * Shared so the board, the card page, and anything else that offers people to
 * pick from order and label them identically — three copies of this shaping
 * would drift the first time the rule changes.
 */
export async function loadProjectRoster(
  db: SupabaseClient,
  projectId: string,
): Promise<Person[]> {
```

Move the existing body into it verbatim, have `loadBoard` call it, and confirm
the board still returns the same `people`. Then in `card-sheet.tsx`, call it
alongside the existing `epics` query and pass `people={people}` to
`<CardEditor>`.

Add `people: Person[];` to `CardEditor`'s props interface, with
`import type { Person } from "@/lib/assignee";`.

- [ ] **Step 2: Add the select**

In `card-editor.tsx`, inside the `<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">`, immediately after the Epic `<label>` block, add:

```tsx
        <label>
          <span className={fieldLabel}>Assignee</span>
          <select
            className={field}
            defaultValue={card.assignee_id ?? (offRoster ? OFF_ROSTER : "")}
            disabled={pending}
            onChange={(e) =>
              start(async () => {
                const value = e.target.value;
                if (value === OFF_ROSTER) return;
                const r = await assignCard(card.id, value || null);
                setMsg(r.ok ? "Saved" : r.error);
                router.refresh();
              })
            }
          >
            <option value="">Unassigned</option>
            {people.map((person) => (
              <option key={person.memberId} value={person.memberId}>
                {personLabel(person)}
              </option>
            ))}
            {offRoster && (
              // The file names somebody who is not on this project. It gets a
              // value of its own — sharing `""` with Unassigned would make the
              // browser select Unassigned instead, and the next save would
              // quietly erase what the file says.
              <option value={OFF_ROSTER} disabled>
                {offRoster} · not on this project
              </option>
            )}
          </select>
        </label>
```

Above the `return`, in the component body:

```tsx
  const offRoster =
    card.assignee && !findPerson(people, card.assignee) ? card.assignee : null;
```

and at module scope, above the component:

```tsx
/** Sentinel value for the "not on this project" option, so it never collides with Unassigned's `""`. */
const OFF_ROSTER = "__off_roster__";
```

Take `people` off props. Imports:

```tsx
import { assignCard } from "@/app/p/[project]/b/[board]/actions";
import { findPerson, personLabel } from "@/lib/assignee";
```

- [ ] **Step 3: Verify by hand**

Run: `bun run dev`. Open any card. Confirm: Assignee sits beside Epic, lists the roster, and defaults to *Unassigned*. Pick somebody, reload, the choice sticks. Set it back to *Unassigned*, reload, it is empty. Stop the server.

- [ ] **Step 4: Verify it type-checks**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/p/[project]/b/[board]/c/[externalId]"
git commit -m "feat: assign a card from the card page"
```

---

### Task 9: Filter the board by assignee

**Files:**
- Modify: `src/lib/filters.ts`
- Modify: `src/components/board/filter-bar.tsx`
- Modify: `src/components/board/board-view.tsx`
- Test: `src/lib/filters.test.ts`

**Interfaces:**
- Consumes: `BoardData.people` (Task 6), `Card.assignee_id` / `Card.assignee` (Task 6), `personLabel` (Task 2).
- Produces: `Filters.assignee: string | null`, `ASSIGNEE_FILTER_NONE`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/filters.test.ts`, using whatever card fixture factory the file already defines:

`matches` takes four arguments — `matches(card, filters, groups, lanes)`. Assignee
matching depends on neither groups nor lanes, so these tests pass empty arrays,
the way the file's other single-criterion tests do.

```ts
const MEMBER = "11111111-1111-4111-8111-111111111111";

test("filtering by a person keeps only their cards", () => {
  const mine = task({ assignee_id: MEMBER, assignee: "joao@example.test" });
  const theirs = task({ assignee_id: null, assignee: null });
  const f = { ...emptyFilters(), assignee: MEMBER };
  expect(matches(mine, f, [], [])).toBe(true);
  expect(matches(theirs, f, [], [])).toBe(false);
});

test("unassigned means no assignee at all", () => {
  const f = { ...emptyFilters(), assignee: ASSIGNEE_FILTER_NONE };
  expect(matches(task({ assignee_id: null, assignee: null }), f, [], [])).toBe(
    true,
  );
  expect(
    matches(task({ assignee_id: MEMBER, assignee: "joao@example.test" }), f, [], []),
  ).toBe(false);
});

test("a card whose file names an off-roster person is assigned, not unassigned", () => {
  // The FK is null because nobody matched, but somebody's name is on it.
  const stranger = task({ assignee_id: null, assignee: "stranger@nowhere.test" });
  const none = { ...emptyFilters(), assignee: ASSIGNEE_FILTER_NONE };
  expect(matches(stranger, none, [], [])).toBe(false);
  expect(matches(stranger, { ...emptyFilters(), assignee: MEMBER }, [], [])).toBe(
    false,
  );
});

test("an assignee filter counts as filtering", () => {
  expect(isFiltering({ ...emptyFilters(), assignee: MEMBER })).toBe(true);
  expect(isFiltering(emptyFilters())).toBe(false);
});
```

Import `ASSIGNEE_FILTER_NONE` alongside the existing imports. The `Partial<Card>`
fixture factory in this file is named `task`, not `card` (`card` is a different
two-argument helper) — use `task`.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test src/lib/filters.test.ts`
Expected: FAIL — `ASSIGNEE_FILTER_NONE` is not exported.

- [ ] **Step 3: Extend the filter model**

In `src/lib/filters.ts`:

Beside `EPIC_FILTER_NONE`, add:

```ts
/** Filter value for cards nobody is assigned to. */
export const ASSIGNEE_FILTER_NONE = "__none__";
```

In the `Filters` interface, after `epic`:

```ts
  /** One member id, {@link ASSIGNEE_FILTER_NONE} for nobody, or null for everyone. */
  assignee: string | null;
```

In `emptyFilters`, after `epic: null,`:

```ts
    assignee: null,
```

In `isFiltering`, add `f.assignee != null ||` beside the `f.epic != null ||` line.

In `matches`, after the epic block:

```ts
  if (f.assignee === ASSIGNEE_FILTER_NONE) {
    // An off-roster email is still somebody's name on the card, so a card with
    // text but no FK is assigned — it is just assigned to a stranger.
    if (card.assignee_id || card.assignee?.trim()) return false;
  } else if (f.assignee && card.assignee_id !== f.assignee) return false;
```

In `toCsv`, add `"assignee"` to the header array after `"epic"`, and `c.assignee ?? ""` at the matching position in the row array.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the filter bar fieldset**

In `src/components/board/filter-bar.tsx`, add to the props interface:

```ts
  people: Person[];
  /** The signed-in member's id, so their chip can read "Me". Null when they are not on the roster. */
  meMemberId: string | null;
```

Add after the epic `<fieldset>` block, following its `<details>` / `<summary>` / popover shape exactly:

```tsx
      {props.people.length > 0 && (
        <fieldset className="fieldset relative">
          <legend>Assignee</legend>
          <details
            name="filter-menu"
            data-key="assignee"
            onToggle={(e) => {
              if (e.currentTarget.open) setMenuOpen(true);
            }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 pb-0.5 text-[13px]">
              <span className="stat stat--muted">
                {f.assignee === ASSIGNEE_FILTER_NONE
                  ? "unassigned"
                  : f.assignee
                    ? (assigneeName.get(f.assignee) ?? "someone")
                    : "any"}
              </span>
              <Caret />
            </summary>
            <div className="absolute left-0 top-full z-20 mt-2 flex min-w-[10rem] max-w-[18rem] flex-col gap-1.5 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-lift)]">
              <button
                type="button"
                aria-pressed={f.assignee === null}
                className="stat stat--muted text-left"
                onClick={(e) => {
                  onChange({ ...f, assignee: null });
                  closeMenu(e.currentTarget);
                }}
              >
                any
              </button>
              <button
                type="button"
                aria-pressed={f.assignee === ASSIGNEE_FILTER_NONE}
                className="stat stat--muted text-left"
                onClick={(e) => {
                  onChange({
                    ...f,
                    assignee:
                      f.assignee === ASSIGNEE_FILTER_NONE
                        ? null
                        : ASSIGNEE_FILTER_NONE,
                  });
                  closeMenu(e.currentTarget);
                }}
              >
                unassigned
              </button>
              {ordered.map((person) => {
                const on = f.assignee === person.memberId;
                return (
                  <button
                    key={person.memberId}
                    type="button"
                    aria-pressed={on}
                    className="text-left text-[13px]"
                    onClick={(e) => {
                      onChange({
                        ...f,
                        assignee: on ? null : person.memberId,
                      });
                      closeMenu(e.currentTarget);
                    }}
                  >
                    {person.memberId === props.meMemberId
                      ? "Me"
                      : personLabel(person)}
                  </button>
                );
              })}
            </div>
          </details>
        </fieldset>
      )}
```

In the component body, beside the existing `epicName` map:

```tsx
  // You first: the commonest filter is "what is on my plate".
  const ordered = [...props.people].sort((a, b) =>
    a.memberId === props.meMemberId ? -1 : b.memberId === props.meMemberId ? 1 : 0,
  );
  const assigneeName = new Map(
    props.people.map((p) => [
      p.memberId,
      p.memberId === props.meMemberId ? "Me" : personLabel(p),
    ]),
  );
```

Imports:

```tsx
import { type Person, personLabel } from "@/lib/assignee";
import { ASSIGNEE_FILTER_NONE, EPIC_FILTER_NONE } from "@/lib/filters";
```

- [ ] **Step 6: Wire it up**

In `src/components/board/board-view.tsx`, at the `<FilterBar …>` call site (near the existing `epics={boardEpics}` prop), add:

```tsx
        people={data.people}
        meMemberId={
          data.people.find((p) => p.email.toLowerCase() === me.email.toLowerCase())
            ?.memberId ?? null
        }
```

`Me` carries an email but no member id, so the roster is what turns one into the other.

- [ ] **Step 7: Verify by hand**

Run: `bun run dev`. On a board with at least one assigned card: pick a person from the Assignee menu, the lanes narrow to their cards; pick *unassigned*, you get the complement; pick *any*, everything returns. Your own chip reads **Me** and sorts first. Stop the server.

- [ ] **Step 8: Verify the suite**

Run: `bun test && bun run check`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/filters.ts src/lib/filters.test.ts src/components/board/filter-bar.tsx src/components/board/board-view.tsx
git commit -m "feat: filter the board by assignee"
```

---

### Task 10: Assign from the create dialog

**Files:**
- Modify: `src/components/board/card-create-dialog.tsx`
- Modify: `src/app/p/[project]/b/[board]/actions.ts`
- Modify: `src/components/board/board-view.tsx`

**Interfaces:**
- Consumes: `assignCard` (Task 7), `BoardData.people` (Task 6).
- Produces: an optional `assigneeId?: string | null` on `createCard`'s input.

- [ ] **Step 1: Accept an assignee when creating**

In `src/app/p/[project]/b/[board]/actions.ts`, add `assigneeId?: string | null;` to `createCard`'s input interface.

Do **not** write the columns inside the insert. After the card row is successfully inserted and its id is known, call the action that already enforces the roster:

```ts
  // Routed through `assignCard` rather than written into the insert, so the
  // roster check and the history line exist on exactly one path. A rejected
  // assignee leaves a created, unassigned card rather than no card at all.
  if (input.assigneeId) await assignCard(card.id as string, input.assigneeId);
```

- [ ] **Step 2: Add the select**

In `src/components/board/card-create-dialog.tsx`, add `people: Person[];` to the props interface, a `const [assigneeId, setAssigneeId] = useState("");` beside the existing `epicId` state, `assigneeId: assigneeId || null,` to the payload the dialog submits, and this block immediately after the Epic `<label>`:

```tsx
              <label htmlFor="new-card-assignee">
                <span className={label}>Assignee</span>
                <select
                  id="new-card-assignee"
                  className={field}
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  disabled={busy}
                >
                  {/* Defaults to nobody, not to you: filing a card is not the
                      same as taking it. */}
                  <option value="">Unassigned</option>
                  {props.people.map((person) => (
                    <option key={person.memberId} value={person.memberId}>
                      {personLabel(person)}
                    </option>
                  ))}
                </select>
              </label>
```

Imports: `import { type Person, personLabel } from "@/lib/assignee";`.

Reset `setAssigneeId("")` wherever the dialog already resets `epicId` after a successful create.

- [ ] **Step 3: Pass the roster in**

In `src/components/board/board-view.tsx`, add `people={data.people}` at the `<CardCreateDialog …>` call site (near its existing `epics={data.epics}` prop).

- [ ] **Step 4: Verify by hand**

Run: `bun run dev`. Create a card with an assignee chosen. Open it: the Assignee select shows that person. Create one without: it opens *Unassigned*. Stop the server.

- [ ] **Step 5: Verify the suite**

Run: `bun test && bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/board/card-create-dialog.tsx src/components/board/board-view.tsx "src/app/p/[project]/b/[board]/actions.ts"
git commit -m "feat: assign a card as it is created"
```

---

### Task 11: The history line

**Files:**
- Modify: `src/lib/card-history.ts`
- Test: `src/lib/card-history.test.ts`

**Interfaces:**
- Consumes: the `{ assignee: string | null }` payload written in Task 7.
- Produces: no exports; `formatCardEvent`'s `facts` gains two sentences.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/card-history.test.ts`, following the shape of the tests already there:

The file's fixture helper is `ev(partial)`, and `formatCardEvent` takes three
arguments — `formatCardEvent(row, lanes, opts)` — with `lanes` and `opts` already
defined at the top of the file. Follow that idiom:

```ts
test("an assignment names the person", () => {
  const line = formatCardEvent(
    ev({ kind: "edited", payload: { assignee: "joao@example.test" } }),
    lanes,
    opts,
  );
  expect(line.facts).toBe("assigned this to Joao");
});

test("clearing the assignee says so", () => {
  const line = formatCardEvent(
    ev({ kind: "edited", payload: { assignee: null } }),
    lanes,
    opts,
  );
  expect(line.facts).toBe("unassigned this");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test src/lib/card-history.test.ts`
Expected: FAIL — the actual text is `changed assignee`, from the unknown-key fallback in `editedFacts`.

- [ ] **Step 3: Handle the key**

In `src/lib/card-history.ts`, add `"assignee",` to `EDIT_ORDER` immediately after `"status",`, and add this case to `editField`, in the same position:

```ts
    case "assignee":
      // The payload carries the email; the ledger says the person, using the
      // same capitalised local-part rule as the actor column.
      return typeof value === "string" && value
        ? `assigned this to ${formatActor(value)}`
        : "unassigned this";
```

`editField` is exhaustive over `EDIT_ORDER`, so TypeScript would have rejected the new entry without this case — that is the guard working.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/card-history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-history.ts src/lib/card-history.test.ts
git commit -m "feat: write assignment into the card history"
```

---

### Task 12: Browser coverage and docs

**Files:**
- Create: `e2e/assignee.spec.ts`
- Modify: `docs/card-detail.md`
- Modify: `docs/board-cards.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing other code reads.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/assignee.spec.ts`.

**Facts verified against the repo — use these, not the values an earlier draft of
this plan guessed:**

- The board path is `/p/demo/b/backlog`. Existing specs declare it as
  `const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";` — do the same.
- `attachToProject(email, slug, role)` takes the project **slug** (`"demo"`), not
  a project id. Do not wrap it in `projectId(...)`.
- There is no `data-testid="card"` in this codebase. Cards are located as
  `[data-lane="now"] [data-id] article` (see `e2e/card-peek-fields.spec.ts`) or
  `[data-lane="unsorted"] [data-id]` (see `e2e/board.spec.ts`). Use the existing
  idiom.
- `e2e/global-setup.ts` calls `resetDemoBoard()`, which imports `examples/tracker`,
  so the board has cards when the suite starts. A spec that mutates cards and
  needs a known state can call `resetDemoBoard()` itself in `test.beforeAll` —
  several specs do.
- `createMember(email, password)`, `dropMember(email)`, and `signIn(page)` are in
  `e2e/support/sign-in.ts`. `createMember` sets `display_name` to `"E2E user"`,
  so a roster option for that member is labelled **`E2E user`**, not the email —
  `personLabel` prefers the display name. Select and assert accordingly.
- `playwright.config.ts` sets `reuseExistingServer: true`, so the suite attaches
  to an already-running dev server rather than fighting for port 3000.

Write three tests, following the file idiom above:

1. **A card is handed to somebody and the choice sticks.** Sign in, open a card's
   page, select the teammate in the Assignee select, reload, assert the selection
   survived.
2. **The history records who it went to.** After assigning, reload the card page
   and assert a history line matching `/assigned this to/i` is visible.
3. **Filtering by a person narrows the board.** Assign one card, go to the board,
   open the Assignee filter menu, choose that person, and assert the visible card
   count drops to exactly the assigned card — and that it was more than that
   before.

The assertions above are the contract. The selectors are yours to match against
the specs already in `e2e/`; read `e2e/board.spec.ts` and
`e2e/card-peek-fields.spec.ts` first and follow what they do.

- [ ] **Step 2: Run the e2e spec**

Run: `bun run test:e2e -- assignee.spec.ts`
Expected: PASS, 3 tests. If the assignee select is not reachable by `getByLabel("Assignee")`, the label markup in Task 8 needs an `id`/`htmlFor` pair — fix the component, not the test.

- [ ] **Step 3: Document it**

In `docs/card-detail.md`, in the **Fields** section, extend the first paragraph's list so it reads `… dates, audience, Status, Assignee, and color sit in a labeled grid …`, and add after that paragraph:

```markdown
Assignee is a native select of the project roster (`BoardData.people`), saved through `assignCard`, which writes `assignee_id` and the `assignee` email in one patch so exported frontmatter mirrors it. A card whose file names somebody off the roster shows that email as a disabled selected option — editing another field never erases what the file says.
```

In `docs/board-cards.md`, add a short section:

```markdown
## Assignee

One person per card, or nobody. The board does not draw a portrait on the card — assignment shows on the card page and in the Assignee filter, which offers every project member plus `unassigned`, with your own chip first and labelled `Me`. See `docs/superpowers/specs/2026-09-03-card-assignee-design.md`.
```

- [ ] **Step 4: Full verification**

Run: `bun test && bun run check && bun run test:e2e`
Expected: PASS across all three. Report any failure with its output rather than proceeding.

- [ ] **Step 5: Commit**

```bash
git add e2e/assignee.spec.ts docs/card-detail.md docs/board-cards.md
git commit -m "test: cover assignment in the browser, and document it"
```

---

## Verification checklist

Run at the end, and paste the output rather than summarising it:

- [ ] `bun test` — every unit test passes.
- [ ] `bun run check` — Biome and `tsc --noEmit` clean.
- [ ] `bun run test:e2e` — the browser suite passes.
- [ ] `bun run db:test` — the RLS suite passes.
- [ ] Round trip by hand: assign a card in the UI → download the project export → the file's frontmatter contains `assignee: <email>` after `area` → hand-edit the file to a stranger's address → re-import → the card shows that address as off-roster and the import reports no error.
