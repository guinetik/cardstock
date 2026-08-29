# Card Status Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the card detail editor change a card’s single tracker `status` through `updateCard`, with a native select of the eight raw vocabulary words.

**Architecture:** Share `CARD_STATUSES` / `isCardStatus` from `src/lib/card-status.ts`. The editor grid gets a Status `<select>` that saves on change. `updateCard` validates and writes `cards.status` plus an `edited` event. History formats `set status to wip`. Import/export and the header `.stat` stay as they are.

**Tech Stack:** Existing `CardEditor` / `updateCard` · bun test · Playwright against `/p/demo/b/backlog/c/1` · paper field chrome already on the sheet.

**Spec:** `docs/superpowers/specs/2026-08-29-card-status-edit-design.md`

## Global Constraints

- Native `<select>` in the editor grid (first cell, before Priority). Not the filter-bar coloured menu.
- Options are the raw words: `backlog`, `blocked`, `wip`, `held`, `built`, `handed`, `shipped`, `done`. No blank option.
- Full vocabulary, not board-collected. Shared list in `src/lib/card-status.ts`.
- Header `.stat` stays a scan mark. Do not restyle it.
- History: `set status to wip` for a vocabulary value; otherwise `changed status`. `EDIT_ORDER` inserts `status` after `effort` and before `target_date`.
- `updateCard` rejects unknown status with `Invalid status.` Do not stamp `summary_edited_at` or a status timestamp.
- Create dialog keeps friendly labels (“In progress”, …) but option *values* come from the shared list.
- Import still owns status on CLI import. Do not change ETL.
- No new CSS tokens. JSDoc on every exported function.
- Commit messages: `feat: …` / `docs: …`, short.
- Only touch files listed in this plan. Leave unrelated dirty files alone.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/card-status.ts` | `CARD_STATUSES`, `CardStatus`, `isCardStatus`, existing `statusChipClass` |
| `src/lib/card-status.test.ts` | bun tests for the vocabulary helper |
| `src/lib/card-history.ts` | `EDIT_ORDER` + `editField` for `status` |
| `src/lib/card-history.test.ts` | known / junk status facts |
| `src/app/p/[project]/b/[board]/actions.ts` | `CardPatch.status`; validate in `updateCard`; create uses `isCardStatus` |
| `src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx` | Status select |
| `src/app/p/[project]/b/[board]/c/[externalId]/card-sheet.tsx` | Pass `status` into the editor |
| `src/components/board/card-create-dialog.tsx` | Option values from `CARD_STATUSES` |
| `docs/card-detail.md` | Grid includes Status |
| `e2e/board.spec.ts` | Persist status on `/c/1` |

---

### Task 1: Shared vocabulary

**Files:**
- Modify: `src/lib/card-status.ts`
- Test: `src/lib/card-status.test.ts`

**Interfaces:**
- Consumes: existing `statusChipClass`
- Produces: `CARD_STATUSES` readonly tuple in that exact order; `type CardStatus = (typeof CARD_STATUSES)[number]`; `isCardStatus(value: unknown): value is CardStatus`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/card-status.test.ts` (keep the existing `statusChipClass` describe):

```ts
import { CARD_STATUSES, isCardStatus, statusChipClass } from "./card-status";
```

```ts
describe("CARD_STATUSES", () => {
  test("is the tracker vocabulary in create-dialog order", () => {
    expect(CARD_STATUSES).toEqual([
      "backlog",
      "blocked",
      "wip",
      "held",
      "built",
      "handed",
      "shipped",
      "done",
    ]);
  });
});

describe("isCardStatus", () => {
  test("accepts the vocabulary and rejects junk", () => {
    expect(isCardStatus("wip")).toBe(true);
    expect(isCardStatus("mystery")).toBe(false);
    expect(isCardStatus(null)).toBe(false);
    expect(isCardStatus("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/card-status.test.ts`

Expected: FAIL — `CARD_STATUSES` / `isCardStatus` are not exported.

- [ ] **Step 3: Implement the helpers**

At the top of `src/lib/card-status.ts`, before `STATUS_CHIP`:

```ts
/** Tracker status vocabulary. One card has exactly one of these. */
export const CARD_STATUSES = [
  "backlog",
  "blocked",
  "wip",
  "held",
  "built",
  "handed",
  "shipped",
  "done",
] as const;

/** One value from `CARD_STATUSES`. */
export type CardStatus = (typeof CARD_STATUSES)[number];

/** True when `value` is a tracker status word. */
export function isCardStatus(value: unknown): value is CardStatus {
  return (
    typeof value === "string" &&
    (CARD_STATUSES as readonly string[]).includes(value)
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/card-status.test.ts`

Expected: PASS (pen map tests still pass).

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-status.ts src/lib/card-status.test.ts
git commit -m "feat: share tracker status vocabulary"
```

---

### Task 2: History facts

**Files:**
- Modify: `src/lib/card-history.ts`
- Test: `src/lib/card-history.test.ts`

**Interfaces:**
- Consumes: `isCardStatus` from `./card-status`
- Produces: `EDIT_ORDER` includes `"status"` immediately after `"effort"`; `editField("status", "wip")` → `set status to wip`; unknown → `changed status`

- [ ] **Step 1: Write the failing tests**

In `src/lib/card-history.test.ts`, in `describe("edited")`:

1. Add `status: "wip"` to the payload of `"known fields in order, values only where specified"` and change the expected facts to:

```
set priority to P2, set effort to M, set status to wip, rewrote the summary, changed the tags, edited the write-up, and changed extra_uuid
```

2. Add `status: "nope"` to the payload of `"bad values fall back to a changed-field phrase"` and change the expected facts to:

```
changed priority, changed effort, changed status, changed the target date, and changed audience
```

(`status` sorts before `target_date` in `EDIT_ORDER`, so it appears after effort and before the target date phrase.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/card-history.test.ts`

Expected: FAIL — expected string does not match (status is currently an `extra` key → `changed status` in extra-key order, or missing from EDIT_ORDER).

- [ ] **Step 3: Implement history**

In `src/lib/card-history.ts`:

1. `import { isCardStatus } from "./card-status";`
2. Insert `"status"` in `EDIT_ORDER` after `"effort"`:

```ts
const EDIT_ORDER = [
  "priority",
  "effort",
  "status",
  "target_date",
  "target_label",
  "audience",
  "title",
  "summary",
  "tags",
  "body",
  "color",
] as const;
```

3. In `editField`, add before `case "target_date"`:

```ts
    case "status":
      if (isCardStatus(value)) return `set status to ${value}`;
      return "changed status";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/lib/card-history.test.ts src/lib/card-status.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/card-history.ts src/lib/card-history.test.ts
git commit -m "feat: history records status edits"
```

---

### Task 3: Editor and `updateCard`

**Files:**
- Modify: `src/app/p/[project]/b/[board]/actions.ts`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/card-sheet.tsx`
- Modify: `src/components/board/card-create-dialog.tsx`

**Interfaces:**
- Consumes: `CARD_STATUSES`, `isCardStatus`, `type CardStatus` from `@/lib/card-status`
- Produces: `CardPatch.status?: string`; `updateCard` writes it when present and valid; `CardEditor` Status select; create dialog option values from `CARD_STATUSES`

- [ ] **Step 1: Wire `updateCard`**

In `src/app/p/[project]/b/[board]/actions.ts`:

1. Add `import { isCardStatus } from "@/lib/card-status";`
2. Remove the local `CARD_STATUSES` `Set`. In `createCard`, replace `CARD_STATUSES.has(status)` with `isCardStatus(status)`.
3. Add to `CardPatch`: `status?: string;`
4. After the color check in `updateCard`, before the summary stamp:

```ts
  if (Object.hasOwn(clean, "status") && !isCardStatus(clean.status)) {
    return { ok: false, error: "Invalid status." };
  }
