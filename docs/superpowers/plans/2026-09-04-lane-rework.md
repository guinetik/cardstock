# Lane Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lane on every board can be dragged into any position and given any display name; only `inbox`, `done` and `archive` lanes resist deletion.

**Architecture:** `kind` stops gating ordering and naming and keeps gating only deletion. The one-position `move_work_lane` nudge RPC is replaced by a bulk `reorder_lanes(board_id, ordered_ids[])`, and lanes become a horizontal `SortableContext` nested inside the `DndContext` that already drags cards. `key` and `kind` remain immutable, which is what keeps renaming free of any cascade into `boards.settings` or markdown frontmatter.

**Tech Stack:** Next.js (App Router, server actions), Supabase/Postgres (plpgsql RPCs, RLS), React 19, @dnd-kit/core ^6.3.1 + @dnd-kit/sortable ^10.0.0, Biome, `bun test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-lane-rework-design.md`

## Global Constraints

- **`key` is never user-editable and never rewritten.** Renaming touches `lanes.name` only. `boards.settings.status_to_lane`, `needs_lane`, `lane_aliases` and every card's markdown `lane:` reference `key`, so nothing cascades.
- **`kind` is never user-editable.** `LanePatch` carries `name` and `color` only. No task in this plan adds `kind` or `position` to it.
- **Protected kinds are exactly `inbox`, `done`, `archive`.** They resist deletion only. They do not resist renaming, reordering, or dragging.
- **Ordering consults `kind` nowhere.** Including archive: it may be dragged anywhere.
- **Card-movement rules are out of scope and must not change.** `move_all_lane_cards` still raises *"Archive cannot be used for this action"*; `delete_work_lane` still raises *"Archive cannot be a removal destination"*. Do not relax the client gates that mirror them (`canMoveCardsLeft` / `canMoveCardsRight`, the delete-destination filter).
- **Migration filename:** `supabase/migrations/20260910000000_lane_reorder.sql`. Tasks 1–3 all append to this one file.
- **Lane names are 1–80 characters** (existing `cleanName` contract in `actions.ts`).
- Run `bun run check` (Biome + `tsc --noEmit`) before every commit that touches TypeScript.

---

### Task 1: `reorder_lanes` RPC replaces `move_work_lane`

**Files:**
- Create: `supabase/migrations/20260910000000_lane_reorder.sql`
- Test: `supabase/tests/lane_management.sql` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `public.reorder_lanes(p_board_id uuid, p_ordered_ids uuid[]) returns void`. Raises `'Lane order must list every lane on this board'`, `'Lane order names a lane from another board'`, `'Lane order repeats a lane'`. Task 5's `reorderLanes` server action calls it. `public.move_work_lane(uuid, int)` no longer exists after this task.

- [ ] **Step 1: Write the failing test**

Append to `supabase/tests/lane_management.sql`, before any final `rollback;`/`commit;` if one exists:

```sql
-- reorder_lanes: dense renumber from a caller-supplied order, no kind guard.
do $$
declare
  v_board uuid;
  v_ids uuid[];
  v_positions int[];
begin
  select id into v_board from public.boards limit 1;

  select array_agg(id order by position) into v_ids
  from public.lanes where board_id = v_board;

  -- Reverse the whole board. If any kind guard survives, this raises.
  perform public.reorder_lanes(
    v_board,
    (select array_agg(id order by position desc)
     from public.lanes where board_id = v_board)
  );

  select array_agg(position order by position) into v_positions
  from public.lanes where board_id = v_board;
  if v_positions <> (select array_agg(g) from generate_series(0, array_length(v_ids, 1) - 1) g)
  then
    raise exception 'reorder_lanes must renumber densely from 0';
  end if;

  if (select id from public.lanes where board_id = v_board and position = 0)
     <> v_ids[array_length(v_ids, 1)]
  then
    raise exception 'reorder_lanes must honour the supplied order';
  end if;

  -- An archive lane must be reorderable like any other.
  if not exists (
    select 1 from public.lanes
    where board_id = v_board and kind = 'archive' and position = 0
  ) then
    raise exception 'archive must be free to move';
  end if;

  -- Restore.
  perform public.reorder_lanes(v_board, v_ids);
end $$;

-- reorder_lanes rejects a short array.
do $$
declare v_board uuid; v_one uuid;
begin
  select id into v_board from public.boards limit 1;
  select id into v_one from public.lanes where board_id = v_board limit 1;
  begin
    perform public.reorder_lanes(v_board, array[v_one]);
    raise exception 'expected a short lane order to be rejected';
  exception when others then
    if sqlerrm not like 'Lane order must list every lane%' then raise; end if;
  end;
end $$;

-- reorder_lanes rejects a repeated id.
do $$
declare v_board uuid; v_ids uuid[]; v_dup uuid[];
begin
  select id into v_board from public.boards limit 1;
  select array_agg(id order by position) into v_ids
  from public.lanes where board_id = v_board;
  v_dup := v_ids;
  v_dup[1] := v_ids[2];
  begin
    perform public.reorder_lanes(v_board, v_dup);
    raise exception 'expected a repeated lane to be rejected';
  exception when others then
    if sqlerrm not like 'Lane order repeats a lane%' then raise; end if;
  end;
end $$;

-- move_work_lane is gone.
do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'move_work_lane'
  ) then
    raise exception 'move_work_lane should have been dropped';
  end if;
end $$;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run db:apply supabase/tests/lane_management.sql`
Expected: FAIL with `function public.reorder_lanes(uuid, uuid[]) does not exist`.

