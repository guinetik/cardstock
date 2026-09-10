# Card Stencils Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a board define named stencils — reusable card shapes carrying a title, summary, body, checklist and tags — and stamp a new card from one in a single choice.

**Architecture:** Two board-scoped tables (`card_stencils`, `card_stencil_tags`). A stencil's checklist lives inside its `body_md` as a `## Checklist` section, so the existing `parseChecklist` path in `createCard` turns it into real `card_checklist_items` rows with no change to card creation. Stamping builds the `initialValues` object `CardCreateDialog` already accepts for card cloning. The board's existing `settings.card_template` is untouched and remains the fallback for a blank card.

**Tech Stack:** Next.js (App Router, server actions), React 19, Supabase/Postgres with RLS, `@cardstock/core` for checklist parse/serialise, bun test, Playwright, Biome.

**Spec:** `docs/specs/2026-09-10-card-stencils-design.md`

## Global Constraints

- **Do not start until the checklist feature is committed and settled.** This plan depends on `parseChecklist`, `writeChecklist`, `composeChecklist` and `card_checklist_items`. If that markdown contract shifts, the data model shifts with it.
- **This is NOT the Next.js you know.** Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. APIs and conventions differ from training data.
- **Never touch `boards.settings.card_template`,** `CARD_TEMPLATE_SETTING` or `cardTemplate()`. The board card template is a separate feature and stays exactly as it is. It remains the body fallback when no stencil is chosen.
- **Stencils are board-scoped.** No project-scoped or personal stencils.
- **A stencil has no `priority` and no `position` column.** Priority is per-card triage, not a property of a kind of work. Stencils sort alphabetically by name.
- **The checklist lives in `body_md`.** There is no stencil-side checklist table. One markdown format, one source of truth.
- **Stamping is a copy, not a link.** Cards store no reference to the stencil they came from; editing a stencil never changes existing cards.
- `effort` is constrained to `'L'`, `'M'`, `'H'` — identical to the `cards` constraint.
- Vocabulary: a single one is a **stencil**. Never "template", "preset" or "board template" in code, UI copy or docs. ("Packet" is the Phase 2 collection and is not built here.)
- RLS is a single `for all` policy on `is_project_member(board_project(board_id))`, mirroring `lanes`. `canManage` is enforced in the server action, mirroring `updateCardTemplate`.
- Run `bunx biome check --write <files>` before every commit. Do not run `bun run build` without asking.

---

### Task 1: Schema and RLS

**Files:**
- Create: `supabase/migrations/20260920000000_card_stencils.sql`
- Test: `supabase/tests/card_stencils.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `public.card_stencils` (columns `id`, `board_id`, `name`, `title`, `summary`, `body_md`, `area`, `effort`, `created_at`, `updated_at`) and `public.card_stencil_tags` (`stencil_id`, `tag_id`); function `public.stencil_project(uuid) returns uuid`.

- [ ] **Step 1: Write the failing RLS test**

Create `supabase/tests/card_stencils.sql`:

```sql
begin;
insert into public.members(id,email,role) values
  ('97200000-0000-4000-8000-000000000001','stencil-member@example.test','member'),
  ('97200000-0000-4000-8000-000000000002','stencil-outsider@example.test','member');
insert into public.projects(id,slug,name) values('97200000-0000-4000-8000-000000000003','stencil-rls-test','Stencil');
insert into public.project_members(project_id,member_id) values('97200000-0000-4000-8000-000000000003','97200000-0000-4000-8000-000000000001');
insert into public.boards(id,project_id,slug,name) values('97200000-0000-4000-8000-000000000004','97200000-0000-4000-8000-000000000003','test','Test');
insert into public.tag_groups(id,board_id,key,name) values('97200000-0000-4000-8000-000000000005','97200000-0000-4000-8000-000000000004','kind','Kind');
insert into public.tags(id,group_id,key,name) values('97200000-0000-4000-8000-000000000006','97200000-0000-4000-8000-000000000005','bug','Bug');

set local role authenticated;
select set_config('request.jwt.claims','{"email":"stencil-member@example.test","role":"authenticated"}',true);
do $$
declare v_id uuid;
begin
  insert into public.card_stencils(board_id,name,body_md)
    values('97200000-0000-4000-8000-000000000004','Integration','## Checklist' || chr(10) || '- [ ] Credentialing')
    returning id into v_id;
  insert into public.card_stencil_tags(stencil_id,tag_id) values(v_id,'97200000-0000-4000-8000-000000000006');
  if (select count(*) from public.card_stencils where board_id='97200000-0000-4000-8000-000000000004')<>1 then
    raise exception 'Member cannot read its own stencil';
  end if;

  -- A duplicate name on the same board is refused.
  begin
    insert into public.card_stencils(board_id,name) values('97200000-0000-4000-8000-000000000004','Integration');
    raise exception 'Duplicate stencil name was allowed';
  exception when unique_violation then null;
  end;

  -- effort mirrors the cards constraint.
  begin
    insert into public.card_stencils(board_id,name,effort) values('97200000-0000-4000-8000-000000000004','Bad effort','XL');
    raise exception 'Invalid effort was allowed';
  exception when check_violation then null;
  end;

  -- Deleting a board tag cascades it out of the stencil.
  delete from public.tags where id='97200000-0000-4000-8000-000000000006';
  if exists(select 1 from public.card_stencil_tags where stencil_id=v_id) then
    raise exception 'Tag deletion did not cascade out of the stencil';
  end if;
