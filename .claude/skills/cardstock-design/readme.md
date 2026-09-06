# cardstock — the fichário

*The zen of project management. On paper.*

cardstock is an open-source, self-hosted kanban board that sits over a
markdown tracker. A team keeps writing one `.md` file per work item — by hand
or with agents — an ETL brings those sheets in, the board owns the review's
decisions (lane, rank, priority, effort, target, archive), and a later export
writes those decisions back into the files. *Markdown owns the narrative; the
app owns the margin.*

Its design system is called **Paper**, and it is the product's fable drawn
literally. A binder holds sheets, not panes: **nothing is translucent, nothing
is blurred, nothing is round.** Surfaces are stock, text is ink, borders are
ruled lines, elevation is one sheet resting on another.

## Sources this system was built from

Everything here was read out of the codebase, not reconstructed from
screenshots.

| Source | What was taken from it |
|---|---|
| `cardstock/` (attached local codebase, Next.js 16 / React 19 / Tailwind 4 + shadcn) | Everything below |
| `docs/paper.md` | The design system's own charter — stock, pen and highlighter, type, lanes, motion, the folder |
| `docs/fichario.md` | The fable: the *fichário*, why the product is called cardstock, what the name decides |
| `src/styles/themes/tokens.css` | The token contract (every name both themes must answer, exactly) |
| `src/styles/themes/paper.css`, `paper-night.css` | The two themes, verbatim |
| `src/styles/components/paper.css` (2 786 lines) | The component vocabulary: `.paper-card`, `.paper-lane`, `.mark`, `.sq`, `.stat`, `.folder`, `.binder`, `.lane-map`, `.graph`, `.calendar-*`, `.cockpit-epic` |
| `src/app/globals.css`, `src/app/layout.tsx` | Font stacks, the shadcn aliases, the topbar and its wordmark |
| `src/components/board/*`, `src/components/cockpit/*`, `src/components/binder.tsx`, `src/lib/types.ts`, `card-color.ts`, `card-status.ts` | Component structure, the pen/mark mappings, the status and colour vocabularies |
| `src/app/**` (`page.tsx`, `p/[project]`, `b/[board]`, `login`) | The five screens in the UI kit |
| `supabase/seed.sql`, `examples/tracker/*.md` | The demo project, lanes, tag groups and cards used as sample content |
| `node_modules/lucide-react@1.34.0` | The icon set, lifted verbatim (see Iconography) |
| `screenshots/board.png`, `timeline.png`, `peek-*.png` | Cross-checked against the recreations only |

The repo also links a design canvas at
`https://claude.ai/code/artifact/38e8cf5e-ba74-44fc-a593-8342b5a9f72b`
(referenced in `docs/paper.md`); it was not accessible from here.

**There is no logo.** The source ships no mark, monogram or symbol — only a
`favicon.ico` and Next.js's own boilerplate SVGs. Wherever a mark would go,
the product sets the word **cardstock** in Newsreader 600, lowercase. Nothing
was invented to fill the gap. See `guidelines/brand-wordmark.html`.

---

## Content fundamentals

The voice is a **product engineer explaining a decision to a colleague** — and
it is unusually distinctive, so copy this closely.

**Sentence case, always.** Headings, buttons, lane names in prose, dialog
titles: "Add lane", "Export CSV", "Take the folder home", "Needs attention".
The only uppercase is *structural* — mono caps in the margin (`FORGOTTEN`,
`DATES`, `13 CARDS FILED`) and lane names on the board (`NICE-TO-HAVE`), where
capitals are a typographic device, not emphasis.

**The metaphor is load-bearing, not decoration.** Copy uses the paper words as
the real names of things: a card is a *sheet*, a project is a *folder*, a board
is a *binder*, the tracker in git is *the folder at home*, the decisions are
*the margin*. Section headings in the docs are literally *Stock*, *Pen and
highlighter*, *Edges, lift, motion*, *The folder*.

**Prefer the concrete consequence to the abstract benefit.** Not "improves
visibility" but *"a board they can open at two in the morning."* Not
"configurable" but *"lane names are yours."*

**Reasons, not rules.** Almost every statement carries its own because:

> "Every lane paints its own stock. An empty lane has to read as a place to
> put something, never as a hole in the page — that was the failure of the
> translucent `--surface-panel` the glass skin shipped."

> "Red comes last so a red mark stays rare enough to mean something."

