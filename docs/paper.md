# Paper — the cardstock design system

A binder holds sheets, not panes. Nothing is translucent, nothing is blurred,
nothing is round. Surfaces are **stock**, text is **ink**, borders are **ruled
lines**, elevation is one sheet resting on another.

Canvas (screens, tokens, components, affordances):
<https://claude.ai/code/artifact/38e8cf5e-ba74-44fc-a593-8342b5a9f72b>

## Where it lives

| File | What |
|---|---|
| `src/styles/themes/tokens.css` | The token contract, as a comment. Both themes must answer it exactly. |
| `src/styles/themes/paper.css` | `:root[data-theme="paper"]` — daylight. |
| `src/styles/themes/paper-night.css` | `:root[data-theme="paper-night"]` — the same desk under a lamp. |
| `src/styles/components/paper.css` | `.paper-card`, `.paper-lane`, `.paper-topbar`, `.stat`, `.mark`, `.sq`, `.lane-head`. |
| `src/app/globals.css` | Font stacks and the shadcn variable aliases. |
| `src/lib/theme.ts` | Resolves `"paper"` / `"paper-night"`; never adds a `.dark` class. |

`src/styles/themes/theme-discipline.test.ts` fails the build if a theme drops a
token, gains one, reintroduces a blur, or grows a radius past 2px.

## Stock

Five papers in a fixed stacking order, and the order is the point:

    page   #f2eee6   the desk
    lane   #ebe7dd   a column of stock laid on it     --surface-panel
    card   #fcfbf8   a sheet on the lane              --surface-card
    well   #dcd5c3   cut *into* the desk              --surface-well
    raised #ffffff   fields and menus

Every lane paints its own stock. An empty lane has to read as a place to put
something, never as a hole in the page — that was the failure of the translucent
`--surface-panel` the glass skin shipped.

## Pen and highlighter

One hue wheel, two lightnesses.

**Pen** — `oklch(0.50 0.15 h)` — is what the app recorded: priority, difficulty,
status, links. It appears as a filled `.sq` (P1 red, P2 blue, P3 violet;
difficulty L green, M amber, H red) or as a `.stat` — six pixels of colour and a
word in mono caps, written in the margin. Never a filled pill.

**Highlighter** — `oklch(0.91 0.12 h / 0.6)`, multiplied over the stock — is the
reader's own hand, and it is used for **tags and nothing else**. A `.mark` is a
swipe: no border, no radius, uneven ends, a fraction of a degree off level, and
consecutive marks alternate their tilt so a row never looks stamped. An
unassigned tag is `.mark--off`, the same word under a pencil rule.

Hue belongs to the tag **group**, in board order, via `markHue()` in
`src/lib/types.ts` — so Billing is the same yellow in the filter bar, on the
card, and on the card page. The order is amber, blue, green, violet, red: red
comes last so a red mark stays rare enough to mean something.

Mixing the two is what makes a board look decorated instead of worked.

## Type

Three families, each with a job, loaded through `next/font/google` in
`app/layout.tsx`:

- **Newsreader** — the printed page. Titles only (`h1`–`h3` pick it up).
- **IBM Plex Sans** — the hand that fills a form. Controls, card copy, labels.
- **IBM Plex Mono** — whatever the machine assigned: `#ids`, ranks, dates, keys.

## Edges, lift, motion

2px is the whole radius scale. Elevation is three heights — flat in the well,
`--shadow-card` resting, `--shadow-lift` in hand or under a dialog — all of them
contact shadows, never a glow. The dragged card (`.paper-card--overlay`) is the
only thing in the product allowed to rotate.

Paper does not bounce, and the springy easing and the 0.985 press-scale are
gone. A press is a 1px settle (`--motion-press-y`). Pointing at a card lifts it
out of the lane towards you: it rises `--motion-rise` and foreshortens by
`--motion-swell` while the shadow deepens to `--shadow-lift`. That is
perspective, not a spring — a sheet nearer the eye is a larger sheet. Page-scale
sheets (`.paper-card--static`) and the drag ghost opt out, and
`prefers-reduced-motion` drops the movement entirely.

## Lanes

The header is the divider tab, and the rule under the name says what kind of
lane it is: ink for work, a hairline for the quiet ones, the amber pen for
anything waiting (`KIND_RULE` in `lane-column.tsx`).

The inbox is a **drawer** — `.paper-lane--drawer`, sunken stock with an inset
edge — and its cards are slips, not filed sheets: `.paper-card--flat`, flush and
hairline-separated, lifting only under the pointer. An in-tray is emptied, not
read.

Collapsed, a lane becomes `.lane-spine`: its own tab edge, name turned on its
side, count at the foot, still a drop target.