end $$;

select set_config('request.jwt.claims','{"email":"stencil-outsider@example.test","role":"authenticated"}',true);
do $$
declare n integer;
begin
  if exists(select 1 from public.card_stencils where board_id='97200000-0000-4000-8000-000000000004') then
    raise exception 'Outsider can read stencils';
  end if;
  update public.card_stencils set name='Hijacked' where board_id='97200000-0000-4000-8000-000000000004';
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Outsider can mutate stencils'; end if;
end $$;
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Ensure local Supabase is running (`bun run db:start` — ask before starting it if it is not).

Run:
```bash
docker exec -i supabase_db_cardstock psql -U postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/card_stencils.sql
```
Expected: FAIL with `relation "public.card_stencils" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260920000000_card_stencils.sql`:

```sql
-- A stencil is a reusable card shape: one recurring kind of work, stamped into
-- a new card. Its checklist lives inside body_md as a "## Checklist" section,
-- so card creation's existing parse path produces the checklist items and
-- Markdown stays the single source of truth.
create table public.card_stencils (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  title      text,
  summary    text,
  body_md    text not null default '',
  area       text,
  effort     text check (effort in ('L','M','H')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, name)
);

-- Tags are rows, not jsonb, so deleting a board tag cannot leave a stencil
-- pointing at a tag that no longer exists.
create table public.card_stencil_tags (
  stencil_id uuid not null references public.card_stencils(id) on delete cascade,
  tag_id     uuid not null references public.tags(id)           on delete cascade,
  primary key (stencil_id, tag_id)
);

-- unique (board_id, name) already provides the board+name index; none is added.
create trigger card_stencils_touch before update on public.card_stencils
  for each row execute function public.touch_updated_at();

create or replace function public.stencil_project(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select bd.project_id from public.card_stencils cs join public.boards bd on bd.id = cs.board_id where cs.id = s
$$;

alter table public.card_stencils enable row level security;
alter table public.card_stencil_tags enable row level security;

create policy card_stencils_rw on public.card_stencils for all
  using (public.is_project_member(public.board_project(board_id)))
  with check (public.is_project_member(public.board_project(board_id)));
create policy card_stencil_tags_rw on public.card_stencil_tags for all
  using (public.is_project_member(public.stencil_project(stencil_id)))
  with check (public.is_project_member(public.stencil_project(stencil_id)));
```

- [ ] **Step 4: Apply the migration and run the test**

Run:
```bash
bun run db:reset
docker exec -i supabase_db_cardstock psql -U postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/card_stencils.sql
```
Expected: PASS — psql exits 0 with no `raise exception` output.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260920000000_card_stencils.sql supabase/tests/card_stencils.sql
git commit -m "feat(stencils): board-scoped card stencil tables and RLS"
```

---

### Task 2: The stencil module

Pure logic, unit tested. Everything the UI and actions need to agree on lives here.

**Files:**
- Create: `src/lib/stencils.ts`
- Test: `src/lib/stencils.test.ts`

**Interfaces:**
- Consumes: `parseChecklist` from `@cardstock/core`.
- Produces:
  - `interface CardStencil { id: string; board_id: string; name: string; title: string | null; summary: string | null; body_md: string; area: string | null; effort: "L" | "M" | "H" | null; tag_ids: string[] }`
  - `const STENCIL_NAME_MAX = 80`
  - `const STENCIL_BODY_MAX = 20_000`
  - `function stencilInitialValues(stencil: CardStencil): StencilSeed`
  - `type StencilSeed = { title: string; summary: string; bodyMarkdown: string; area: string; effort: "L" | "M" | "H" | null; tagIds: string[] }`
  - `function stencilStepCount(stencil: Pick<CardStencil, "body_md">): number`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stencils.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import {
  type CardStencil,
  stencilInitialValues,
  stencilStepCount,
} from "./stencils";

const stencil: CardStencil = {
  id: "s1",
  board_id: "b1",
  name: "Integration",
  title: "Integration — ",
  summary: "Stand up one client integration.",
  body_md: "## Ask\n\n## Checklist\n- [ ] Credentialing\n- [ ] Field mapping\n",
  area: "Delivery",
  effort: "M",
  tag_ids: ["t1", "t2"],
};

describe("stencilInitialValues", () => {
  it("seeds the create dialog from the stencil", () => {
    expect(stencilInitialValues(stencil)).toEqual({
      title: "Integration — ",
      summary: "Stand up one client integration.",
      bodyMarkdown:
        "## Ask\n\n## Checklist\n- [ ] Credentialing\n- [ ] Field mapping\n",
      area: "Delivery",
      effort: "M",
      tagIds: ["t1", "t2"],
    });
  });

  it("never seeds a priority, because triage is per card", () => {
    expect(stencilInitialValues(stencil)).not.toHaveProperty("priority");
  });

  it("turns absent fields into empty strings the dialog can hold", () => {
    const bare: CardStencil = {
      ...stencil,
      title: null,
      summary: null,
      area: null,
      effort: null,
      tag_ids: [],
    };
    const seed = stencilInitialValues(bare);
    expect(seed.title).toBe("");
    expect(seed.summary).toBe("");
    expect(seed.area).toBe("");
    expect(seed.effort).toBeNull();
    expect(seed.tagIds).toEqual([]);
  });
});

describe("stencilStepCount", () => {
  it("counts the checklist items in the body", () => {
    expect(stencilStepCount(stencil)).toBe(2);
  });

  it("is zero when the body has no checklist section", () => {
    expect(stencilStepCount({ body_md: "## Ask\n\nJust prose.\n" })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/stencils.test.ts`