```

Do not add `summary_edited_at` for status. Do not change ETL.

- [ ] **Step 2: Add the select**

In `src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx`:

1. `import { CARD_STATUSES } from "@/lib/card-status";`
2. Add `status: string` to `CardLite`.
3. Update the component JSDoc to mention status.
4. As the **first** child inside the `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` div, before Priority:

```tsx
        <label>
          <span className={fieldLabel}>Status</span>
          <select
            className={field}
            defaultValue={card.status}
            disabled={pending}
            onChange={(e) => save({ status: e.target.value })}
          >
            {CARD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
```

No blank `<option>`. Labels are the raw words.

In `card-sheet.tsx`, pass `status: card.status` into the `CardEditor` `card={{ ... }}` object.

- [ ] **Step 3: Create dialog values from the shared list**

In `src/components/board/card-create-dialog.tsx`:

1. `import { CARD_STATUSES, type CardStatus } from "@/lib/card-status";`
2. Keep friendly labels **in this file only**:

```ts
const STATUS_CREATE_LABEL: Record<CardStatus, string> = {
  backlog: "Backlog",
  blocked: "Blocked",
  wip: "In progress",
  held: "Held",
  built: "Built",
  handed: "Handed over",
  shipped: "Shipped",
  done: "Done",
};
```

3. Replace the eight hardcoded `<option>`s with:

```tsx
            {CARD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_CREATE_LABEL[value]}
              </option>
            ))}
```

Do not change the default `useState("backlog")`.

- [ ] **Step 4: Confirm lib tests still pass**

Run: `bun test src/lib/card-status.test.ts src/lib/card-history.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/p/[project]/b/[board]/actions.ts src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx src/app/p/[project]/b/[board]/c/[externalId]/card-sheet.tsx src/components/board/card-create-dialog.tsx
git commit -m "feat: edit card status on the detail sheet"
```

---

### Task 4: e2e and docs

**Files:**
- Modify: `e2e/board.spec.ts`
- Modify: `docs/card-detail.md`

**Interfaces:**
- Consumes: Status `<select>` labelled `Status` on `/p/demo/b/backlog/c/1` (demo card `#1` is `backlog`)
- Produces: Playwright coverage that the select persists; docs sentence

- [ ] **Step 1: Add the e2e**

In `e2e/board.spec.ts`, after `"card title and hover pill open the card page with the full body"`, add:

```ts
test("card page status select persists", async ({ page }) => {
  await page.goto(`${BOARD}/c/1`);
  const select = page.getByLabel("Status");
  await expect(select).toHaveValue("backlog");
  await select.selectOption("wip");
  await expect(page.locator("output")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("wip");
  await expect(page.locator("h1 + div .stat").first()).toHaveText("wip");
  await page.getByLabel("Status").selectOption("backlog");
  await expect(page.locator("output")).toHaveText("Saved");
});
```

Do not change other tests. The last `selectOption("backlog")` keeps the suite re-runnable.

- [ ] **Step 2: Run the test**

Run: `bun run test:e2e e2e/board.spec.ts -g "status select persists"`

Expected: PASS. If Saved never appears, wait on `output` is the right gate — do not drop the restore step.

- [ ] **Step 3: Document the grid**

In `docs/card-detail.md`, change the Fields paragraph’s first sentence from “Summary, ratings, dates, audience, and color” to include Status, and add after that sentence:

`Status is a native select of the tracker vocabulary (raw words: backlog, wip, …), first cell in the grid, saved through updateCard.`

Keep the rest of the file. Do not edit `docs/paper.md`.

- [ ] **Step 4: Commit**

```bash
git add e2e/board.spec.ts docs/card-detail.md
git commit -m "docs: status is editable on the card sheet"
```

---

## Spec coverage

| Spec decision | Task |
|---|---|
| Native select, raw words, no blank | Task 3 |
| Shared `CARD_STATUSES` | Task 1; create + updateCard in Task 3 |
| Header `.stat` unchanged | Task 3 (no header edit); Task 4 asserts the word updates after save |
| First grid cell | Task 3 |
| History `set status to wip` / `changed status`; EDIT_ORDER | Task 2 |
| `Invalid status.` | Task 3 |
| Create dialog friendly labels, shared values | Task 3 |
| Import/export unchanged | Global constraint — no ETL task |
| bun history tests | Task 2 |
| e2e on `/c/1` restore to backlog | Task 4 |
| `docs/card-detail.md` | Task 4 |