- [ ] **Step 3: Write minimal implementation**

Create `supabase/migrations/20260910000000_lane_reorder.sql`:

```sql
-- Lane rework (tracker #10).
--
-- Ordering is presentation, and presentation belongs to the board owner.
-- The kind guards that used to live in move_work_lane are gone, archive
-- included: the seed called archive "the hard right edge of the visible
-- workflow", but that was a guess about what people want, enforced as a
-- constraint. The only surviving invariant is that the caller must name
-- every lane on the board exactly once, which is what makes a dense
-- 0..n renumber safe.
create or replace function public.reorder_lanes(
  p_board_id uuid,
  p_ordered_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  perform 1 from public.lanes where board_id = p_board_id for update;

  select count(*) into v_count from public.lanes where board_id = p_board_id;
  if v_count = 0 then raise exception 'Board has no lanes'; end if;

  if v_count <> coalesce(array_length(p_ordered_ids, 1), 0) then
    raise exception 'Lane order must list every lane on this board';
  end if;

  if (select count(distinct id) from unnest(p_ordered_ids) as u(id)) <> v_count
  then
    raise exception 'Lane order repeats a lane';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) as u(id)
    where not exists (
      select 1 from public.lanes
      where lanes.id = u.id and lanes.board_id = p_board_id
    )
  ) then
    raise exception 'Lane order names a lane from another board';
  end if;

  update public.lanes l
  set position = ordered.position
  from (
    select id, ordinality::int - 1 as position
    from unnest(p_ordered_ids) with ordinality as u(id, ordinality)
  ) ordered
  where l.id = ordered.id;
end;
$$;

drop function if exists public.move_work_lane(uuid, int);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run db:apply supabase/migrations/20260910000000_lane_reorder.sql && bun run db:apply supabase/tests/lane_management.sql`
Expected: PASS, no output before the final notice.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260910000000_lane_reorder.sql supabase/tests/lane_management.sql
git commit -m "feat(#10): reorder_lanes RPC replaces the one-position nudge"
```

---

### Task 2: Deletion guards only the three protected kinds

**Files:**
- Modify: `supabase/migrations/20260910000000_lane_reorder.sql` (append)
- Test: `supabase/tests/lane_management.sql` (append)

**Interfaces:**
- Consumes: the migration file from Task 1.
- Produces: `delete_work_lane` now raises `'Icebox, done and archive lanes cannot be removed'` for `kind in ('inbox','done','archive')` and succeeds for every other kind. Task 7's `canDelete` mirrors this set client-side.

- [ ] **Step 1: Write the failing test**

Append to `supabase/tests/lane_management.sql`:

```sql
-- delete_work_lane: protected kinds are inbox/done/archive; others go.
do $$
declare
  v_board uuid;
  v_dest uuid;
  v_waiting uuid;
  v_protected record;
begin
  select id into v_board from public.boards limit 1;
  select id into v_dest from public.lanes
  where board_id = v_board and kind = 'work' limit 1;

  for v_protected in
    select id, kind from public.lanes
    where board_id = v_board and kind in ('inbox', 'done', 'archive')
  loop
    begin
      perform public.delete_work_lane(v_protected.id, v_dest);
      raise exception 'expected kind % to be protected', v_protected.kind;
    exception when others then
      if sqlerrm not like '%cannot be removed%' then raise; end if;
    end;
  end loop;

  -- A non-work, non-protected lane must now be removable.
  insert into public.lanes (board_id, key, name, position, kind, sla_days)
  values (v_board, 'test-waiting', 'Test waiting', 99, 'waiting', 5)
  returning id into v_waiting;

  perform public.delete_work_lane(v_waiting, v_dest);

  if exists (select 1 from public.lanes where id = v_waiting) then
    raise exception 'a waiting lane must be removable';
  end if;