Expected: FAIL — cannot resolve `./stencils`.

- [ ] **Step 3: Write the module**

Create `src/lib/stencils.ts`:

```ts
/**
 * A stencil is one recurring kind of work — "Integration", "New hire" — that a
 * card is stamped from. Its checklist lives inside `body_md` as a `## Checklist`
 * section, so card creation's existing parse path produces the items and there
 * is no second source of truth.
 *
 * Distinct from the board's card template (`@/lib/card-template`), which is the
 * structural floor every card starts from. The template is a constraint; a
 * stencil is a choice.
 */
import { parseChecklist } from "@cardstock/core";

export interface CardStencil {
  id: string;
  board_id: string;
  name: string;
  title: string | null;
  summary: string | null;
  body_md: string;
  area: string | null;
  effort: "L" | "M" | "H" | null;
  tag_ids: string[];
}

/** A stencil name is a label in a menu, not a sentence. */
export const STENCIL_NAME_MAX = 80;

/** Same ceiling as the card template: a stencil is a skeleton, not a wiki. */
export const STENCIL_BODY_MAX = 20_000;

export type StencilSeed = {
  title: string;
  summary: string;
  bodyMarkdown: string;
  area: string;
  effort: "L" | "M" | "H" | null;
  tagIds: string[];
};

/**
 * The create dialog's `initialValues` for a stamped card. Deliberately carries
 * no priority: priority is a triage decision relative to the rest of the board
 * at a moment in time, not a property of a kind of work.
 */
export function stencilInitialValues(stencil: CardStencil): StencilSeed {
  return {
    title: stencil.title ?? "",
    summary: stencil.summary ?? "",
    bodyMarkdown: stencil.body_md,
    area: stencil.area ?? "",
    effort: stencil.effort,
    tagIds: [...stencil.tag_ids],
  };
}

