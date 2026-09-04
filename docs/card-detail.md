# Card detail chrome

The card page is one `.paper-card--static`. Do not nest a `.paper-lane` inside it — that is a box in a box and is what made the top feel off.

## Fields

Summary, ratings, dates, audience, Status, Assignee, and color sit in a labeled grid (`sm: 2 cols`, `lg: 3`) with the color picker on its own row beneath. Status is a native select of the tracker vocabulary (raw words: backlog, wip, …), first cell in the grid, saved through `updateCard`. Labels are 10px uppercase grey. Controls use `--surface-input` and `--color-ink` so native selects stay readable in both themes. Color uses the shared picker (`fieldset` of native buttons with `aria-pressed`); saves through `updateCard` while `pending` disables the swatches.

Assignee is a native select of the project roster (`BoardData.people`), saved through `assignCard`, which writes `assignee_id` and the `assignee` email in one patch so exported frontmatter mirrors it. A card whose file names somebody off the roster shows that email as a disabled selected option — editing another field never erases what the file says.

Epic / Area / Raised / Related is a hairline-ruled definition list with micro-caps labels, not a third nested card.

## Tags

`.stat` is for status — six pixels of pen colour and a word in mono caps, written in the margin. Tag names are sentence case and often long, so they are highlighter marks (`.mark`) instead.

Resting state shows **only assigned tags**, one row per group that has any. Empty groups (e.g. Step on a card with no step) are omitted. **Edit tags** expands the full catalog; **Done** collapses it again. Clicking a marked tag still un-marks it without entering edit.

| State | Treatment |
|---|---|
| Marked | `.mark mark--{n}` — the group's highlighter, `n` from `markHue(groupIndex)` |
| Unmarked | `.mark mark--off` — the same word under a pencil rule |

Hue belongs to the group, not the tag, so a tag is the same colour in the filter bar, on the board card, and here. Do not dump every tag in every group onto the card page. Do not use `text-primary` / `bg-primary/10` for selected tags.

## Links

Related card ids (`#118`) and other in-page jumps use `.paper-link` (`color: var(--pen-blue)`). Markdown links get the same pen via `--tw-prose-links` (see `docs/markdown-typography.md`).

## Body

Read by default (`.prose`, wiki-links as bold). **Edit** opens MDXEditor; **Save** writes `body_md` and stamps `body_edited_at`. **Cancel** discards the draft. Comments are not in the editor.

## Comments

Below the article. Each block is `### YYYY-MM-DD HH:mm · email` plus a blockquote in the file. The page shows timestamp, email, and rendered markdown. Append-only: textarea + **Post**. Empty Post shows “Write a comment first.” The first comment creates the `## Comments` fence; there is no empty-fence placeholder.

## History

Last on the page. One `.paper-card--static` already wraps the issue; do not nest a lane or a second card around the log.

Each `card_events` row is three columns: local clock in IBM Plex Mono (`28 Aug 02:28`, year only when it is not this year), kind as `.stat` (moved / restored / commented → `stat--info`, created → `stat--success`, everything else → `stat--muted`), then a sentence in Plex Sans: who, then what they did. Email local-parts are capitalised (`Joao`); `etl` stays `etl`. Facts are verbs, not field dumps — `set priority to P1`, `moved this from Now to Next`, `imported 156.md`, `changed the color`. Color edits never include the raw name (`blue`). Never `JSON.stringify` the payload. Empty copy is `Nothing recorded.` Cap 50, newest first.

The clock is Decision 3 local time. `"use client"` still SSRs in the server zone, so the list mount-gates: kind/actor/facts render immediately; `<time suppressHydrationWarning>` keeps the SSR clock until mount, then `formatCardEvent` (no `timeZone`) redraws in the browser zone.

The formatter lives in `src/lib/card-history.ts`. The full contract is `docs/superpowers/specs/2026-08-28-card-history-design.md`.
