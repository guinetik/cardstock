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

**Pen** — `oklch(0.50 0.15 h)` — is what the app recorded: priority, effort,
status, links. It appears as a filled `.sq` (P1 red, P2 blue, P3 violet;
effort L green, M amber, H red) or as a `.stat` — six pixels of colour and a
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

2px is the whole radius scale. Elevation is four heights — flat in the well,
`--shadow-card` resting, `--shadow-lift` pointed at, pinned, or under a dialog,
and `--shadow-hand` for the card being dragged, clear of the board — all of them
contact shadows, never a glow. The dragged card (`.paper-card--overlay`) is the
only thing in the product allowed to rotate.

Paper does not bounce, and the springy easing and the 0.985 press-scale are
gone. A press is a 1px settle (`--motion-press-y`). Pointing at a card lifts it
out of the lane towards you: it rises `--motion-rise` and foreshortens by
`--motion-swell` while the shadow deepens to `--shadow-lift`. That is
perspective, not a spring — a sheet nearer the eye is a larger sheet. Page-scale
sheets (`.paper-card--static`) and the drag ghost opt out, and
`prefers-reduced-motion` drops the movement entirely.

Two easings, and the difference matters. `--motion-ease-out` is for things that
only change colour or depth. Anything that changes **size or place** — a lane
collapsing, a card opening — uses `--motion-ease-settle`, because
`--motion-ease-out` puts four fifths of the distance in the first fifth of the
time and reads as a jump however long you make it.

A card waits `--motion-dwell` (180ms) before opening, so brushing past a lane
does not set off a row of expansions; leaving closes it immediately, with no
delay. `.card-rest` collapses on the same delay and the same duration (a
`grid-template-rows` transition, like the peek), so the card sits neither blank
while the peek waits nor shorter while it grows.

Board cards sit in a 3px horizontal gutter (`SortableCard`) so the swell has
somewhere to grow. Without it a hovered card outgrows the lane's scroll
container and the lane scrolls sideways — and the container cannot simply clip,
because clipping would cut the lift shadow off at the sides.

## The folder

A project is drawn as a dossier (the GoldenEye mission-briefing folder is the
reference). On the projects page each one is a `.folder` taking a full row:
manila stock (`--surface-well`) whose single `.folder-tab` is the project's
name, and the way in. Inside the folder the boards are `.binder`s laid side by
side — a riveted spine of the folder's stock, the board's name on the cover,
its card count, and *Take stock*, which is the epic cockpit. The margin of
the folder holds a `.folder-stamp` with the card count, in pen red, the one
tilted thing on the page besides a dragged card. Nothing is written twice:
the tab names the project, the binders name the boards.

The project page is the same folder laid open (`.folder--open`): the tab is
the title, and inside it each board is a wide `.binder` carrying the tally of
its lanes as `.stat`s in the lane kind's pen, with *Take stock* (the cockpit)
and *Export CSV* on its foot. Under the folder sits the **roster binder**
(`.roster`): who can open this folder, each person a full-width `.roster-slip`
with the name as a tab, the address in mono, and the role in the margin. The
last row is blank stock — that is how an owner invites someone. Below that
the board's tag groups are drawn as a **concept graph** (`.graph`): each group
is a `.graph-node` wearing its highlighter on its spine, and the tags branch
from it along a ruled trunk as `.mark`s — a concept contains its tags, so the
edges are lines, not arrows. The page ends with the two big asks, same shape
and opposite pens: `.cta` to take the project home as markdown, `.danger` to
delete it.

## Lanes

The header is the divider tab, and the rule under the name says what kind of
lane it is: ink for work, a hairline for the quiet ones, the amber pen for
anything waiting (`KIND_RULE` in `lane-column.tsx`).

The inbox is a **drawer** — `.paper-lane--drawer`, sunken stock with an inset
edge — and its cards are slips, not filed sheets: `.paper-card--flat`, flush and
hairline-separated, lifting only under the pointer. An in-tray is emptied, not
read.

Collapsed, a lane becomes `.lane-spine`: its own tab edge, name turned on its
side, count at the foot, still a drop target. Both states are the same
`<section>` so the width animates; swapping elements made the board snap.

## Spring-loaded lanes — built, switched off

`COLLAPSE_LANES_ON_DRAG` in `board-view.tsx` is `false`. Everything below it
works; flip the constant to bring it back.

The idea: while a card is in hand the binder is held open at one tab. On pickup
every lane but the one the card came from collapses to a spine, so no drop
target is off-screen and nobody scrolls sideways with the mouse button down.
Dwell over a spine for `SPRING_MS` (450ms) and that lane springs open, the way a
Finder folder does, so a card can be **filed and ranked in one drag** instead of
two. The dwell is what makes it bearable — crossing lanes on the way somewhere
does not open them. Only one lane is sprung at a time; leaving the board closes
it after `SPRING_LEAVE_MS` so a wobble at a lane's edge does not slam it shut
mid-aim.

**Why it is off:** collapsing the whole board the moment a card leaves the
ground is more disorienting than the scrolling it saves. The idea may be worth
another shape — springing a lane open *without* collapsing the rest, say.

Two pieces of it stay switched on because they are right either way: lane width
transitions rather than snapping (both lane states are one `<section>`), and
`DndContext` runs `MeasuringStrategy.Always`, since dnd-kit otherwise measures
droppable rects once at drag start and any mid-drag layout change drops cards
into the lane that *used* to be under the pointer.