/** How many steps a stamped card will start with, for the manage list. */
export function stencilStepCount(
  stencil: Pick<CardStencil, "body_md">,
): number {
  return parseChecklist(stencil.body_md).items.length;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/stencils.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
bunx biome check --write src/lib/stencils.ts src/lib/stencils.test.ts
git add src/lib/stencils.ts src/lib/stencils.test.ts
git commit -m "feat(stencils): stencil type, create-dialog seed and step count"
```

---

### Task 3: Server actions

**Files:**
- Modify: `src/app/(app)/p/[project]/actions.ts` (append a stencils section after the card template section, which ends around line 420)

**Interfaces:**
- Consumes: `CardStencil`, `STENCIL_NAME_MAX`, `STENCIL_BODY_MAX` from `@/lib/stencils`; the existing file-local `requireMember()`, `cleanName()`, `supabaseServer()`, `currentAccess()`.
- Produces:
  - `type StencilResult = { error?: string } | null`
  - `createStencil(_prev: StencilResult, form: FormData): Promise<StencilResult>` — form fields `boardId`, `projectSlug`, `boardSlug`, `name`
  - `saveStencil(_prev: StencilResult, form: FormData): Promise<StencilResult>` — form fields `stencilId`, `projectSlug`, `boardSlug`, `name`, `title`, `summary`, `body`, `area`, `effort`, and repeated `tagIds`
  - `deleteStencil(_prev: StencilResult, form: FormData): Promise<StencilResult>` — form fields `stencilId`, `projectSlug`, `boardSlug`

Authorisation follows `updateCardTemplate` **including its binding check** (`actions.ts:412`): resolve the project by slug, require `currentAccess(project.id).canManage`, then verify the target board (or the stencil's board) belongs to that project. Without the binding, an admin of project A could pass A's slug with B's board or stencil ID: `canManage` passes on A, RLS passes on B (membership is enough), and they manage B's stencils. RLS already limits these tables to project members; the action check turns a policy failure into a sentence a person can read.

- [ ] **Step 1: Add the stencil actions**

Append to `src/app/(app)/p/[project]/actions.ts`:

```ts
/* ------------------------------------------------------------------ stencils
 * A stencil is a reusable card shape. Editing one never touches a card already
 * stamped from it — the same promise the card template makes.
 */

export type StencilResult = { error?: string } | null;

function revalidateStencils() {
  revalidatePath("/p/[project]/b/[board]/manage", "page");
  revalidatePath("/p/[project]/b/[board]", "page");
}

/**
 * Board-scoped writes need project admin, exactly as the card template does.
 * Returns the project id so callers can bind the target board to it — the
 * slug names who must hold canManage; the board decides where the write lands.
 */
async function requireBoardManager(
  projectSlug: string,
): Promise<{ error: string } | { projectId: string }> {
  const denied = await requireMember();
  if (denied) return { error: denied };
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  const access = await currentAccess(project.id);
  return access?.canManage
    ? { projectId: project.id }
    : { error: "Only an owner or project admin can change stencils." };
}

/** The board must belong to the project whose canManage was just checked. */
async function boardInProject(
  boardId: string,
  projectId: string,
): Promise<boolean> {
  const db = await supabaseServer();
  const { data: board } = await db
    .from("boards")
    .select("project_id")
    .eq("id", boardId)
    .maybeSingle();
  return board?.project_id === projectId;
}

/** Same binding for a stencil, resolved through its board. */
async function stencilInProject(
  stencilId: string,
  projectId: string,
): Promise<boolean> {
  const db = await supabaseServer();
  const { data: stencil } = await db
    .from("card_stencils")
    .select("board_id, boards(project_id)")
    .eq("id", stencilId)
    .maybeSingle();
  return (
    (stencil?.boards as { project_id: string } | null)?.project_id === projectId
  );
}

export async function createStencil(
  _prev: StencilResult,
  form: FormData,
): Promise<StencilResult> {
  const projectSlug = String(form.get("projectSlug") ?? "");
  const gate = await requireBoardManager(projectSlug);
  if ("error" in gate) return { error: gate.error };
  const boardId = String(form.get("boardId") ?? "");
  const name = cleanName(String(form.get("name") ?? ""));
  if (!boardId || !(await boardInProject(boardId, gate.projectId)))
    return { error: "Board not found." };
  if (!name) return { error: "A stencil needs a name." };
  if (name.length > STENCIL_NAME_MAX)
    return { error: "That name is too long for a menu." };

  const db = await supabaseServer();
  const { error } = await db
    .from("card_stencils")
    .insert({ board_id: boardId, name });
  if (error)
    return {
      error:
        error.code === "23505"
          ? `This board already has a stencil called “${name}”.`
          : error.message,
    };
  revalidateStencils();
  return null;
}

export async function saveStencil(
  _prev: StencilResult,
  form: FormData,
): Promise<StencilResult> {
  const projectSlug = String(form.get("projectSlug") ?? "");
  const gate = await requireBoardManager(projectSlug);
  if ("error" in gate) return { error: gate.error };
  const stencilId = String(form.get("stencilId") ?? "");
  const name = cleanName(String(form.get("name") ?? ""));
  if (!stencilId || !(await stencilInProject(stencilId, gate.projectId)))
    return { error: "Stencil not found." };
  if (!name) return { error: "A stencil needs a name." };
  if (name.length > STENCIL_NAME_MAX)
    return { error: "That name is too long for a menu." };

  const body = String(form.get("body") ?? "");
  if (body.length > STENCIL_BODY_MAX)
    return { error: "This stencil is too long to be a skeleton." };
  const effort = String(form.get("effort") ?? "");
  if (effort && !["L", "M", "H"].includes(effort))
    return { error: "Effort must be L, M or H." };

  const db = await supabaseServer();
  const { error } = await db
    .from("card_stencils")
    .update({
      name,
      title: String(form.get("title") ?? "").trim() || null,
      summary: String(form.get("summary") ?? "").trim() || null,
      body_md: body,
      area: String(form.get("area") ?? "").trim() || null,
      effort: effort || null,
    })
    .eq("id", stencilId);
  if (error)
    return {
      error:
        error.code === "23505"
          ? `This board already has a stencil called “${name}”.`
          : error.message,
    };

  // Tags are replaced wholesale: the form carries the complete set. The two
  // writes are not atomic; a failure between them leaves the stencil tagless,
  // which the next save repairs. Accepted for board configuration.
  const tagIds = form.getAll("tagIds").map(String).filter(Boolean);
  const { error: cleared } = await db
    .from("card_stencil_tags")
    .delete()
    .eq("stencil_id", stencilId);
  if (cleared) return { error: cleared.message };
  if (tagIds.length) {
    const { error: added } = await db
      .from("card_stencil_tags")
      .insert(tagIds.map((tag_id) => ({ stencil_id: stencilId, tag_id })));
    if (added) return { error: added.message };
  }
  revalidateStencils();
  return null;
}

/** Deleting a stencil never touches cards stamped from it. */
export async function deleteStencil(
  _prev: StencilResult,
  form: FormData,
): Promise<StencilResult> {
  const projectSlug = String(form.get("projectSlug") ?? "");
  const gate = await requireBoardManager(projectSlug);
  if ("error" in gate) return { error: gate.error };
  const stencilId = String(form.get("stencilId") ?? "");
  if (!stencilId || !(await stencilInProject(stencilId, gate.projectId)))
    return { error: "Which stencil?" };
  const db = await supabaseServer();
  const { error } = await db
    .from("card_stencils")
    .delete()
    .eq("id", stencilId);
  if (error) return { error: error.message };
  revalidateStencils();
  return null;
}
```

- [ ] **Step 2: Add the import**

At the top of `src/app/(app)/p/[project]/actions.ts`, beside the existing `@/lib/card-template` import:

```ts
import { STENCIL_BODY_MAX, STENCIL_NAME_MAX } from "@/lib/stencils";
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS, no errors.

Coverage, honestly: the repo has no server-action unit harness, and the validation worth unit-testing already lives in `src/lib/stencils.ts`. `createStencil` and `saveStencil` are exercised by the authoring e2e test in Task 6; `deleteStencil`, the duplicate-name message and the cross-project binding refusals are verified manually (Task 5 Step 3) and at the DB level by Task 1's SQL test.

- [ ] **Step 4: Commit**

```bash
bunx biome check --write "src/app/(app)/p/[project]/actions.ts"
git add "src/app/(app)/p/[project]/actions.ts"
git commit -m "feat(stencils): create, save and delete stencil actions"
```

---

### Task 4: Load stencils with the board

**Files:**
- Modify: `src/lib/board-data.ts` (the parallel query block starting around line 66, and the return object around line 138)
- Modify: `src/app/(app)/p/[project]/b/[board]/manage/page.tsx`

**Interfaces:**
- Consumes: `CardStencil` from `@/lib/stencils`.
- Produces: `BoardData.stencils: CardStencil[]`, sorted by name, each with its `tag_ids` populated.

- [ ] **Step 1: Add stencils to the board query**

In `src/lib/board-data.ts`, add to the destructured parallel query block:

```ts
    { data: stencils },
```

and the matching query alongside the others:

```ts
    db
      .from("card_stencils")
      .select(
        "id, board_id, name, title, summary, body_md, area, effort, card_stencil_tags(tag_id)",
      )
      .eq("board_id", board.id)
      .order("name"),
```

- [ ] **Step 2: Shape them in the return value**

In the `return {` object of `loadBoard`, add:

```ts
    stencils: (stencils ?? []).map((s) => ({
      id: s.id,
      board_id: s.board_id,
      name: s.name,
      title: s.title,
      summary: s.summary,
      body_md: s.body_md,
      area: s.area,
      effort: s.effort,
      tag_ids: (
        (s.card_stencil_tags ?? []) as { tag_id: string }[]
      ).map((row) => row.tag_id),
    })) as CardStencil[],
```

- [ ] **Step 3: Add it to the BoardData type**

In the `BoardData` interface in the same file, add:

```ts
  stencils: CardStencil[];
```

and import the type at the top:

```ts
import type { CardStencil } from "@/lib/stencils";
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS. If the manage page or board view destructures `BoardData` exhaustively, fix any resulting error by threading the new field through — do not widen the type to `any`.

- [ ] **Step 5: Commit**

```bash
bunx biome check --write src/lib/board-data.ts
git add src/lib/board-data.ts
git commit -m "feat(stencils): load a board's stencils with its data"
```

---

### Task 5: The stencils section on manage

A list with add and delete. Editing a stencil's contents is Task 6; this task ships the list and proves the actions work.

**Files:**
- Create: `src/app/(app)/p/[project]/stencils-editor.tsx`
- Modify: `src/app/(app)/p/[project]/b/[board]/manage/page.tsx`

**Interfaces:**
- Consumes: `createStencil`, `deleteStencil` from `./actions`; `CardStencil`, `stencilStepCount`, `STENCIL_NAME_MAX` from `@/lib/stencils`.
- Produces: `<StencilsEditor boardId projectSlug boardSlug stencils groups canEdit />`, where `groups` is the board's `TagGroup[]` (unused until Task 6, threaded now so the manage page changes once).

- [ ] **Step 1: Write the list component**

Create `src/app/(app)/p/[project]/stencils-editor.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";
import { useActivityActionState as useActionState } from "@/components/activity";
import { Button } from "@/components/ui/button";
import {
  type CardStencil,
  STENCIL_NAME_MAX,
  stencilStepCount,
} from "@/lib/stencils";
import type { TagGroup } from "@/lib/types";
import { createStencil, deleteStencil } from "./actions";

/**
 * A board's stencils: the reusable card shapes it stamps from. Distinct from
 * the card template above, which every card starts from whether or not a
 * stencil was chosen.
 */
export function StencilsEditor(props: {
  boardId: string;
  projectSlug: string;
  boardSlug: string;
  stencils: CardStencil[];
  groups: TagGroup[];
  canEdit: boolean;
}) {
  const [addState, add, adding] = useActionState(createStencil, null);
  return (
    <div className="max-w-2xl">
      <p className="mb-3 text-sm text-[var(--color-grey)]">
        A stencil is a kind of work you make cards for over and over. Stamping
        one fills in the card’s text, its checklist and its tags. Cards already
        stamped are never changed.
      </p>
      <ul className="grid gap-1.5">
        {props.stencils.map((stencil) => (
          <StencilRow
            key={stencil.id}
            stencil={stencil}
            projectSlug={props.projectSlug}
            boardSlug={props.boardSlug}
            canEdit={props.canEdit}
          />
        ))}
        {!props.stencils.length && (
          <li className="text-sm text-[var(--color-grey)]">
            No stencils yet. New cards start from the card template above.
          </li>
        )}
      </ul>
      {props.canEdit && (
        <form
          action={add}
          data-saving={adding || undefined}
          className="mt-3 flex items-center gap-1.5"
        >
          <input type="hidden" name="boardId" value={props.boardId} />
          <input type="hidden" name="projectSlug" value={props.projectSlug} />
          <input type="hidden" name="boardSlug" value={props.boardSlug} />
          <input
            name="name"
            aria-label="New stencil name"
            placeholder="Integration"
            maxLength={STENCIL_NAME_MAX}
            required
            className="rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] px-2.5 py-1.5 text-sm"
          />
          <Button type="submit" disabled={adding}>
            <Plus size={14} /> Add stencil
          </Button>
        </form>
      )}
      {addState?.error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {addState.error}
        </p>
      )}
    </div>
  );
}