**Second person for the user, first person plural for the team, and the user's
own words in quotes.** The spec quotes the product owner verbatim and treats
it as evidence: *"I'll categorize them 1, 2, or 3"*, *"the oldest stuff is the
hardest for me to prioritize"*, *"as long as I can slice it and dice it"*,
*"if I say get rid of it, just get rid of it"*. When a feature exists because
someone asked for it, say who and quote them.

**Say what is not built, plainly.** "Resetting a forgotten password is not
built yet — it needs mail." "Spring-loaded lanes — built, switched off."
"Attachments: schema now, UI in v1.1." No roadmap hedging, no "coming soon".

**Field help is written as an example, not a description.** Placeholders read
`a person, a decision, another team`, `or a rough date — end of Q3`,
`you@company.com`, `Search #id or title`.

**Em dashes and colons do the joining; sentences run long and land hard.**
"The sheet is the unit. The binder is just what you carry it in."

**Never:** emoji (there are none in the entire codebase — not in UI, docs or
commit-facing text), exclamation marks, "simply", "just works", "powerful",
"seamless", "delight", title-case buttons, or a word ending in a bang.

**Numbers are written in mono and read as facts:** `13 open · 3 unsorted`,
`34 days since raised · no target`, `2 of 5 delivered · 1 blocked`.

---

## Visual foundations

### Stock — the five papers

Five surfaces in a **fixed stacking order**, and the order is the point:

    page   #f2eee6   the desk
    lane   #ebe7dd   a column of stock laid on it
    card   #fcfbf8   a sheet on the lane
    well   #dcd5c3   cut *into* the desk (the inbox drawer, a lane spine)
    raised #ffffff   fields and menus

Warm neutrals throughout — no cool greys anywhere. Every lane paints its own
opaque background so an empty lane still reads as a place to put something.
Nine pastel tints (`--surface-card-rose` … `-pink`) can override a card's or a
lane's stock; a tint is **paper, not a pen** — it carries no meaning about
priority or state.

### Colour — pen and highlighter, never both

One hue wheel, two lightnesses, and the discipline is absolute:

- **Pen** — `oklch(0.50 0.15 h)` — is what the *app* recorded: priority,
  effort, status, links. It appears as a filled `.sq` square (P1 red, P2 blue,
  P3 violet; effort L green, M amber, H red) or as a `.stat` — six pixels of
  colour and a word in mono caps, written in the margin. **Never a filled
  pill.**
- **Highlighter** — `oklch(0.91 0.12 h / 0.6)`, `mix-blend-mode: multiply`
  over the stock — is the *reader's* own hand, and it is used for **tags and
  nothing else**. Hue belongs to the tag *group*, in board order: amber, blue,
  green, violet, red — red last so a red mark stays rare enough to mean
  something.

Mixing the two is what makes a board look decorated instead of worked. The
primary action is **ink**, not a colour; pen blue is for links and P2 only.

### Type

Three families, each with a job:

- **Newsreader** (serif) — the printed page. **Titles only**; `h1`–`h3` pick
  it up. Weight 500, tracking −0.012em, leading 1.15.
- **IBM Plex Sans** — the hand that fills a form. Controls, card copy, labels.
- **IBM Plex Mono** — whatever the *machine* assigned: `#ids`, ranks, dates,
  keys, counts. Mono is a claim about authorship.

Sizes are written in px at half-pixel precision where a row needed it —
13.5px, 11.5px, 10.5px, 9.5px. **Do not round them to a 4px grid.** The margin
hands are all mono caps tracked wide: `.eyebrow` 10px/0.11em, `.field-label`
9.5px/0.11em, `.stat` 10px/0.09em, `.lane-name` 20px/0.06em uppercase,
`.folder-stamp` 11px/0.16em.

### Edges and shadow

**2px is the whole radius scale** — `--radius-card`, `--radius-btn`,
`--radius-input` are all 2px. Paper is cut, not moulded. Drawer slips are 0.
A build test (`theme-discipline.test.ts`) fails if a theme grows a radius past
2px or reintroduces a blur.

The **only round thing in the product** is a colour swatch in the tint
picker — it is an ink well, not paper.

Elevation is four heights, all **contact shadows, never a glow**:

| | |
|---|---|
| (none) | flat in the well |
| `--shadow-card` | a sheet resting on the lane |
| `--shadow-lift` | pointed at, pinned, or under a dialog |
| `--shadow-hand` | the card in hand, clear of the board |
| `--shadow-well` | the one inset — stock cut *into* the desk |