end $$;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run db:apply supabase/tests/lane_management.sql`
Expected: FAIL with `Only work lanes can be removed`. The old guard rejects the `waiting` lane the test just inserted, and that exception propagates out of the `do` block uncaught. The protected-kind loop above it also mis-passes for the wrong reason on the old code — the old guard's text does not contain "cannot be removed", so its `if sqlerrm not like` re-raises. Either way the block must not complete.

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/migrations/20260910000000_lane_reorder.sql`. Copy the whole function body from `supabase/migrations/20260827000000_lane_crud.sql:101-214` unchanged **except** the guard at `:124-126`. Read that file and reproduce it verbatim; only this fragment differs:

```sql
-- Was: if v_source_kind <> 'work' then
--        raise exception 'Only work lanes can be removed';
--      end if;
--
-- Deletion is the one thing kind still gates, and it gates the three
-- roles resolved by kind lookup at runtime. archiveCard walks the lane
-- list for kind = 'archive' and for the inbox on restore, so removing
-- one does not produce an error — it produces a feature that silently
-- stops working.
  if v_source_kind in ('inbox', 'done', 'archive') then
    raise exception 'Icebox, done and archive lanes cannot be removed';
  end if;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run db:apply supabase/migrations/20260910000000_lane_reorder.sql && bun run db:apply supabase/tests/lane_management.sql`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260910000000_lane_reorder.sql supabase/tests/lane_management.sql
git commit -m "feat(#10): deletion guards inbox/done/archive, frees the rest"
```

---

### Task 3: Four-lane default template for a new board

**Files:**
- Modify: `supabase/migrations/20260910000000_lane_reorder.sql` (append)
- Test: `supabase/tests/lane_management.sql` (append)

**Interfaces:**
- Consumes: the migration file from Tasks 1–2.
- Produces: `create_board` seeds Icebox/`unsorted`/`inbox`/0, Doing/`now`/`work`/1, Zenbox/`done`/`done`/2, Archive/`archive`/`archive`/3. No signature change.

- [ ] **Step 1: Write the failing test**

Append to `supabase/tests/lane_management.sql`:

```sql
-- create_board seeds four lanes: flavourful names, semantic keys.
do $$
declare
  v_project uuid;
  v_board uuid;
  v_seeded text;
begin
  select id into v_project from public.projects limit 1;
  v_board := public.create_board(v_project, 'lane-template-test', 'Template test');

  select string_agg(name || '/' || key || '/' || kind, ' ' order by position)
  into v_seeded
  from public.lanes where board_id = v_board;

  if v_seeded <> 'Icebox/unsorted/inbox Doing/now/work Zenbox/done/done Archive/archive/archive'
  then
    raise exception 'unexpected default lanes: %', v_seeded;
  end if;

  delete from public.boards where id = v_board;
end $$;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run db:apply supabase/tests/lane_management.sql`
Expected: FAIL with `unexpected default lanes: Unsorted/unsorted/inbox Now/now/work Next/next/work Done/done/done Archive/archive/archive`.

- [ ] **Step 3: Write minimal implementation**

Append to `supabase/migrations/20260910000000_lane_reorder.sql`. Copy `create_board` verbatim from `supabase/migrations/20260904000000_project_admin.sql:77-111` — it is `security definer` and that must be preserved — changing only the `insert into public.lanes` block at `:101-107`:

```sql
  -- Four lanes, not five. The keys are deliberately unchanged from the
  -- previous default: a card's frontmatter keeps saying `lane: done`,
  -- because `done` is the clearer word for a file another tool or another
  -- person may read. The flavour lives in `name` and never leaves the
  -- database — nothing in the import or export path learns "zenbox".
  insert into public.lanes (board_id, key, name, position, kind)
  values
    (v_board_id, 'unsorted', 'Icebox', 0, 'inbox'),
    (v_board_id, 'now', 'Doing', 1, 'work'),
    (v_board_id, 'done', 'Zenbox', 2, 'done'),
    (v_board_id, 'archive', 'Archive', 3, 'archive');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run db:apply supabase/migrations/20260910000000_lane_reorder.sql && bun run db:apply supabase/tests/lane_management.sql && bun run db:test`
Expected: PASS. `db:test` runs `owner_rls.sql`, which exercises `create_board` at `:105,208,227` — confirm it still passes, since it asserts against seeded lanes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260910000000_lane_reorder.sql supabase/tests/lane_management.sql
git commit -m "feat(#10): four-lane default board — Icebox, Doing, Zenbox, Archive"
```

---

### Task 4: Any lane can be renamed

**Files:**
- Modify: `src/app/p/[project]/b/[board]/actions.ts:316-350` (`updateLane`)

**Interfaces:**
- Consumes: nothing.
- Produces: `updateLane(laneId: string, patch: LanePatch)` no longer rejects on `kind`. `LanePatch` is unchanged: `{ name?: string; color?: CardColor | null }`.

- [ ] **Step 1: Write the failing test**

