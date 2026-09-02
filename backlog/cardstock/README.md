# Cardstock dev board — who owns which field

The board is hosted (repo `guinetik/cardstock`, project `cardstock`, board `cardstock-dev`); `tracker/*.md` is the markdown side of the same data. This directory holds everything board-specific: `seed.cardstock.sql` (project, board, lanes, tag groups) and `mapping.json` (tag overrides, audience rule).

This is the app's own backlog. It is deliberately a separate project from `staffeto`, so that feedback about the board tool never lands in a client-delivery board. Item ids are unique per board: `#1` here is not `#1` on the designer board.

## Commands

Run them from the repo root, and deliberately — `sync.py` rewrites tracker files.

```bash
py -3 backlog/sync.py --hosted --check     # writes nothing
py -3 backlog/sync.py --hosted             # import, then export
py -3 backlog/sync.py --hosted --seed      # apply lanes and tag groups
py -3 backlog/validate_tracker.py          # scheme rules
```

## Concurrent edits: agents and the board

The two sides own different fields, so they do not collide.

| Field | Import writes | Export writes | Owner |
| --- | --- | --- | --- |
| title, body, status, epic, area, dates, `needs`, tags | always | never | markdown |
| `lane`, `rank` | only on a status pin | always | board |
| `priority`, `effort` | only into a null | always | board |
| `target`, `archived` | never | always | board |
| `summary` | only while unedited in the app | never | markdown, then the app |

A comment or a body edit made in the app sets `body_edited_at`; from then on the import ignores that file's body and the export overwrites it. Check with `--check --item <id>`, which prints `body-owner`.

## Lanes

Cardstock is its own product, not a Staffeto client delivery, so it carries no four-gate gauntlet. There is no Sanjay's machine and no staging tier between a laptop and Vercel, so `building` is the single pre-release lane and `shipped` means it is live.

A new card never starts at a lane that implies work has begun. File into `unsorted`, or `now` only if it is being worked immediately.