Borders are ruled lines: `--border-hairline` for a resting edge,
`--border-strong` when pointed at, a 2px ink rule under a work lane's name, an
amber rule under a waiting one, dashed for anything empty or destructive.

### Motion

**Paper does not bounce.** There is no spring easing and no press-scale.

- **Hover** — a card comes *out of the lane towards you*: it rises
  `--motion-rise` (−2px) and foreshortens by `--motion-swell` (1.012) while
  the shadow deepens to `--shadow-lift`. That is perspective, not a spring: a
  sheet nearer the eye is a larger sheet.
- **Press** — a 1px settle (`--motion-press-y`). Nothing shrinks.
- **Dwell** — a card waits `--motion-dwell` (450ms) before opening its back,
  so brushing past a lane does not set off a row of expansions. Leaving closes
  it immediately, with no delay.
- **Two easings, and the difference matters.** `--motion-ease-out`
  `cubic-bezier(.32,.72,0,1)` is for things that only change colour or depth.
  Anything that changes **size or place** uses `--motion-ease-settle`
  `cubic-bezier(.4,0,.2,1)`, because `--motion-ease-out` puts four fifths of
  the distance in the first fifth of the time and reads as a jump however long
  you make it.
- `prefers-reduced-motion` drops the movement entirely.

### Rotation, and its budget

Rotation is rationed, because it is what makes paper read as handled:

- a **dragged card** rotates −0.7deg (`.paper-card--overlay`) — the only
  rotation in the product proper;
- a **stamp** sits at −4deg, a **"you" chip** at −6deg;
- **highlighter marks** are a fraction of a degree off level (−0.4deg) and
  consecutive marks alternate tilt so a row never looks stamped;
- **post-it stubs** take a hand-placed `--slip-tilt` in the −2…2deg range;
- **masking-tape weekday labels** alternate −0.8/0.6/−0.3deg;
- a **tooltip** is a note clipped on at −0.65deg.

One stamp per page. A second stamp costs the first its meaning.

### Transparency and blur

**There is none.** No `backdrop-filter` anywhere — a dialog scrim is a flat
`--scrim` wash and the dialog itself is a sheet laid on the desk, not frosted
glass over it. The only alpha in the system is the highlighter (which is
*supposed* to read as translucent ink), the faintest hover fills
(`--fill-subtle` at 9%), and the masking-tape strip. A translucent
`--surface-panel` shipped once in a "glass skin" and was removed by name,
because an empty lane read as a hole in the page.

### Cards, lanes and containers

A card is: `--surface-card`, a 1px hairline border, 2px corners,
`--shadow-card`, 10px padding. Resting, it shows `#id`, the title at 18px/500,
its epic, its status word, the raised date with an age gauge, and its P/effort
squares. The **back of the card** — a filled-in form with a 3.25rem label
gutter in the margin — opens on hover after the dwell, and the resting row
steps aside on the same clock so the card is never blank.

A lane is a column of `--surface-panel` with a hairline edge and a divider-tab
header; the inbox is the one lane cut *into* the desk (`--surface-well` plus an
inset shadow) and its cards are flush, hairline-separated slips, not filed
sheets. Collapsed, a lane becomes its own tab edge with the name turned on its
side — and stays a drop target.

Bigger structures are drawn as real objects: a project is a **manila folder**
with one tab; a board is a **riveted binder**; an epic is a **closed tome**
with cloth spine and a page block showing past the cover; the calendar month
is a **speckled corkboard** of pinned white day sheets and canary post-its; a
tag taxonomy is a **ruled concept graph**.

### Imagery

The product ships **no photography and no illustration** — the surfaces are
the imagery. Portraits are the only pictures, and they are **square with a
1.5px strong edge, never circles**. If you need a picture, use a paper
texture, a real screenshot, or nothing.

### Layout

Fixed elements: a 3rem topbar (`--topbar-height`) and a sticky filter bar
under it; a pinned lane can hold the left edge while the board scrolls beneath
it. Page-scale views are centred at `--page-max` (64rem) with a 1.5rem gutter;
the board is full-bleed and scrolls horizontally. A lane is
`clamp(280px, 22vw, 420px)`, and board cards sit in a 3px horizontal gutter so
the hover swell has somewhere to grow.

---

## Iconography

**One set: Lucide, at 2px stroke.** The app imports it from `lucide-react`
(v1.34.0, pinned in `bun.lock`); this design system carries the **same
geometry lifted verbatim** from that package — no substitution, no redrawing.

- `components/icon/Icon.jsx` holds the node table and renders inline SVG, so a
  glyph never flashes, never needs a network, and always inherits the ink of
  the text beside it (`stroke="currentColor"`).