There is no unit-test harness for server actions in this repo (they need a live Supabase session), so this behaviour is proven by the SQL layer plus the e2e in Task 9. Instead, prove the guard is gone by assertion in the source. Append to `supabase/tests/lane_management.sql`:

```sql
-- A done lane's name is writable at the table level (RLS lets project
-- members write lanes directly; the rename guard lived only in the
-- server action, and Task 4 removes it there).
do $$
declare v_board uuid; v_done uuid; v_key text;
begin
  select id into v_board from public.boards limit 1;
  select id, key into v_done, v_key
  from public.lanes where board_id = v_board and kind = 'done' limit 1;
  if v_done is null then return; end if;
  update public.lanes set name = 'Zenbox' where id = v_done;
  if (select key from public.lanes where id = v_done) <> v_key then
    raise exception 'renaming a lane must not touch its key';
  end if;
end $$;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `grep -n 'Only work lanes can be renamed' 'src/app/p/[project]/b/[board]/actions.ts'`
Expected: one hit at line 342 — the guard is still present.

- [ ] **Step 3: Write minimal implementation**

In `src/app/p/[project]/b/[board]/actions.ts`, delete these two lines (currently `:341-342`):

```ts
  if (hasName && lane.kind !== "work")
    return { ok: false, error: "Only work lanes can be renamed." };
```

The `select("board_id, kind")` immediately above still needs `board_id` for the `laneList` return. Narrow it to `select("board_id")` and drop the now-unused `kind`.

- [ ] **Step 4: Run test to verify it passes**

Run: `grep -c 'Only work lanes can be renamed' 'src/app/p/[project]/b/[board]/actions.ts' ; bun run check`
Expected: grep prints `0`; `bun run check` passes with no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/p/[project]/b/[board]/actions.ts" supabase/tests/lane_management.sql
git commit -m "feat(#10): every lane's display name is editable"
```

---

### Task 5: `reorderLanes` server action replaces `moveLane`

**Files:**
- Modify: `src/app/p/[project]/b/[board]/actions.ts:352-373` (replace `moveLane`)

**Interfaces:**
- Consumes: `public.reorder_lanes` from Task 1.
- Produces: `reorderLanes(boardId: string, orderedIds: string[]): Promise<LaneMutationResult>`. `LaneMutationResult` is the existing `{ ok: true; lanes: Lane[] } | { ok: false; error: string }` at `:20-26`. `moveLane` no longer exists — Task 7 removes its last caller.

- [ ] **Step 1: Write the failing test**

Run this to establish the starting state:

Run: `grep -n 'export async function moveLane\|export async function reorderLanes' 'src/app/p/[project]/b/[board]/actions.ts'`
Expected: one hit for `moveLane`, none for `reorderLanes`.

- [ ] **Step 2: Run test to verify it fails**

Same command as Step 1 — confirm `reorderLanes` is absent before writing it.

- [ ] **Step 3: Write minimal implementation**

Replace the whole `moveLane` function (`:352-373`) with:

```ts
export async function reorderLanes(
  boardId: string,
  orderedIds: string[],
): Promise<LaneMutationResult> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(boardId)) return { ok: false, error: "Invalid board." };
  if (orderedIds.length === 0 || !orderedIds.every((id) => UUID.test(id)))
    return { ok: false, error: "Invalid lane order." };
  const { error } = await c.db.rpc("reorder_lanes", {
    p_board_id: boardId,
    p_ordered_ids: orderedIds,
  });
  if (error) return { ok: false, error: error.message };
  refreshBoards();
  return { ok: true, lanes: await laneList(c.db, boardId) };
}
```

The RPC owns membership and completeness validation, so the action only screens shapes it can cheaply reject.

- [ ] **Step 4: Run test to verify it passes**

Run: `grep -c 'export async function moveLane' 'src/app/p/[project]/b/[board]/actions.ts' ; bun run check`
Expected: grep prints `0`. `bun run check` will report `moveLane` unresolved in `board-view.tsx` — that is expected and Task 7 fixes it. If you are running tasks strictly one at a time, do Tasks 5 and 7 back to back before pushing.

- [ ] **Step 5: Commit**

```bash
git add "src/app/p/[project]/b/[board]/actions.ts"
git commit -m "feat(#10): reorderLanes action, one call per drag"
```

---

### Task 6: The rename dialog stops locking the name field

**Files:**
- Modify: `src/components/board/lane-crud-dialog.tsx:110-115,133`
- Test: `src/components/board/lane-crud-dialog.test.tsx` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: a new exported pure function `laneDialogCopy(mode: Exclude<LaneDialogMode, null>, cardCount: number): string` in `lane-crud-dialog.tsx`. `LaneDialogMode` and the component's props are otherwise unchanged.

