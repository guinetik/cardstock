# Card colors — frontmatter-owned pastel tints

**Date:** 2026-08-28
**Status:** approved in conversation; implementation follows this document.
**Scope:** Kanban cards on `/p/[project]/b/[board]`. Project and board listing tiles do not change.

---

## The problem

Every board card currently uses the same neutral paper surface. Trackers need an optional, portable visual classification that lives with the issue in Markdown rather than being inferred from a lane, epic, tag, or database-only setting.

## What we're building

Add an optional `color` frontmatter property with nine fixed values:

`rose`, `orange`, `amber`, `green`, `cyan`, `blue`, `indigo`, `violet`, `pink`

The value tints the board card background. Each named color has coordinated light and dark theme values. A card without `color` keeps the existing neutral `--surface-card` background.

Users can choose or clear the color while creating a card and from the existing card-editing surfaces. The choice is represented in Markdown as:

```yaml
color: blue
```

---

## Ownership and synchronization

Markdown frontmatter is the source of truth. `cards.color` is a typed database mirror used for application reads and optimistic updates.

1. Import validates frontmatter and copies `color` into `cards.color`.
2. An import overwrites the database mirror, including clearing it when the property is absent.
3. App create and edit actions validate and update the mirror.
4. Export writes the mirror back to `color` frontmatter; a null mirror removes the property.
5. Until export runs, an app edit is pending synchronization in the same way as other app-managed exported fields.

This requires a nullable text column with a database check constraint for the nine values. It does not use `frontmatter_extra`, because that would weaken validation and complicate reads.

---

## Shared contract

A small React-free module owns the palette names, type, validation helper, labels, and CSS modifier mapping. ETL, server actions, and UI code consume this contract rather than maintaining separate arrays.

All exported functions receive TSDoc. The module exposes only immutable palette data and pure helpers so it can be tested without React or database dependencies.

The frontmatter Zod schema uses the same values. `color` is a known optional key, not an arbitrary extra. Unknown color names fail validation with the source filename in the existing ETL error format. Server actions reject unknown values independently because client input is untrusted.

---

## Rendering and theme

`CardItem` adds a modifier such as `card-color--blue` when `card.color` is set. The modifier changes only the card background token; card structure, hover behavior, drag overlay, typography, borders, and metadata colors stay unchanged.

The theme token contract gains nine semantic card-color tokens. Both `paper` and `paper-night` define every token:

| Name | Light | Dark |
|---|---|---|
| rose | `#f2c6d0` | `#6b3945` |
| orange | `#f2cfad` | `#6a4530` |
| amber | `#eedb91` | `#625424` |
| green | `#c5dfbd` | `#315a36` |
| cyan | `#bce0df` | `#2c5960` |
| blue | `#c4d8ee` | `#345575` |
| indigo | `#ced0ed` | `#44496f` |
| violet | `#ddc7eb` | `#573d6b` |
| pink | `#edc7df` | `#683b5a` |

These are opaque paper tints, not gradients or translucent glass. Existing ink tokens continue to provide text contrast in each theme.

---

## Editing experience

Create a reusable color picker that displays a circular “No color” swatch plus nine compact named swatches. Every circle uses a thick white rim and a soft drop shadow. Neutral is the same 1.5rem circle as every tint, filled with paper stock and crossed by a solid `--pen-red` diagonal slash. It is keyboard accessible, exposes selection through native `button` + `aria-pressed` semantics in a semantic `fieldset`, and does not rely on color alone: the accessible name remains exactly `No color`, and every tint swatch has an accessible name and selected state.

The picker is used in:

- the card creation sheet;
- the editable back/peek area of a board card;
- the card detail editor.

Selecting a board-card color uses the existing optimistic `onPatch` flow. A failed action restores server state through the existing refresh/error path. The creation form submits `color` with the rest of `CreateCardInput`.

Clearing the selection sends `null`, removes the frontmatter property on export, and immediately returns the card to the neutral paper surface.

---

## Data flow and affected units

| Unit | Responsibility |
|---|---|
| shared card-color module | Names, `CardColor` type, labels, validation, modifier helper |
| `etl/schema.ts` | Optional frontmatter enum and generated JSON schema |
| `etl/import.ts` | Copy validated color to the database mirror |
| `etl/frontmatter-write.ts` and `etl/export.ts` | Emit, update, or remove `color` |
| Supabase migration | Nullable `cards.color` with enum-like check constraint |
| `src/lib/types.ts` and `src/lib/board-data.ts` | Carry color into `Card` board data |
| board server actions | Validate color on create/edit and record the edit |
| reusable color picker | Accessible selection UI shared by create and edit surfaces |
| `CardItem` | Apply the palette modifier |
| theme and component CSS | Light/dark tint values and modifier rules |
| `docs/frontmatter.schema.json` | Regenerated public contract |

For edit history, changing or clearing color uses the existing `edited` event and includes a `color` key in its payload. History describes this as “changed the color” without exposing raw values unless the existing formatter explicitly supports a safe named value.

---

## Testing

Follow red-green-refactor for each behavior:

- shared contract accepts all nine names and rejects arbitrary strings;
- frontmatter validation accepts an allowed color, accepts omission, and rejects an unknown color;
- import maps a color and clears a stale mirror when frontmatter omits it;
- new-card Markdown includes a selected color and omits a null color;
- managed export changes and removes `color` without disturbing unrelated frontmatter;
- create and update actions reject invalid color input;
- card modifier mapping returns the expected class and returns no modifier for null;
- theme-discipline tests require all nine tokens in both themes;
- component or end-to-end coverage confirms a colored card receives its modifier and an uncolored card remains neutral;
- picker coverage verifies named options, selected state, keyboard use, and clearing.

Run focused tests during development, then `bun test` and `bun run check`. Run the board Playwright test when the local test environment is available.

---

## Error handling

- Invalid Markdown color: fail that import through the existing validation error path; do not silently substitute a color.
- Invalid server-action color: return the existing structured action error and perform no write.
- Missing color: valid and neutral.
- Unknown historical database value: render neutral defensively, while the database constraint prevents new invalid rows.
- Failed optimistic edit: show the existing board error and refresh canonical server state.

---

## Out of scope

Custom hex values, user-created palettes, gradients, automatic colors derived from tags or epics, filtering or sorting by color, coloring project/board listing tiles, changing foreground typography colors, bulk recoloring, and assigning a default tint.
