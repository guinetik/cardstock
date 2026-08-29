# Card Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontmatter-owned, nine-color pastel palette that paints Kanban card backgrounds in both themes and can be selected during card creation and editing.

**Architecture:** Markdown `color` is canonical and `cards.color` is its nullable, constrained database mirror. A React-free shared contract owns names, types, labels, validation, and CSS modifiers; ETL and server actions consume that contract. A reusable accessible picker feeds existing create, optimistic board-patch, and detail-edit flows.

**Tech Stack:** TypeScript, Bun test runner, Zod, Next.js 16 Server Actions, React, Supabase/PostgreSQL, CSS custom properties, Playwright.

## Global Constraints

- Allowed values are exactly `rose`, `orange`, `amber`, `green`, `cyan`, `blue`, `indigo`, `violet`, and `pink`.
- A missing or null color retains the existing neutral `--surface-card` background.
- Markdown frontmatter is the source of truth; import always overwrites or clears the database mirror.
- App writes update the mirror; export writes or removes the managed `color` property.
- Only Kanban cards on `/p/[project]/b/[board]` receive color. Project and board listing tiles do not change.
- Use opaque pastel surfaces; do not add gradients, glass, foreground-color overrides, derived defaults, filtering, or custom colors.
- Every new exported function and component receives TSDoc.
- Follow red-green-refactor: write each behavioral test and observe its expected failure before production edits.
- Before modifying Next.js Server Actions, read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`.
- Do not create git commits unless the user explicitly requests them. If requested, use short messages such as `feat: add card color contract`.

---

### Task 1: Shared card-color contract

**Files:**
- Create: `src/lib/card-color.test.ts`
- Create: `src/lib/card-color.ts`

**Interfaces:**
- Produces: `CARD_COLORS`, `CardColor`, `CARD_COLOR_LABELS`, `isCardColor(value)`, `parseCardColor(value)`, `cardColorModifier(color)`, and `cardColorSurfaceToken(color)`.
- Consumed by: frontmatter schema, ETL mapping, app types, server actions, picker, and card renderer.

- [ ] **Step 1: Write the failing contract tests**

Create `src/lib/card-color.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  CARD_COLORS,
  cardColorModifier,
  cardColorSurfaceToken,
  isCardColor,
  parseCardColor,
} from "./card-color";