function StencilRow(props: {
  stencil: CardStencil;
  projectSlug: string;
  boardSlug: string;
  canEdit: boolean;
}) {
  const [removeState, remove, removing] = useActionState(deleteStencil, null);
  const steps = stencilStepCount(props.stencil);
  const tags = props.stencil.tag_ids.length;
  return (
    <li className="flex items-center gap-3 border-b border-[var(--rule)] py-1.5">
      <span className="font-medium text-sm">{props.stencil.name}</span>
      <span className="text-xs text-[var(--color-grey)]">
        {steps} {steps === 1 ? "step" : "steps"}
        {tags ? ` · ${tags} ${tags === 1 ? "tag" : "tags"}` : ""}
      </span>
      {props.canEdit && (
        <form action={remove} className="ml-auto">
          <input type="hidden" name="stencilId" value={props.stencil.id} />
          <input type="hidden" name="projectSlug" value={props.projectSlug} />
          <input type="hidden" name="boardSlug" value={props.boardSlug} />
          <Button type="submit" variant="ghost" size="sm" disabled={removing}>
            Delete
          </Button>
        </form>
      )}
      {removeState?.error && (
        <span className="text-xs text-destructive" role="alert">
          {removeState.error}
        </span>
      )}
    </li>
  );
}
```

- [ ] **Step 2: Mount it on the manage page**

In `src/app/(app)/p/[project]/b/[board]/manage/page.tsx`, import it beside the card template import and add a section immediately after the existing `card template` `ProjectSection`:

```tsx
      <ProjectSection id="stencils-heading" title="stencils">
        <StencilsEditor
          boardId={data.board.id}
          projectSlug={data.project.slug}
          boardSlug={data.board.slug}
          stencils={data.stencils}
          groups={groups}
          canEdit={access.canManage}
        />
      </ProjectSection>