- The same 31 glyphs are on disk as `assets/icons/<name>.svg`.
- The set is **exactly what the app uses and no more**: `arrow-left`,
  `arrow-right`, `book`, `calendar-clock`, `check`, `chevron-down`,
  `chevron-left`, `chevron-right`, `chevron-up`, `columns-3`, `download`,
  `ellipsis` (alias `more-horizontal`), `flag`, `gauge`, `grip-vertical`,
  `inbox`, `maximize-2`, `minus`, `moon`, `paperclip`, `palette`, `pencil`,
  `pin`, `pin-off`, `plus`, `rocket`, `settings`, `sun`, `trash-2`, `upload`,
  `x`. Need another? Take it from Lucide.
- Sizes in use: **13** on card chrome, **14** in toolbars and binder keys,
  **18** where a glyph stands alone.
- An icon is never a coloured badge of its own; it takes the ink of its
  context (grey in chrome, `--pen-red` on a forgotten card).

**No icon font, no sprite sheet, no PNG icons.** **No emoji** — there are none
anywhere in the codebase. Unicode is used only as *marks*, never as
iconography: the task-cabin glyphs `✓ ! ◷ →` on a lane-microcosm slip, the
arrow in "Open project →", `·` as a separator, and `#` as a literal id prefix.

---

## Index

| Path | What |
|---|---|
| `readme.md` | This file — context, content fundamentals, visual foundations, iconography |
| `SKILL.md` | Agent-Skills front matter, for using this system in Claude Code |
| `styles.css` | The one stylesheet a consumer links; `@import`s only |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `motion.css`, `semantic.css`, `theme-night.css` |
| `styles/base.css` | Page defaults, lifted from the app's `@layer base` |
| `styles/paper.css` | The brand's component classes, lifted from `src/styles/components/paper.css` |
| `guidelines/*.html` | 18 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `assets/icons/*.svg` | The 31-glyph Lucide set, as files |
| `refs/*.png` | The app's own screenshots, kept for cross-reference |
| `ui_kits/app/` | Click-through recreation of the product — see its README |
| `thumbnail.html` | The homepage tile |

### Components

Grouped by concern; each has a `.d.ts` props contract and a `.prompt.md`
usage note beside it.

**`components/icon/`** — `Icon`

**`components/marks/`** — `Stat`, `Mark`, `Sq`, `Stamp`, `Eyebrow`,
`EpicLabel`

**`components/stock/`** — `PaperCard`, `PaperLane`, `LaneHead`, `PaperWell`,
`PaperTopbar`

**`components/forms/`** — `PaperButton`, `BinderTool`, `PaperField`,
`Fieldset`, `FieldLabel`, `PaperLink`, `ColorPicker`

**`components/filing/`** — `Folder`, `Binder`, `LaneMap`, `Letterhead`,
`Portrait`, `PaperTooltip`

**`components/board/`** — `BoardCard`, `EpicTome`, `CalendarSlip`

Also exported: `MARK_HUES` / `markHue()`, `PRIORITY_PEN`, `EFFORT_PEN`,
`STATUS_TONE`, `LANE_INK`, `CARD_COLORS`, `LUCIDE_NODES`.

### Intentional additions

The source defines its vocabulary in CSS classes rather than React primitives,
so these are wrappers over classes that already exist — no new design:

- **`BoardCard`** wraps the card face that `src/components/board/card-item.tsx`
  builds inline, so a consumer gets the resting/peek behaviour for free.
- **`PaperButton` / `BinderTool`** wrap `.paper-btn`, `.cta-button` and
  `.binder-tool`; the app reaches shadcn's `Button` for the same job.
- **`Fieldset` / `FieldLabel` / `PaperField`** wrap the printed-form classes.
- **`LaneMap`, `Folder`, `Binder`, `Letterhead`, `EpicTome`, `CalendarSlip`,
  `PaperTooltip`, `Portrait`** wrap page structures the app assembles inline.
- **`tokens/spacing.css`** names the rem steps the app takes from Tailwind;
  cardstock has no spacing token file of its own.

### Themes

Daylight (`Paper`) is the default and lives on plain `:root`. Night is
`:root[data-theme="paper-night"]` — the same desk under a lamp, warm graphite
rather than blue-black, and the highlighter drops its multiply blend because a
marker over a dark page reads as a wash of the same hue rather than a
darkening of it. Both themes must answer the token contract exactly: no more
names, no fewer.