**Note on the test harness:** this repo has **no** `@testing-library/react` and no jsdom. Component tests here either test a pure exported copy function (`lane-action-dialog.test.tsx` exports and tests `laneActionCopy`) or render with `renderToStaticMarkup` from `react-dom/server` (`lane-map.test.tsx`). This task follows the first pattern, because the copy is where the behaviour lives, and adds one static-markup assertion for the `readOnly` attribute. Do not add a testing library.

- [ ] **Step 1: Write the failing test**

Create `src/components/board/lane-crud-dialog.test.tsx`:

```tsx
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lane } from "@/lib/types";
import { LaneCrudDialog, laneDialogCopy } from "./lane-crud-dialog";

const lane = (key: string, name: string, kind: Lane["kind"]): Lane => ({
  id: `id-${key}`,
  key,
  name,
  position: 1,
  kind,
  sla_days: null,
  wip_limit: null,
  color: null,
});

test("renaming any lane promises the ID will not change", () => {
  const done = laneDialogCopy({ type: "rename", lane: lane("done", "Done", "done") }, 0);
  const work = laneDialogCopy({ type: "rename", lane: lane("now", "Now", "work") }, 0);
  expect(done).toBe(work);
  expect(done).toContain("the ID stays the same");
  expect(done).not.toMatch(/stay fixed/i);
});

test("the name field is not read-only for a done lane", () => {
  const html = renderToStaticMarkup(
    <LaneCrudDialog
      mode={{ type: "rename", lane: lane("done", "Done", "done") }}
      lanes={[lane("done", "Done", "done")]}
      cardCount={0}
      onClose={() => {}}
      onCreate={async () => null}
      onRename={async () => null}
      onDelete={async () => null}
    />,
  );
  expect(html).not.toContain("readonly");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/components/board/lane-crud-dialog.test.tsx`
Expected: FAIL — `laneDialogCopy` is not exported from `./lane-crud-dialog`.

- [ ] **Step 3: Write minimal implementation**

In `src/components/board/lane-crud-dialog.tsx`, extract the description copy out of the JSX into an exported pure function, mirroring how `lane-action-dialog.tsx` exports `laneActionCopy`:

```tsx
export function laneDialogCopy(
  mode: Exclude<LaneDialogMode, null>,
  cardCount: number,
): string {
  if (mode.type === "add")
    return "We’ll make an ID from this name. The ID never changes, so it’s safe to use in your markdown.";
  // Every lane, not just work lanes: the display name is free precisely
  // because the ID it sits on is not.
  if (mode.type === "rename")
    return "The ID is what you write in a card’s frontmatter. You can change the display name or color here — the ID stays the same.";
  return `${cardCount} card${cardCount === 1 ? "" : "s"} will be moved before the lane is removed.`;
}
```

Replace the four description branches in `<DialogDescription>` (`:107-116`) with `{laneDialogCopy(mode, props.cardCount)}`, and delete the `readOnly` prop on the name input (`:133`):

```tsx
                readOnly={mode.type === "rename" && mode.lane.kind !== "work"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/components/board/lane-crud-dialog.test.tsx && bun run check`
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/lane-crud-dialog.tsx src/components/board/lane-crud-dialog.test.tsx
git commit -m "feat(#10): rename dialog frees the name field for every lane"
```

---

### Task 7: Every lane gets a menu; nudge items give way to `canDelete`

**Files:**
- Modify: `src/components/board/board-view.tsx:483-493` (`shiftLane`), `:742-785` (`manage` props)
- Modify: `src/components/board/lane-column.tsx:75-90` (manage prop type), `:185-200` (move items), `:234-243` (delete gating)

**Interfaces:**
- Consumes: `reorderLanes` from Task 5.
- Produces: `LaneColumn`'s `manage` prop type loses `canMoveLaneLeft`, `canMoveLaneRight`, `onMoveLane` and gains `canDelete: boolean`. `board-view.tsx` exposes `reorderLanesTo(orderedIds: string[]): Promise<void>`, which Task 8's drag handler calls.

- [ ] **Step 1: Write the failing test**

Run: `grep -n 'canMoveLaneLeft\|onMoveLane\|Move lane left' src/components/board/lane-column.tsx src/components/board/board-view.tsx`
Expected: several hits across both files. After this task the same command must print nothing.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run check`
Expected: FAIL — `moveLane` is no longer exported from `actions.ts` (Task 5), so `board-view.tsx`'s import is unresolved.

- [ ] **Step 3: Write minimal implementation**

In `src/components/board/lane-column.tsx`, change the `manage` prop type (`:77-90`):

```tsx
  manage?: {
    disabled: boolean;
    canEditName: boolean;
    canDelete: boolean;
    canMoveCardsLeft: boolean;
    canMoveCardsRight: boolean;
    canSortCards: boolean;
    onRename: () => void;
    onMoveCards: (delta: -1 | 1) => void;
    onSortCards: (direction: "asc" | "desc") => void;
    onDelete: () => void;
  };
```