```

- [ ] **Step 3: Verify in the app**

Ask before starting the dev server. With it running, open `/p/<project>/b/<board>/manage`, add a stencil named `Integration`, confirm it appears reading `0 steps`, then delete it and confirm it disappears.

- [ ] **Step 4: Commit**

```bash
bunx biome check --write "src/app/(app)/p/[project]/stencils-editor.tsx" "src/app/(app)/p/[project]/b/[board]/manage/page.tsx"
git add "src/app/(app)/p/[project]/stencils-editor.tsx" "src/app/(app)/p/[project]/b/[board]/manage/page.tsx"
git commit -m "feat(stencils): list, add and delete stencils on the manage page"
```

---

### Task 6: The stencil editor, stamping, and the end-to-end proof

The remaining three pieces close one loop and are proven by one test, so they ship together.

**Files:**
- Create: `src/app/(app)/p/[project]/stencil-dialog.tsx`
- Modify: `src/app/(app)/p/[project]/stencils-editor.tsx` (open the dialog from a row)
- Modify: `src/components/board/board-view.tsx` (stencil menu on a lane's add-card affordance, around lines 1020-1030 and 1103)
- Create: `e2e/card-stencils.spec.ts`
- Create: `docs/stencils.md`
- Modify: `docs/board-manage.md`

**Interfaces:**
- Consumes: `saveStencil` from `./actions`; `stencilInitialValues`, `STENCIL_BODY_MAX` from `@/lib/stencils`; `parseChecklist`, `writeChecklist` from `@cardstock/core`; `CardCreateDialog`'s existing `initialValues` prop (`card-create-dialog.tsx:60`).
- Produces: nothing later tasks depend on — this is the last task.

- [ ] **Step 1: Write the failing end-to-end test**

Create `e2e/card-stencils.spec.ts`. Two tests close the spec's loop: authoring through the manage UI, and stamping. The stamping test seeds its stencil with the admin client (the repo's existing pattern) so it does not depend on the editor dialog:

```ts
import { expect, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signInAs,
} from "./support/sign-in";

