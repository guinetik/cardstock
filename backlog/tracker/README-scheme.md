# Cardstock tracker — item scheme (2026-09-02)

The tracker feeds the `cardstock/cardstock-dev` board — the board app's own backlog. Its readers are the people who use the tool: Hap and Sanjay give the feedback, Joao builds it. Write every item so that the person who asked for it recognises their own request in it. The rules below are enforced by `backlog/validate_tracker.py` where they can be, and by review where they cannot.

This board was split out on 2026-09-02 so that feedback about the board tool stops landing on the client-delivery boards. See `delivery/designer/tracker/README-scheme.md` and `delivery/website/tracker/README-scheme.md` for its two siblings.

## Frontmatter

Required: `id`, `title`, `status`, `epic`, `area`, `tags`.

| Key | Rule |
|---|---|
| `summary` | One or two sentences in the asker's words: what this is and why it is on the list. No code identifiers, no internal component names. Required on every open item. |
| `technical_title` | The engineering title, kept verbatim when the title was rewritten for a reader. Optional. |
| `rank`, `priority`, `target`, `archived`, `archived_by` | Written by the board's export; do not edit by hand. |
| `effort` | Human-editable. `H`, `M` or `L`. |
| `lane` | Writable from either side: a drag on the board, or a new `lane:` here. `built` sits in `building`, `shipped` in `shipped`, `done` in Done. The validator enforces it. |

## Title

- At most 12 words, plain words, leads with what the person using the board sees or gets.
- No jargon. Implementation detail belongs in the body.
- Name the surface when it matters: "on the board", "on the project page", "in the new-card dialog".
- Good: *Cards do not show how old they are.* Bad: *Add createdAt delta badge to CardTile.*

## Epics — exactly one of these six

| Epic | Holds |
|---|---|
| `Board & cards` | the board itself: lanes, dragging, the card dialog, filters, search |
| `Planning & reporting` | Take Stock, the timeline, the calendar, epic roll-ups — anything that reads the board rather than edits it |
| `Data & round-trip` | download and import, the ETL, the markdown tracker sync, mappings |
| `Projects & access` | projects, boards, sign-in, membership, sharing a board with someone |
| `Platform & deploy` | Supabase, migrations, Vercel, performance, cost |
| `Docs & onboarding` | getting a new person productive on the tool without a call |

## Areas

`Platform` · `UI` · `Copy` · `Data`

## Tags — two groups, this vocabulary only

**Kind** — exactly one: `bug` · `enhancement` · `nice-to-have` · `question` · `internal`

**Surface** — at most one, where in the app it lives: `board` · `card` · `planning` · `timeline` · `calendar` · `project` · `import-export` · `sign-in` · `admin`

## Filing a new item

Cards are also created on the site, and the site numbers them `max id + 1` — the same rule an agent uses. Before creating `<id>.md`, run `py -3 backlog/sync.py --hosted --check` and use the `next-id` it prints. Never pick an id by listing the folder alone.

**A new card never starts at a gate.** However finished the code is, a card you create begins in `unsorted`, or in `now` if you are about to work it. Filing is not a promotion.

## Body

`## Ask` (immutable — what was asked, in the asker's words), `## Status` (overwritten, never appended), `## Rationale`, `## Evidence`, `## Residuals`.