Delete the two "Move lane left/right" `DropdownMenuItem`s and the `canEditName` fragment wrapping them (`:185-200`). Drop the now-unused `ArrowLeft`/`ArrowRight` imports only if the bulk card-move items no longer use them — they do use them, so keep both imports.

The rename item (`:182-184`) becomes unconditional in label, since every lane can now be renamed:

```tsx
                <DropdownMenuItem onClick={props.manage.onRename}>
                  <Pencil /> Edit
                </DropdownMenuItem>
```

Re-gate the Remove item and its separator (`:234-243`) on `canDelete` instead of `canEditName`:

```tsx
                {props.manage.canDelete && <DropdownMenuSeparator />}
                {props.manage.canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={props.manage.onDelete}
                  >
                    <Trash2 /> Remove
                  </DropdownMenuItem>
                )}
```

In `src/components/board/board-view.tsx`, replace the `moveLane` import with `reorderLanes`, and replace `shiftLane` (`:483-493`) with:

```tsx
  async function reorderLanesTo(orderedIds: string[]) {
    setError(null);
    const previous = lanes;
    // Optimistic, exactly as moveCard is: the drag already showed the
    // result, so re-rendering from the server would flicker.
    setLanes((prev) => {
      const by = new Map(prev.map((l) => [l.id, l]));
      return orderedIds.flatMap((id, index) => {
        const lane = by.get(id);
        return lane ? [{ ...lane, position: index }] : [];
      });
    });
    const result = await reorderLanes(data.board.id, orderedIds);
    if (!result.ok) {
      setLanes(previous);
      setError(result.error);
      return;
    }
    setLanes(result.lanes);
  }
```

Add the protected-kind set near the top of the module, beside the other module constants:

```tsx
// Mirrors delete_work_lane's guard. These three are resolved by `kind`
// lookup at runtime (archiveCard finds the archive lane, and the inbox on
// restore), so removing one breaks a feature rather than raising.
const PROTECTED_KINDS = new Set<Lane["kind"]>(["inbox", "done", "archive"]);
```

Then rewrite the `manage` prop (`:742-785`) — note it is no longer conditional on `kind`:

```tsx
                manage={{
                  disabled: laneBusy !== null,
                  canEditName: true,
                  canDelete: !PROTECTED_KINDS.has(lane.kind),
                  canMoveCardsLeft:
                    laneIndex > 0 && lanes[laneIndex - 1]?.kind !== "archive",
                  canMoveCardsRight:
                    laneIndex < lanes.length - 1 &&
                    lanes[laneIndex + 1]?.kind !== "archive",
                  canSortCards: lane.kind !== "inbox",
                  onRename: () => setLaneDialog({ type: "rename", lane }),
                  onMoveCards: (delta) => {
                    const destination = lanes[laneIndex + delta];
                    if (!destination || destination.kind === "archive") return;
                    setLaneAction({
                      type: "move-cards",
                      lane,
                      destination,
                      cardCount: byLane.get(lane.id)?.length ?? 0,
                    });
                  },
                  onSortCards: (direction) =>
                    setLaneAction({
                      type: "sort-cards",
                      lane,
                      direction,
                      cardCount: byLane.get(lane.id)?.length ?? 0,
                    }),
                  onDelete: () => setLaneDialog({ type: "delete", lane }),
                }}
```

The `canMoveCardsLeft` / `canMoveCardsRight` archive exclusions and the `onMoveCards` archive check are **kept deliberately** — `move_all_lane_cards` still raises on archive, and that rule is about where cards may be sent, not how lanes are arranged.

Also import `Lane` as a type in `board-view.tsx` if it is not already imported, for `PROTECTED_KINDS`.

- [ ] **Step 4: Run test to verify it passes**