const slug = `e2e-stencil-${Date.now()}`;
const email = `${slug}@example.test`;
const password = "stencil-test-123";
const boardPath = `/p/${slug}/b/work`;
let projectId = "";
let boardId = "";

test.beforeAll(async () => {
  if (
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  )
    throw new Error("Stencil tests require local Supabase.");
  const { data: project, error } = await admin
    .from("projects")
    .insert({ slug, name: "Stencil test" })
    .select("id")
    .single();
  if (error) throw error;
  projectId = project.id;
  await createMember(email, password);
  await attachToProject(email, slug, "admin");
  const { data: board, error: boardError } = await admin
    .from("boards")
    .insert({ project_id: projectId, slug: "work", name: "Work" })
    .select("id")
    .single();
  if (boardError) throw boardError;
  boardId = board.id;
  const { error: laneError } = await admin
    .from("lanes")
    .insert({ board_id: boardId, key: "now", name: "Now", kind: "work", position: 0 });
  if (laneError) throw laneError;
  const { error: stencilError } = await admin.from("card_stencils").insert({
    board_id: boardId,
    name: "Integration",
    title: "Integration",
    body_md:
      "## Ask\n\n## Checklist\n- [ ] Credentialing\n- [ ] Field mapping\n- [ ] Go live\n",
  });
  if (stencilError) throw stencilError;
});

test.afterAll(async () => {
  await admin.from("projects").delete().eq("id", projectId);
  await dropMember(email);
});

test("stamping a stencil gives the new card its checklist", async ({ page }) => {
  await signInAs(page, email, password);
  await page.goto(boardPath);

  await page.getByRole("button", { name: /add card/i }).first().click();
  await page.getByRole("menuitem", { name: "Integration" }).click();

  const title = page.getByLabel(/title/i);
  await expect(title).toHaveValue("Integration");
  await title.fill("Integration — Denali");
  await page.getByRole("button", { name: /create/i }).click();

  await expect(page.getByText("Integration — Denali")).toBeVisible();

  const { data: card } = await admin
    .from("cards")
    .select("id")
    .eq("board_id", boardId)
    .eq("title", "Integration — Denali")
    .single();
  const { data: items } = await admin
    .from("card_checklist_items")
    .select("label, position")
    .eq("card_id", card!.id)
    .order("position");
  expect(items?.map((i) => i.label)).toEqual([
    "Credentialing",
    "Field mapping",
    "Go live",
  ]);
});

