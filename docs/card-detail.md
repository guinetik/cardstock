# Card detail chrome

The card page is one `.glass-card--static`. Do not nest a `.glass-panel` inside it — that is a box in a box and is what made the top feel off.

## Fields

Summary, ratings, dates, and audience sit in a labeled grid (`sm: 2 cols`, `lg: 3`). Labels are 10px uppercase grey. Controls use `--surface-input` and `--color-ink` so native selects stay readable in both themes.

Epic / Area / Raised / Related is a hairline-divided definition list, not a third nested card.

## Tags

`.chip-status` is for status pills (uppercase, 10px). Tag names are sentence case and often long, so they use `.chip-tag` instead.

Resting state shows **only assigned tags**, one row per group that has any. Empty groups (e.g. Step on a card with no step) are omitted. **Edit tags** expands the full catalog; **Done** collapses it again. Clicking an assigned chip still removes it without entering edit.

| State | Surface | Ink |
|---|---|---|
| Off | `--fill-badge` / `--border-hairline` | `--color-ink2` |
| On | `--fill-chip-info` / `--color-brand` border | `--color-ink-strong` |

Do not dump every tag in every group onto the card page. Do not use `text-primary` / `bg-primary/10` for selected tags.

## Links

Related card ids (`#118`) and other in-page jumps use `.glass-link` (`color: var(--color-brand)`). Markdown links get the same brand via `--tw-prose-links` (see `docs/glass-typography.md`).