Run: `grep -c 'canMoveLaneLeft\|onMoveLane\|Move lane left' src/components/board/lane-column.tsx src/components/board/board-view.tsx ; bun test ; bun run check`
Expected: grep prints `0` for both files; `bun test` passes; `bun run check` clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/board-view.tsx src/components/board/lane-column.tsx
git commit -m "feat(#10): every lane has a menu; delete gated by kind, nothing else"
```

---

### Task 8: Lanes drag like cards

**Files:**
- Modify: `src/components/board/board-view.tsx:276-353` (drag handlers), `:704-796` (`DndContext` / `main` / `DragOverlay`)
- Modify: `src/components/board/lane-column.tsx:1-10` (imports), `:135-145` (header)

**Interfaces:**
- Consumes: `reorderLanesTo(orderedIds: string[])` from Task 7.
- Produces: no exported API change. Lane sortables carry `data: { type: "lane" }`; card sortables are untouched and carry no `type`, so `active.data.current?.type === "lane"` is the discriminator.

- [ ] **Step 1: Write the failing test**

Add to `e2e/lane-actions.spec.ts`. Read the file first for its sign-in fixture and board setup and reuse them exactly; `docs/testing.md` notes that work-lane drags target `lane.boundingBox().y + 120`, but a *lane* drag targets the lane header, not the card area.

```ts
test("a lane can be dragged across two positions", async ({ page }) => {
  await page.goto(BOARD_URL); // use the spec's existing constant
  const order = async () =>
    page.locator("[data-lane]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-lane")),
    );
  const before = await order();
  expect(before.length).toBeGreaterThan(2);

  const handle = page.locator(
    `[data-lane="${before[0]}"] [data-testid="lane-drag-handle"]`,
  );
  const target = page.locator(`[data-lane="${before[2]}"] .lane-head`);
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Two moves: the first clears the 6px activation constraint, the second
  // is the actual travel. A single jump can land before dnd-kit arms.
  await page.mouse.move(from.x + 20, from.y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();

  await expect
    .poll(async () => (await order())[0])
    .not.toBe(before[0]);

  await page.reload();
  const after = await order();
  expect(after[0]).not.toBe(before[0]);
  expect(after).toContain(before[0]);
  expect(after.length).toBe(before.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:e2e -- lane-actions`
Expected: FAIL — `[data-testid="lane-drag-handle"]` does not exist.

- [ ] **Step 3: Write minimal implementation**

In `src/components/board/lane-column.tsx`, extend the imports:

```tsx
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, /* …existing icons… */ } from "lucide-react";
```

Inside the component, beside the existing `useDroppable`:

```tsx
  const {
    attributes,
    listeners,
    setNodeRef: setLaneDragRef,
    transform: laneTransform,
    isDragging: laneDragging,
  } = useSortable({ id: lane.id, data: { type: "lane" } });
```

Apply the transform to the `<section>` — both the `min` branch and the full branch — by merging into the existing className/style. Give the full-width `<section>` (`:139-141`) a ref that composes both:

```tsx
      ref={(node) => {
        setNodeRef(node);
        setLaneDragRef(node);
      }}
      style={{
        transform: CSS.Translate.toString(laneTransform),
        opacity: laneDragging ? 0.4 : undefined,
      }}
```

Add the handle as the first child of `.lane-head` (`:142`), before the `<h2>`:

```tsx
        {/* The header carries add-card, collapse and menu buttons, and a
            6px activation distance is not enough to stop a click on one of
            them from starting a drag. So the grip is the only listener. */}
        <button
          type="button"
          className={TOOL}
          data-testid="lane-drag-handle"
          aria-label={`Reorder ${lane.name} lane`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </button>
```

Do **not** put `listeners` on the `<section>` or on `.lane-head` itself.

In `src/components/board/board-view.tsx`, add `horizontalListSortingStrategy` to the `@dnd-kit/sortable` import, and track a dragging lane alongside the dragging card:

```tsx
  const [activeLane, setActiveLane] = useState<Lane | null>(null);
```

Then, in `onDragStart` (`:276`), branch before the card lookup:

```tsx
  function onDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === "lane") {
      setActiveLane(lanes.find((l) => l.id === e.active.id) ?? null);
      return;
    }
    const card = cards.find((c) => c.id === e.active.id) ?? null;
    setActive(card);
    setDragFrom(card?.lane_id ?? null);
    setSprung(null);
    hoverLane.current = card?.lane_id ?? null;
  }
