# Project page — letterhead and section folders

**Date:** 2026-08-29
**Status:** approved in conversation; implementation follows this document.
**Scope:** `/p/[project]` layout and Paper chrome. No query, action, or invite-flow changes. Home-page project folders (`.folder` on `/`) do not change.

---

## The problem

The project page already has distinct chapters — boards, people, concepts, export/delete — but they do not share a frame. Boards live inside one open dossier, people are a lone binder underneath, concepts use a generic `.section-head`, and the two asks are full-bleed `.cta` / `.danger` heroes. The page does not read as one desk of files.

## What we're building

The project is a **letterhead**, then a **stack of section folders**. Each chapter is its own manila folder with a quiet tab. The home page still uses `.folder` for a project; the project page no longer does.

Out of scope: wiring Download .zip, wiring Delete this project, changing invite/remove behaviour, changing taxonomy editor internals, changing board binder contents, new theme tokens.

---

## Decisions taken

1. **Letterhead, not a wrapping folder.** Newsreader title, blurb, stats, and the stamp sit above the stack. The project name is not a folder tab.
2. **Each chapter is a folder.** Boards, People, Concepts, Settings — same metaphor, same tab-and-body, quieter than a project folder.
3. **Concepts is its own folder.** Not nested under a board binder, not dropped.
4. **Settings holds both asks.** Take-home as a normal row; delete as a danger slip at the foot, opposite pens, same folder.
5. **Binders are only for boards.** People drops the extra binder chrome. The folder is the cover; slips sit on its stock.
6. **The stamp is written once.** Card-count seal lives on the letterhead only. Boards’ aside is Create board.

---

## Page frame

```
← Projects

{name}                                              ┌──────────┐
{description or "No description."}                  │ N CARDS  │
N boards · N cards · N from .md files               │  filed   │
                                                    └──────────┘

┌ boards · N ─────────────────────────────────────────────────┐
│ binders…                                        [New board] │
├ people · N ─────────────────────────────────────────────────┤
│ slips…                                                      │
├ concepts ───────────────────────────────────────────────────┤
│ graphs…                                                     │
├ settings ───────────────────────────────────────────────────┤
│ take home                                                   │
│ ─ delete ─                                                  │
```

Stack order is Boards, People, Concepts, Settings.

- **Concepts omits itself** when the project has no boards (nothing to graph).
- **Boards and People always render**, including empty bodies. An empty folder is a place to put something.
- **Settings always renders.**

---

## Letterhead

Not a `.folder`. New `.letterhead` block on the existing `max-w-5xl` page.

| Piece | Treatment |
|---|---|
| Back link | Existing `← Projects` eyebrow, unchanged |
| Title | `h1`, Newsreader, project name |
| Blurb | Existing `.folder-blurb` (or equivalent): description, or grey “No description.” |
| Stats | Existing `.stat`s: board count, card count, optional “N from .md files” |
| Stamp | Existing `.folder-stamp` in the right margin. Same copy: “N cards filed” or faint “nothing filed”. Pen red, tilted. The only card-count seal on the page |

On small screens the stamp drops under the stats, same as today’s folder aside.

---

## Section folder

New modifier `.folder.folder--section`. Reuses manila stock, tab sitting on the body, hairline border, contact shadow.

The tab is **not a link**. It does not pull the folder up on hover. Home-page `.folder` hover-lift stays as it is.

| | Project folder (`/` ) | Section folder (`/p/[project]`) |
|---|---|---|
| Tab type | Newsreader, uppercase, project name, link | IBM Plex, sentence case, chapter name, not a link |
| Tab extra | — | Optional mono count, sibling of the heading |
| Heading | (none on the closed row; the tab *is* the name) | `h2` whose accessible name is exactly `boards`, `people`, `concepts`, or `settings` |
| Empty | `.folder--empty` dashed body | Boards uses `.folder--empty` when there are no boards |

**Tab copy (visible):** the `h2` word, then a middot, then the count in mono, e.g. `boards · 2`. The middot and count are **not** inside the `h2`, so the accessible name stays the single word.

**Counts on the tab:**

- Boards: board count (`2`, not “2 boards” — the word is already the heading)
- People: person count
- Concepts: no count (group cardinality is per-board and noisy)
- Settings: no count

`.folder--open` is removed from the project page and from CSS once unused. `.section-head` is removed from the project page and from CSS once unused.

No new theme tokens. `theme-discipline` stays green without a contract change.

---

## Inside each folder

### Boards

Wide binders unchanged: name, slug, lane tally, *Take stock*, *Export CSV*.

Create-board control moves to this folder’s aside (the margin that used to hold the stamp).

Empty body keeps the existing sentence about default lanes (Unsorted, Now, Next, Done, Archive).

### People

`ProjectPeople` no longer renders `binder binder--wide roster` or an inner “People” heading / count. It renders the slip list and the owner invite slip into the section body.

Slips stay as they are: name as a tab, email in mono, role in the margin, *Remove* for the owner (not self). Last row is the blank invite when `canInvite`.

### Concepts

`TaxonomyEditor` unchanged. One graph per board. When the project has more than one board, a small Plex label above each graph names the board. No `.section-head`.

### Settings

Not full-bleed heroes. Two slips on the folder stock:

1. **Take-home** — existing title “Take this project home”, existing body copy, disabled *Download .zip*, note “Coming soon”.
2. **Delete** — hairline rule above it. Existing title “Danger zone”, existing body copy, disabled *Delete this project*, note “Owners only · coming soon”. Danger pen on the title and button, same as today’s `.danger`.

Reuse `.cta` / `.danger` markup (title, body, button, note). Under `.folder--section` they are internal rows: no extra outer margin that separates them from the folder, hairline rule only above `.danger`. Do not leave them as page-width heroes. No new tokens.

Copy does not change. Buttons stay disabled.

---

## Components

| Unit | Job |
|---|---|
| `ProjectSection` (`src/app/p/[project]/project-section.tsx`) | Renders one `.folder--section`: tab (`h2` + optional count), body, optional aside. Used four times. TSDoc on the export. |
| Project page (`page.tsx`) | Letterhead + four sections. Same data loading as today. |
| `ProjectPeople` | Slips + invite only. No binder shell, no heading. |
| `TaxonomyEditor`, `CreateBoardDialog`, `InviteUserForm` | Unchanged |

Letterhead is inline on the page (used once).

---

## Tests and docs

- `e2e/management.spec.ts`: project-page invite test still finds heading `people` (Playwright name match is case-insensitive). Invite and remove still work on `/p/demo`. Extend the test (or add a sibling) so the four section headings `boards`, `people`, `concepts`, `settings` are visible on `/p/demo`, and “Take this project home” / “Danger zone” are visible.
- `docs/paper.md`: replace the open-dossier paragraph. The project page is a letterhead plus section folders; binders live only in Boards; the roster is slips in People; the graph lives in Concepts; the two asks live in Settings.
- `docs/project-members.md`: the roster is slips in the People folder, not a binder under the project.

---

## Non-goals

- Do not restyle `/` project rows.
- Do not add tokens, radii, blur, or motion beyond existing Paper easings.
- Do not implement zip download or project delete.
- Do not move concepts onto the board settings route.