describe("card color contract", () => {
  test("defines the nine standardized colors", () => {
    expect(CARD_COLORS).toEqual([
      "rose",
      "orange",
      "amber",
      "green",
      "cyan",
      "blue",
      "indigo",
      "violet",
      "pink",
    ]);
    for (const color of CARD_COLORS) expect(isCardColor(color)).toBe(true);
  });

  test("rejects arbitrary values and defensively maps them to neutral", () => {
    expect(isCardColor("chartreuse")).toBe(false);
    expect(isCardColor(null)).toBe(false);
    expect(parseCardColor("chartreuse")).toBeNull();
    expect(parseCardColor(null)).toBeNull();
  });

  test("maps a valid color to its CSS modifier and token", () => {
    expect(cardColorModifier("blue")).toBe("card-color--blue");
    expect(cardColorModifier(null)).toBeNull();
    expect(cardColorSurfaceToken("blue")).toBe("--surface-card-blue");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `bun test src/lib/card-color.test.ts`

Expected: FAIL because `src/lib/card-color.ts` does not exist.

- [ ] **Step 3: Implement the immutable shared contract**

Create `src/lib/card-color.ts`:

```ts
/** Card tints accepted by frontmatter, persistence, and the UI. */
export const CARD_COLORS = [
  "rose",
  "orange",
  "amber",
  "green",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

/** A standardized board-card tint. */
export type CardColor = (typeof CARD_COLORS)[number];

/** Human-readable labels for card color controls. */
export const CARD_COLOR_LABELS: Readonly<Record<CardColor, string>> = {
  rose: "Rose",
  orange: "Orange",
  amber: "Amber",
  green: "Green",
  cyan: "Cyan",
  blue: "Blue",
  indigo: "Indigo",
  violet: "Violet",
  pink: "Pink",
};

/** Return whether an untrusted value is a supported card color. */
export function isCardColor(value: unknown): value is CardColor {
  return typeof value === "string" && CARD_COLORS.includes(value as CardColor);
}

/** Convert an untrusted persisted value to a supported color or neutral. */
export function parseCardColor(value: unknown): CardColor | null {
  return isCardColor(value) ? value : null;
}

/** Return the CSS modifier for a color, or no modifier for a neutral card. */
export function cardColorModifier(
  color: CardColor | null | undefined,
): `card-color--${CardColor}` | null {
  return color ? `card-color--${color}` : null;
}

/** Return the CSS custom-property name used by a color swatch. */
export function cardColorSurfaceToken(
  color: CardColor,
): `--surface-card-${CardColor}` {
  return `--surface-card-${color}`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `bun test src/lib/card-color.test.ts`

Expected: PASS with 3 tests.

---

### Task 2: Constrained database mirror

**Files:**
- Create: `supabase/tests/card_color.sql`
- Create: `supabase/migrations/20260902000000_card_color.sql`

**Interfaces:**
- Produces: nullable `public.cards.color text`.
- Enforces: null or one of the nine shared names.

- [ ] **Step 1: Write the failing database contract test**

Create `supabase/tests/card_color.sql`:

```sql
do $$
declare
  definition text;
begin
  select pg_get_constraintdef(oid)
    into definition
    from pg_constraint
   where conrelid = 'public.cards'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%color%';

  if definition is null then
    raise exception 'cards.color check constraint is missing';
  end if;

  if definition not like '%rose%'
    or definition not like '%IS NULL%'
    or definition not like '%orange%'
    or definition not like '%amber%'
    or definition not like '%green%'
    or definition not like '%cyan%'
    or definition not like '%blue%'
    or definition not like '%indigo%'
    or definition not like '%violet%'
    or definition not like '%pink%'
  then
    raise exception 'cards.color check constraint is incomplete: %', definition;
  end if;
end
$$;
```

- [ ] **Step 2: Run the database test and verify RED**

Run:

```powershell
Get-Content -Raw "supabase/tests/card_color.sql" | docker exec -i supabase_db_cardstock psql -U postgres -v ON_ERROR_STOP=1 -f -
```

Expected: FAIL with `cards.color check constraint is missing`.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/20260902000000_card_color.sql`:

```sql
alter table public.cards
  add column color text
  check (
    color is null
    or color in (
      'rose',
      'orange',
      'amber',
      'green',
      'cyan',
      'blue',
      'indigo',
      'violet',
      'pink'
    )
  );

comment on column public.cards.color is
  'Optional board-card tint mirrored from frontmatter; null keeps the neutral surface.';
```

- [ ] **Step 4: Apply the migration**

Run: `bun run db:reset`

Expected: local Supabase reset completes and applies `20260902000000_card_color.sql`.

- [ ] **Step 5: Run the database contract test and verify GREEN**

Run:

```powershell
Get-Content -Raw "supabase/tests/card_color.sql" | docker exec -i supabase_db_cardstock psql -U postgres -v ON_ERROR_STOP=1 -f -
```

Expected: PASS with `DO`.

---

### Task 3: Frontmatter validation and import ownership

**Files:**
- Modify: `etl/schema.ts`
- Modify: `etl/mapping.ts`
- Modify: `etl/etl.test.ts`
- Modify: `etl/import.ts`

**Interfaces:**
- Consumes: `CARD_COLORS`, `CardColor`.
- Produces: optional `Frontmatter.color` and `cardColorOnImport(color): CardColor | null`.
- Ownership rule: omission maps to null so import clears stale app state.

- [ ] **Step 1: Add failing schema and mapping tests**

In `etl/etl.test.ts`, add `cardColorOnImport` to the existing `./mapping` import and add:

```ts
import { cardColorOnImport } from "./mapping";

describe("card color frontmatter", () => {
  test("accepts an allowed color", () => {
    const result = validateFrontmatter({
      ...parseFile(FILE).frontmatter,
      color: "blue",
    });
    expect(result.data.color).toBe("blue");
    expect(cardColorOnImport(result.data.color)).toBe("blue");
  });

  test("accepts omission and maps it to a cleared mirror", () => {
    const result = validateFrontmatter(parseFile(FILE).frontmatter);
    expect(result.data.color).toBeUndefined();
    expect(cardColorOnImport(result.data.color)).toBeNull();
  });

  test("rejects an unknown color with the source filename", () => {
    expect(() =>
      validateFrontmatter(
        { ...parseFile(FILE).frontmatter, color: "chartreuse" },
        "bad.md",
      ),
    ).toThrow(/bad\.md.*color/);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `bun test etl/etl.test.ts -t "card color frontmatter"`

Expected: FAIL because `color` is not typed and `cardColorOnImport` is not exported.

- [ ] **Step 3: Extend the schema and add the import mapping**

In `etl/schema.ts`, import the shared contract and add the known optional key:

```ts
import { CARD_COLORS } from "../src/lib/card-color";

// inside frontmatterSchema
color: z.enum(CARD_COLORS).nullable().optional(),
```

In `etl/mapping.ts`, add:

```ts
import type { CardColor } from "../src/lib/card-color";

/** Map canonical frontmatter color to its nullable database mirror. */
export function cardColorOnImport(
  color: CardColor | null | undefined,
): CardColor | null {
  return color ?? null;
}
```

- [ ] **Step 4: Apply the mapping on every imported row**

In `etl/import.ts`, import `cardColorOnImport`, add `color` to the existing-card select, and include this property in the row assembled after validation:

```ts
color: cardColorOnImport(fm.color),
```

Do not gate this assignment on a new card or an empty database value. Existing Markdown without `color` must write null.

- [ ] **Step 5: Run the focused and ETL tests**

Run:

```powershell
bun test etl/etl.test.ts -t "card color frontmatter"
bun test etl
```

Expected: both commands PASS.

---

### Task 4: Managed frontmatter write and export

**Files:**
- Modify: `etl/export.test.ts`
- Modify: `etl/frontmatter-write.ts`
- Modify: `etl/export.ts`

**Interfaces:**
- Consumes: `cards.color`.
- Produces: managed `color` frontmatter; null removes an existing property.

- [ ] **Step 1: Add failing managed-write tests**

In `etl/export.test.ts`, add tests using the file’s existing Markdown fixture:

```ts
test("writes a managed card color without disturbing custom frontmatter", () => {
  const result = writeManaged(
    "---\nid: 7\ncustom_key: keep\ncolor: rose\n---\n# Card\n",
    { color: "blue" },
  );
  expect(result).toContain("color: blue");
  expect(result).toContain("custom_key: keep");
  expect(result).not.toContain("color: rose");
});

test("removes a managed card color when cleared", () => {
  const result = writeManaged(
    "---\nid: 7\ncolor: rose\n---\n# Card\n",
    { color: null },
  );
  expect(result).not.toContain("color:");
});

test("includes color in newly created Markdown", () => {
  const result = createNewCardMarkdown({
    externalId: "153",
    title: "Add cards from the board",
    status: "backlog",
    epic: "Board",
    area: "Workflow",
    tags: ["kind:feature", "internal"],
    summary: "Create an issue without leaving its lane.",
    bodyMd: "## Ask\n\nKeep the Markdown round trip.",
    managed: {
      lane: "now",
      rank: 1,
      priority: 2,
      effort: "M",
      color: "green",
    },
  });
  expect(result).toContain("color: green");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `bun test etl/export.test.ts`

Expected: FAIL because `color` is not a `ManagedKey` and existing `color` is not replaced or removed.

- [ ] **Step 3: Make color a managed export key**

Append `"color"` to `MANAGED_KEYS` in `etl/frontmatter-write.ts`:

```ts
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
```

The existing `Managed` mapped type and `writeManaged` loop then handle write and removal.

- [ ] **Step 4: Load and export the mirror**

In `etl/export.ts`, add `color` to the card select and to the managed values:

```ts
const managed: Managed = {
  // existing properties
  color: c.color ?? null,
};
```

- [ ] **Step 5: Run the export tests**

Run: `bun test etl/export.test.ts`

Expected: PASS, including existing idempotency coverage.

---

### Task 5: App types, loading, actions, and history

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/board-data.ts`
- Modify: `src/app/p/[project]/b/[board]/actions.ts`
- Modify: `src/lib/card-history.test.ts`
- Modify: `src/lib/card-history.ts`

**Interfaces:**
- `Card.color: CardColor | null`.
- `CreateCardInput.color?: CardColor | null`.
- `CardPatch.color?: CardColor | null`.
- Invalid action input returns `{ ok: false, error: "Invalid color." }`.

- [x] **Step 1: Add the failing history behavior**

In `src/lib/card-history.test.ts`, extend the edited-event cases:

```ts
test("describes a color edit without exposing the raw color", () => {
  const line = formatCardEvent(
    ev({ kind: "edited", payload: { color: "blue" } }),
    lanes,
    opts,
  );
  expect(line.facts).toBe("changed the color");
  expect(line.facts).not.toContain("blue");
});
```

- [x] **Step 2: Run the history test and verify RED**

Run: `bun test src/lib/card-history.test.ts -t "color edit"`

Expected: FAIL because unknown edited keys currently produce `changed color`.

- [x] **Step 3: Add typed color to app data**

In `src/lib/types.ts`:

```ts
import type { CardColor } from "./card-color";

export interface Card {
  // existing fields
  color: CardColor | null;
}
```

In `src/lib/board-data.ts`, append `color` to the explicit cards select. The existing row spread carries it into `Card`.

- [x] **Step 4: Validate color on create and update**

Read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`.

In `actions.ts`, import the contract:

```ts
import { type CardColor, isCardColor } from "@/lib/card-color";
```

Extend inputs:

```ts
export interface CreateCardInput {
  // existing fields
  color?: CardColor | null;
}

export interface CardPatch {
  // existing fields
  color?: CardColor | null;
}
```

In `createCard`, before any write:

```ts
if (input.color != null && !isCardColor(input.color)) {
  return { ok: false, error: "Invalid color." };
}
```

Add `color: input.color ?? null` to the insert and `color` to the returned-card select.

In `updateCard`, after `clean` is built and before `.update(clean)`:

```ts
if (
  Object.hasOwn(clean, "color") &&
  clean.color != null &&
  !isCardColor(clean.color)
) {
  return { ok: false, error: "Invalid color." };
}
```

Keep the existing edited event payload as `clean`; it will record `{ color: "blue" }` or `{ color: null }`.

- [x] **Step 5: Teach history the safe color phrase**

Add `"color"` to `EDIT_ORDER` in `src/lib/card-history.ts` and add:

```ts
case "color":
  return "changed the color";
```

- [x] **Step 6: Run tests and type checking**

Run:

```powershell
bun test src/lib/card-color.test.ts src/lib/card-history.test.ts
bun run check
```

Expected: tests PASS and type checking reports no missing `Card.color` fields or invalid action payloads.

---

### Task 6: Theme tokens and card modifiers

**Files:**
- Modify: `src/styles/themes/theme-discipline.test.ts`
- Modify: `src/styles/themes/tokens.css`
- Modify: `src/styles/themes/paper.css`
- Modify: `src/styles/themes/paper-night.css`
- Modify: `src/styles/components/paper.css`

**Interfaces:**
- Produces: `--surface-card-{color}` in both themes.
- Produces: `.paper-card.card-color--{color}` modifiers that change only `background`.

- [ ] **Step 1: Add failing theme contract assertions**

In `theme-discipline.test.ts`, read the component stylesheet using the existing file helper and add:

```ts
test("defines every card-color surface in both themes", () => {
  for (const color of [
    "rose",
    "orange",
    "amber",
    "green",
    "cyan",
    "blue",
    "indigo",
    "violet",
    "pink",
  ]) {
    const token = `--surface-card-${color}`;
    expect(PAPER).toContain(token);
    expect(PAPER_NIGHT).toContain(token);
    expect(COMPONENTS).toContain(
      `.paper-card.card-color--${color}`,
    );
    expect(COMPONENTS).toContain(`var(${token})`);
  }
});
```

Use the test file’s existing constants for stylesheet contents rather than introducing duplicate reads.

- [ ] **Step 2: Run the theme test and verify RED**

Run: `bun test src/styles/themes/theme-discipline.test.ts`

Expected: FAIL on the first missing `--surface-card-rose`.

- [ ] **Step 3: Extend the token contract and light theme**

Add these names to the documented contract in `tokens.css`.

In the paper theme declaration, add:

```css
--surface-card-rose: #f2c6d0;
--surface-card-orange: #f2cfad;
--surface-card-amber: #eedb91;
--surface-card-green: #c5dfbd;
--surface-card-cyan: #bce0df;
--surface-card-blue: #c4d8ee;
--surface-card-indigo: #ced0ed;
--surface-card-violet: #ddc7eb;
--surface-card-pink: #edc7df;
```

- [ ] **Step 4: Extend the dark theme**

In the paper-night theme declaration, add:

```css
--surface-card-rose: #6b3945;
--surface-card-orange: #6a4530;
--surface-card-amber: #625424;
--surface-card-green: #315a36;
--surface-card-cyan: #2c5960;
--surface-card-blue: #345575;
--surface-card-indigo: #44496f;
--surface-card-violet: #573d6b;
--surface-card-pink: #683b5a;
```

- [ ] **Step 5: Add card-only modifiers**

Near the existing `.paper-card` rules in `src/styles/components/paper.css`, add:

```css
.paper-card.card-color--rose { background: var(--surface-card-rose); }
.paper-card.card-color--orange { background: var(--surface-card-orange); }
.paper-card.card-color--amber { background: var(--surface-card-amber); }
.paper-card.card-color--green { background: var(--surface-card-green); }
.paper-card.card-color--cyan { background: var(--surface-card-cyan); }
.paper-card.card-color--blue { background: var(--surface-card-blue); }
.paper-card.card-color--indigo { background: var(--surface-card-indigo); }
.paper-card.card-color--violet { background: var(--surface-card-violet); }
.paper-card.card-color--pink { background: var(--surface-card-pink); }
```

Do not alter the generic `.paper-card` selector because project and board tiles reuse it.

- [ ] **Step 6: Run the theme test and verify GREEN**

Run: `bun test src/styles/themes/theme-discipline.test.ts`

Expected: PASS, including exact light/dark token parity and no-glass checks.

---

### Task 7: Accessible reusable color picker

**Files:**
- Create: `src/components/board/card-color-picker.tsx`
- Create: `src/components/board/card-color-picker.test.tsx`

**Interfaces:**
- Consumes: shared colors, labels, and surface-token helper.
- Produces: `CardColorPicker({ value, onChange, disabled?, label? })`.

- [ ] **Step 1: Add a failing rendered-behavior test**

Create `src/components/board/card-color-picker.test.tsx`:

```tsx
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardColorPicker } from "./card-color-picker";

test("the picker exposes named, pressable color choices and neutral", () => {
  const html = renderToStaticMarkup(
    <CardColorPicker value="blue" onChange={() => undefined} />,
  );
  expect(html).toContain("<fieldset");
  expect(html.match(/aria-pressed="/g)).toHaveLength(10);
  expect(html).toContain('aria-label="No color"');
  expect(html).toContain('aria-label="Blue"');
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html).not.toContain('role="radio"');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `bun test src/components/board/card-color-picker.test.tsx`

Expected: FAIL because `card-color-picker.tsx` does not exist.

- [ ] **Step 3: Implement the picker**

Create `card-color-picker.tsx`:

```tsx
"use client";

import {
  CARD_COLORS,
  CARD_COLOR_LABELS,
  type CardColor,
  cardColorSurfaceToken,
} from "@/lib/card-color";

export interface CardColorPickerProps {
  value: CardColor | null;
  onChange: (color: CardColor | null) => void;
  disabled?: boolean;
  label?: string;
}

/** Select or clear a standardized board-card tint. */
export function CardColorPicker({
  value,
  onChange,
  disabled = false,
  label = "Card color",
}: CardColorPickerProps) {
  return (
    <fieldset aria-label={label} className="card-color-picker">
      <button
        type="button"
        aria-pressed={value === null}
        aria-label="No color"
        className="card-color-choice card-color-choice--none"
        onClick={() => onChange(null)}
        disabled={disabled}
      >
        <span className="sr-only">No color</span>
      </button>
      {CARD_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-pressed={value === color}
          aria-label={CARD_COLOR_LABELS[color]}
          title={CARD_COLOR_LABELS[color]}
          className="card-color-choice"
          style={{
            background: `var(${cardColorSurfaceToken(color)})`,
          }}
          onClick={() => onChange(color)}
          disabled={disabled}
        >
          <span className="sr-only">{CARD_COLOR_LABELS[color]}</span>
        </button>
      ))}
    </fieldset>
  );
}
```

Add focused component rules to `src/styles/components/paper.css` for a wrapping flex row, visible selected state via `[aria-pressed="true"]`, and `:focus-visible` using existing border and ink tokens. Keep swatches at 1.5rem. Neutral is the same circle as the tints, with `aria-label="No color"` plus a visually hidden name—do not use a rectangular labeled control.

Use these rules:

```css
.card-color-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.card-color-choice {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid white;
  border-radius: 999px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.32);
}

.card-color-choice--none {
  position: relative;
  overflow: hidden;
  width: 1.5rem;
  height: 1.5rem;
  background: var(--surface-card);
}

.card-color-choice--none::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 0.125rem;
  right: 0.125rem;
  height: 0.125rem;
  border-radius: 999px;
  background: var(--pen-red);
  transform: translateY(-50%) rotate(-45deg);
  transform-origin: center;
}

.card-color-choice[aria-pressed="true"] {
  outline: 2px solid var(--color-ink);
  outline-offset: 2px;
}

.card-color-choice:focus-visible {
  outline: 2px solid var(--pen-blue);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run the picker contract test**

Run: `bun test src/components/board/card-color-picker.test.tsx`

Expected: PASS.

---

### Task 8: Render and edit colors across card surfaces

**Files:**
- Modify: `e2e/board.spec.ts`
- Modify: `src/components/board/card-item.tsx`
- Modify: `src/components/board/card-create-dialog.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx`
- Verify: `src/components/board/board-view.tsx`

**Interfaces:**
- Consumes: `CardColorPicker`, `cardColorModifier`, `parseCardColor`, typed action inputs.
- Produces: colored card rendering and create/edit controls on all approved surfaces.

- [ ] **Step 1: Add a failing board color scenario**

In `e2e/board.spec.ts`, follow the existing persisted priority/effort scenario and add:

```ts
test("sets, persists, and clears a card color", async ({ page }) => {
  const card = page.locator('[data-lane="unsorted"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await card.hover();
  await card.getByRole("button", { name: "Blue" }).click();
  await expect(card.locator("article")).toHaveClass(/card-color--blue/);

  await page.reload();
  const persisted = page.locator(`[data-id="${id}"]`);
  await expect(persisted.locator("article")).toHaveClass(/card-color--blue/);

  await persisted.hover();
  await persisted.getByRole("button", { name: "No color" }).click();
  await expect(persisted.locator("article")).not.toHaveClass(
    /card-color--/,
  );
});
```

- [ ] **Step 2: Run the scenario and verify RED**

Run: `bun run test:e2e e2e/board.spec.ts -g "card color"`

Expected: FAIL because no color picker buttons exist.

- [ ] **Step 3: Paint and edit the board card**

In `card-item.tsx`, import the picker and helpers. Compute:

```ts
const color = parseCardColor(card.color);
const colorClass = cardColorModifier(color) ?? "";
```

Append `colorClass` to the `<article>` class string. In the existing editable `card-form`, after `Ratings`, render:

```tsx
<span className="field-label">Color</span>
<CardColorPicker
  value={color}
  onChange={(next) => props.onPatch?.(card.id, { color: next })}
  label={`Color for card #${card.external_id}`}
/>
```

Render this only when `!props.overlay && props.onPatch`, matching other editable controls.

- [ ] **Step 4: Add color to card creation**

In `card-create-dialog.tsx`, add:

```ts
const [color, setColor] = useState<CardColor | null>(null);
```

Pass `color` in `onCreate`. In the filing sidebar, add:

```tsx
<div>
  <span className={label}>Color</span>
  <CardColorPicker
    value={color}
    onChange={setColor}
    disabled={busy}
    label="New card color"
  />
</div>
```

- [ ] **Step 5: Add color to the detail editor**

In `card-editor.tsx`, add `color: CardColor | null` to its local card shape, import the picker, and render:

```tsx
<div>
  <span className={label}>Color</span>
  <CardColorPicker
    value={parseCardColor(card.color)}
    onChange={(color) => save({ color })}
    disabled={pending}
    label={`Color for card #${card.external_id}`}
  />
</div>
```

Use the component’s existing pending-state variable and field-label class names.

- [ ] **Step 6: Verify optimistic creation data**

Confirm that `board-view.tsx` retains its existing `setCards((current) => [result.card, ...current])`. No code change is required there because the create action’s returning select now includes `color`.

- [ ] **Step 7: Run static checks and the focused scenario**

Run:

```powershell
bun run check
bun run test:e2e e2e/board.spec.ts -g "card color"
```

Expected: type/lint checks PASS; the scenario confirms blue survives reload and clearing returns to neutral.

---

### Task 9: Generated contract, documentation, and full verification

**Files:**
- Regenerate: `docs/frontmatter.schema.json`
- Create: `docs/card-colors.md`
- Verify all files changed by Tasks 1–8

**Interfaces:**
- Produces: public schema and user-facing frontmatter reference.

- [ ] **Step 1: Regenerate the JSON Schema**

Run: `bun run etl:schema`

Expected: `docs/frontmatter.schema.json` contains a nullable `color` property whose enum has all nine names.

- [ ] **Step 2: Document usage**

Create `docs/card-colors.md`:

````md
# Card colors

Board cards can use an optional standardized pastel tint:

```yaml
color: blue
```

Allowed values are `rose`, `orange`, `amber`, `green`, `cyan`, `blue`,
`indigo`, `violet`, and `pink`. Remove the property, or choose **No color**
in the app, to use the neutral paper background.

Markdown frontmatter is canonical. Import copies the property into the app;
app changes are written back to Markdown on the next export.
````

- [ ] **Step 3: Run all unit tests**

Run: `bun test`

Expected: all tests PASS without warnings or unhandled errors.

- [ ] **Step 4: Run repository checks**

Run: `bun run check`

Expected: Biome and TypeScript complete successfully.

- [ ] **Step 5: Run the board suite**

Run: `bun run test:e2e e2e/board.spec.ts`

Expected: all board scenarios PASS. If the local Supabase or browser environment is unavailable, report the exact environment failure and retain the focused unit/check evidence.

- [ ] **Step 6: Review the final diff against scope**

Verify:

- only board-card `<article>` elements receive `card-color--*`;
- listing-page project and board tiles remain unchanged;
- null and unknown persisted values render neutral;
- import omission clears `cards.color`;
- export null removes `color:`;
- both themes define all nine opaque tokens;
- no duplicate palette arrays exist outside tests, SQL, generated schema, and CSS declarations.

---

### Task 8A: Refine card-color differentiation and circular none swatch

**Files:**
- Modify: `src/styles/themes/theme-discipline.test.ts`
- Modify: `src/components/board/card-color-picker.test.tsx`
- Modify: `src/components/board/card-color-picker.tsx`
- Modify: `src/styles/components/paper.css`
- Modify: `src/styles/themes/paper.css`
- Modify: `src/styles/themes/paper-night.css`
- Modify: `docs/superpowers/specs/2026-08-28-card-colors-design.md`
- Modify: `docs/superpowers/plans/2026-08-29-card-colors.md`

Replace the original pastel table with the more differentiated light/dark values above. Neutral is a 1.5rem circle with a solid `--pen-red` `::after` slash (`height: 0.125rem`, rounded ends) clipped by `overflow: hidden`. Every tint and none circle uses `border: 2px solid white` and `box-shadow: 0 1px 4px rgb(0 0 0 / 0.32)` instead of the gray 1px rim. Accessible name remains `No color` via `aria-label` and `sr-only`. Do not rename colors, add gradients, or change foreground ink.

- [ ] **Step 1: Fail on old tokens and rectangular none**

Run: `bun test src/styles/themes/theme-discipline.test.ts src/components/board/card-color-picker.test.tsx`

Expected: RED — old hex values, `width: auto` none control, missing `aria-label="No color"`.

- [ ] **Step 2: Implement tokens, circular none, and picker name**

Apply the revised token values, `.card-color-choice--none` circle + `::after` slash, and `aria-label="No color"` plus visually hidden text.

- [ ] **Step 3: Verify GREEN and checks**

Run focused tests, focused Biome, `bunx tsc --noEmit`, and `bun run test:e2e e2e/board.spec.ts -g "card color"`.