```

In `onDragOver` (`:284`), return immediately for a lane drag — there is no cross-container case and the spring-open behaviour would fight it:

```tsx
  function onDragOver(e: DragOverEvent) {
    if (e.active.data.current?.type === "lane") return;
    const { active, over } = e;
    // …unchanged…
```

In `onDragEnd` (`:308`), handle the lane branch first:

```tsx
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (active.data.current?.type === "lane") {
      setActiveLane(null);
      if (!over || over.id === active.id) return;
      const ids = lanes.map((l) => l.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      void reorderLanesTo(arrayMove(ids, from, to));
      return;
    }
    endDrag();
    // …unchanged…
```

Extend `endDrag` (`:267`) to clear `activeLane` too, so a cancelled lane drag does not leave the overlay up.

Wrap the lane list in `<main>` (`:715-718`) with the horizontal sortable:

```tsx
          <main
            className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 sm:px-6"
            aria-label="Priority lanes"
          >
            <SortableContext
              items={lanes.map((l) => l.id)}
              strategy={horizontalListSortingStrategy}
            >
              {lanes.map((lane, laneIndex) => (
                /* …unchanged LaneColumn… */
              ))}
            </SortableContext>
            <button type="button" /* …+ Add lane, outside the SortableContext… */ />
          </main>
```

Keep the "+ Add lane" button outside the `SortableContext` — it is not a sortable item and including it would corrupt the index math.

Finally, render a lane in the `DragOverlay` (`:797`):

```tsx
          <DragOverlay>
            {activeLane ? (
              <div className="paper-lane lane-column-width p-2 opacity-90">
                <div className={`lane-head`}>
                  <h2 className="lane-name">{activeLane.name}</h2>
                </div>
              </div>
            ) : active ? (
              <CardItem /* …unchanged… */ />
            ) : null}
          </DragOverlay>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run check && bun test && bun run test:e2e -- lane-actions`
Expected: PASS.

Then verify by hand in a real browser, per `docs/testing.md` — a passing dnd-kit e2e is not sufficient evidence that a drag feels right:
- drag a lane two positions and confirm it lands where dropped, not one short;
- confirm clicking the add-card, collapse, maximise and menu buttons in a lane header still works and does not start a drag;
- confirm dragging a *card* still works unchanged, including the spring-open on a collapsed lane;
- confirm the Archive lane drags.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/board-view.tsx src/components/board/lane-column.tsx e2e/lane-actions.spec.ts
git commit -m "feat(#10): drag lanes like cards, on the same DndContext"
```

---

### Task 9: End-to-end coverage for renaming and protection

**Files:**
- Modify: `e2e/lane-actions.spec.ts`
- Modify: `docs/lane-management.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `e2e/lane-actions.spec.ts`, reusing the file's existing fixture:

```ts
test("a done lane can be renamed, and its key does not change", async ({
  page,
}) => {
  await page.goto(BOARD_URL);
  const lane = page.locator('[data-lane="done"]');
  await lane.getByRole("button", { name: /^Manage / }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();

  const input = page.getByLabel("Lane name");
  await expect(input).toBeEditable();
  await input.fill("Zenbox");
  await page.getByRole("button", { name: /save|rename/i }).click();

  await expect(lane.locator(".lane-name")).toHaveText("Zenbox");
  await page.reload();
  // The key is the identity: the selector still finds it.
  await expect(page.locator('[data-lane="done"] .lane-name')).toHaveText(
    "Zenbox",
  );
});

test("protected lanes offer no Remove, ordinary lanes do", async ({ page }) => {
  await page.goto(BOARD_URL);
  for (const key of ["unsorted", "done", "archive"]) {
    await page
      .locator(`[data-lane="${key}"]`)
      .getByRole("button", { name: /^Manage / })
      .click();
    await expect(page.getByRole("menuitem", { name: "Remove" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page
    .locator('[data-lane="now"]')
    .getByRole("button", { name: /^Manage / })
    .click();
  await expect(page.getByRole("menuitem", { name: "Remove" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("the archive lane has a manage menu at all", async ({ page }) => {
  await page.goto(BOARD_URL);
  await expect(
    page.locator('[data-lane="archive"]').getByRole("button", {
      name: /^Manage /,
    }),
  ).toBeVisible();
});
```

The archive lane is hidden unless `filters.showArchived` is on (`board-view.tsx:738`) — tick the "Archived" checkbox in the filter bar first, following how `e2e/board.spec.ts` reveals archived cards.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:e2e -- lane-actions`
Expected: the three new tests FAIL if any of Tasks 4, 6 or 7 were skipped; PASS otherwise. Run them before touching docs, so a green result is evidence rather than assumption.

- [ ] **Step 3: Write minimal implementation**

No source changes. Update `docs/lane-management.md`, which documents the current menu contract, to state: every lane can be renamed and reordered; the menu no longer carries "Move lane left/right" because lanes drag by their grip handle; Remove is absent on `inbox`, `done` and `archive` lanes; `key` and `kind` are never editable; a new board seeds Icebox / Doing / Zenbox / Archive.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run check && bun test && bun run test:e2e && bun run db:apply supabase/tests/lane_management.sql && bun run db:test`
Expected: all PASS. Paste the actual output rather than summarising it.

- [ ] **Step 5: Commit**

```bash
git add e2e/lane-actions.spec.ts docs/lane-management.md
git commit -m "test(#10): cover lane rename, protection and drag; refresh the docs"
```

---

## After the plan

Tracker item #10 moves to `building` per the `cardstock-task-loop` skill — `status: built`, `lane: building`, `## Status` overwritten (never appended), then `py -3 backlog/validate_tracker.py`, `py -3 backlog/sync.py --hosted`, and a commit. **Do not set `shipped` or `done`** — those need the operator's confirmation.

#7 ("the lane that needs you is off-screen") is not closed by this work, but its mechanism is: the global reorder Joao offered on the call is now one drag. Ask the operator whether #7 should be closed as covered or kept open for the per-viewer question.