test("authoring a stencil through manage persists its checklist", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/manage`);

  await page.getByLabel("New stencil name").fill("New hire");
  await page.getByRole("button", { name: /add stencil/i }).click();

  const row = page.locator("li", { hasText: "New hire" });
  await expect(row).toContainText("0 steps");
  await row.getByRole("button", { name: /edit/i }).click();

  for (const label of ["Laptop", "Accounts", "Badge"]) {
    await page.getByRole("button", { name: /add step/i }).click();
    await page.getByLabel(/^step/i).last().fill(label);
  }
  await page.getByRole("button", { name: /^save/i }).click();

  await expect(row).toContainText("3 steps");

  const { data: stencil } = await admin
    .from("card_stencils")
    .select("body_md")
    .eq("board_id", boardId)
    .eq("name", "New hire")
    .single();
  expect(stencil?.body_md).toContain("- [ ] Badge");
});
```

The authoring test dictates the editor dialog's accessible names: each step input labelled `Step …`, an `Add step` button, a `Save` submit. Build Step 5 to match.

- [ ] **Step 2: Run it to verify it fails**

Ask before starting the dev server and local Supabase. Then run:
```bash
bunx playwright test e2e/card-stencils.spec.ts
```
Expected: FAIL twice — no `Integration` menu item exists on the add-card affordance, and manage has no stencils section.

- [ ] **Step 3: Add the stencil menu to the board**

In `src/components/board/board-view.tsx`, the lane's add affordance currently calls `setCardLane(lane)` directly (around line 1103). Add state for the chosen stencil beside the existing `cardLane` state:

```tsx
  const [cardStencil, setCardStencil] = useState<CardStencil | null>(null);
```

When a lane's add button is pressed and `data.stencils.length` is zero, keep today's behaviour exactly — `setCardLane(lane)` with no menu. When there are stencils, present a menu whose first item is `Blank card` (sets `cardStencil` to `null`) followed by each stencil by name. Every item then calls `setCardLane(lane)`.

Pass the seed to the dialog, replacing nothing that is already there:

```tsx
      <CardCreateDialog
        lane={cardLane}
        boardId={data.board.id}
        groups={data.groups}
        epics={data.epics}
        people={data.people}
        bodyTemplate={cardTemplate(data.board.settings)}
        initialValues={
          cardStencil ? stencilInitialValues(cardStencil) : undefined
        }
        onClose={() => {
          setCardLane(null);
          setCardStencil(null);
        }}
        onCreate={addCard}
      />
```

`bodyTemplate` stays as the fallback for the blank path: `card-create-dialog.tsx:85` already reads `initial?.bodyMarkdown ?? props.bodyTemplate`, so a blank card keeps starting from the board card template and a stamped one starts from the stencil. Give the add-card control an accessible name matching `/add card/i` and the menu `role="menu"` with `role="menuitem"` children, so the test's selectors resolve.

- [ ] **Step 4: Run the stamping test to verify it passes**

Run: `bunx playwright test e2e/card-stencils.spec.ts -g "stamping"`
Expected: PASS — the stamped card has exactly three checklist items in order. The authoring test still fails; the editor dialog is Step 5.

- [ ] **Step 5: Build the stencil editor dialog**

Create `src/app/(app)/p/[project]/stencil-dialog.tsx`. It is a form posting to `saveStencil` with `stencilId`, `projectSlug`, `boardSlug`, `name`, `title`, `summary`, `body`, `area`, `effort` and repeated `tagIds` inputs, laid out like `card-create-dialog.tsx`: a writing column (name, title, summary, body) and a sidebar (area, effort), with the tag row beneath.

The checklist is edited as a list, not as raw markdown, while `body_md` stays the only storage:

```tsx
  // One source of truth: the list is a view of the body's reserved section.
  const [body, setBody] = useState(props.stencil.body_md);
  const items = parseChecklist(body).items;

  function setItems(next: { label: string; completed: boolean }[]) {
    setBody(writeChecklist(body, { present: next.length > 0, items: next }));
  }
```

`writeChecklist` rewrites only the `## Checklist` section and returns the markdown unchanged when the meaning has not changed, so the rest of the body survives editing. Render `items` as labelled text inputs with add and remove controls; every edit calls `setItems`. Submit `body` in a hidden input.

For a stencil whose `body_md` is empty, offer a **"Start from the board's card template"** button that sets `body` to the board's `cardTemplate(settings)` value, so an author inherits the section skeleton instead of retyping it. Thread that string in as a `cardTemplate` prop from the manage page.

Reuse the tag picker markup from `card-create-dialog.tsx:377-400` — the `mark` / `mark--off` toggle buttons over `props.groups` — emitting a hidden `tagIds` input per selected tag.

- [ ] **Step 6: Open the dialog from a stencil row**

In `stencils-editor.tsx`, add an `Edit` button to `StencilRow` that opens `StencilDialog` for that stencil. Thread `groups` and the board's card template through from the manage page.

- [ ] **Step 7: Verify authoring**

Run: `bunx playwright test e2e/card-stencils.spec.ts`
Expected: PASS — both tests.

Then, in the app (ask before starting the dev server): open manage, add a stencil, open it, add three checklist steps and two tags, save, reload, and confirm the steps and tags persisted and the row reads `3 steps · 2 tags`. Tags are not covered by the e2e test, so this look is the coverage.

- [ ] **Step 8: Write the docs**

Create `docs/stencils.md` covering: what a stencil is and how it differs from the board card template; that the checklist lives in `body_md`; that stamping is a copy, so editing a stencil never changes existing cards; that stencils are board-scoped because tags are; and that packets — a set of stencils stamped together — are a later phase.

In `docs/board-manage.md`, add the `stencils` section beside the existing `card template` section description.

- [ ] **Step 9: Full check and commit**

Run:
```bash
bunx biome check --write src/ e2e/
bunx tsc --noEmit
bun test
bunx playwright test e2e/card-stencils.spec.ts
```
Expected: all pass.

```bash
git add src/ e2e/card-stencils.spec.ts docs/stencils.md docs/board-manage.md
git commit -m "feat(stencils): stamp a card from a stencil, and author stencils on manage"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Data model (`card_stencils`, `card_stencil_tags`, RLS) | 1 |
| No `priority`, no `position`, alphabetical | 1, 2 (test asserts no priority) |
| Checklist lives in `body_md` | 2 (`stencilStepCount`), 6 (`writeChecklist` authoring) |
| Stamping flow, `initialValues`, blank fallback | 2 (`stencilInitialValues`), 6 (Step 3) |
| Authoring: list, dialog, checklist as a list, seed from card template | 5, 6 |
| `canManage` in actions, project binding, RLS as project member | 1 (policy), 3 (`requireBoardManager` + `boardInProject`/`stencilInProject`) |
| Testing: RLS SQL, e2e authoring + stamping assertions | 1, 6 |
| Card template untouched | Global constraint; Task 6 Step 3 keeps `bodyTemplate` |
| Sync unchanged | No task touches `packages/` or the CLI — correct, by omission |

**Placeholder scan:** none. Task 6 Steps 5 and 6 describe UI composition rather than quoting whole components, but give the exact form field names, the exact `parseChecklist`/`writeChecklist` idiom, and the exact existing markup to reuse by file and line.

**Type consistency:** `CardStencil` is defined once in Task 2 and consumed unchanged in Tasks 3-6. `stencilInitialValues` returns `StencilSeed`, whose keys (`title`, `summary`, `bodyMarkdown`, `area`, `effort`, `tagIds`) match `CreateCardInput` as read from `card-create-dialog.tsx:118-141`. Form field names in Task 3's actions match those named in Task 5 and Task 6. `stencilStepCount` is used only in Task 5.
