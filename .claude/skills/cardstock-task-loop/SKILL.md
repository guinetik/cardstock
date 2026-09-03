---
name: cardstock-task-loop
description: Use when an operator points you at a backlog tracker item to work on in this repo. Covers the full loop - claim the item into the Now lane, sync and commit an opening fingerprint, do the work, then move it to Building only once it is genuinely done, and never mark it Shipped or Done without the operator's confirmation. Triggers on "work on #N", "pick up tracker item", "take this backlog task", or any request to move a tracker item through the board.
---

# Cardstock task loop

The loop that carries one cardstock backlog item from claimed to shipped, keeping the markdown tracker files, the cardstock board and git history in agreement at every step.

The board is the surface Hap and Sanjay give feedback against; Joao builds against it. Since this is cardstock's own backlog it lives on the **hosted** Supabase project (project `cardstock`, board `cardstock-dev`), not a staging tier — there is no separate machine between a laptop and Vercel. Every `sync.py` call in this loop carries `--hosted`. The local Docker database is a disposable dev fixture and says nothing about where a card is. An item's lane is a claim about reality made in public, so this skill is strict about what earns each move and about never overwriting a decision a person made.

## Where things live

Everything for this loop is in this repo, under `backlog/`:

| Path | What |
|---|---|
| `backlog/tracker/*.md` | The tracker items — the markdown side of the board |
| `backlog/tracker/README-scheme.md` | Frontmatter, epics, tags and lane vocabulary |
| `backlog/cardstock/README.md` | Who owns which field, hosted vs local, lane meanings |
| `backlog/cardstock/mapping.json`, `board.json` | Board config: tag groups, scheme, seed pointer |
| `backlog/sync.py`, `backlog/validate_tracker.py` | Thin wrappers that shell out to the shared board-sync engine |

The sync engine itself is shared infrastructure and lives outside this repo, at `<STAFFETO_VAULT>/delivery/board-sync` (default `D:\Developer\staffeto\git\wiki`, override with the `STAFFETO_VAULT` env var if your checkout is elsewhere). You never edit it as part of this loop — only run it via the two wrapper scripts below.

Run every command from this repo's root.

## Preconditions

Check all of these before touching anything. Any failure is a stop, not a workaround.

- The item has a file at `backlog/tracker/<id>.md`. If it doesn't exist yet, see **Filing a new item** below.
- Docker Desktop is running and `supabase_db_cardstock` is healthy — even in `--hosted` mode, that container's `psql` client is what the sync engine uses to reach prod. `py -3 backlog/sync.py --hosted --check` confirms it, or pass `--start` to bring the stack up.
- That same `--check` reports a converged board and **no `PROBLEM` lines**. If it reports pending files you did not cause, resolve that first — see **Non-convergence** below. A `PROBLEM` is an id already taken on the site or a body the app owns; see **Guards** below.
- No other agent or session is mid-loop. `sync.py` rewrites all tracker files, so it is a global operation and two concurrent runs will race. One loop at a time.
- The working tree has no uncommitted tracker changes from unrelated work. The opening commit is meant to be legible.

## Filing a new item

**A new card never starts at a lane that implies work has begun.** File into `unsorted`, or `now` only if you are about to work it immediately. Filing is not a promotion.

Run `sync.py --hosted --check` first and use the `next-id` it prints; never pick an id by listing the folder, since cards are also created on the site and the two allocate the same way. Then write the file per `backlog/tracker/README-scheme.md` (required frontmatter: `id`, `title`, `status`, `epic`, `area`, `tags`; required sections: `## Ask`, `## Status`), validate, sync and commit.

## Phase 1 — Claim

Move the item into `now` so the board shows it is being worked on before any work starts.

1. Read `backlog/tracker/<id>.md` in full. Note its current `lane:` and `status:` — the original lane is needed for the abort path.
2. Set `status: wip` and `lane: now` in the frontmatter. Both fields, not just the lane — `now` requires `wip` and `wip` is only valid in `now`; `validate_tracker.py` fails if they disagree.
3. Run `py -3 backlog/validate_tracker.py`. It must report 0 problems.
4. Run `py -3 backlog/sync.py --hosted`. It must print `converged`.
5. Commit the tracker files the sync touched.

That commit is the opening fingerprint. Its diff is not a fingerprint on its own — moving one card renumbers its lane and everything downstream, and the sync also brings down any board triage a person did since the last run. Put the signal in the message:

```
tracker(#<id>): claimed, moved to Now

<one line on what is about to be attempted>

Board fields for other items in this commit are the export bringing down
triage done on the board since the last sync, not changes made here.
```

## Phase 2 — Work

Do the work in this repo. Before considering the item done, both of these must hold:

- The relevant tests are green and the typecheck/lint is clean.
- You've actually exercised the change (see AGENTS.md / CLAUDE.md guidance on testing UI changes in a browser before claiming success) — not just that the build succeeded.

A green build is not proof the change works, and a successful `git push` is not proof Vercel served it — a cached bundle can serve after a redeploy. Never treat a clean build or a completed push as proof the change works in the running app.

## Phase 3 — Building (pre-release)

`building` is cardstock's single pre-release lane — there is no staging tier to gate on, so unlike a client-delivery board this move does not require a separate person's sign-off. You may set it yourself once Phase 2's bar is met.

1. Update the item body. Overwrite the `## Status` section, never append. If `sync.py --hosted --check --item <id>` shows `body-owner=app`, someone edited or commented on the card on the site and the file body no longer round-trips: write the Status update on the card page instead of in the file, or the next sync discards it (see **Guards**).
2. Set `status: built` and `lane: building`. Record what was built and what remains unverified.
3. Run `py -3 backlog/validate_tracker.py` (0 problems), then `py -3 backlog/sync.py --hosted` (must print `converged`).
4. Commit:

```
tracker(#<id>): <what was built>

<what changed, and what is still owed a human look>
```

## Phase 4 — Shipping and Done: stop and ask

**Never set `lane: shipped` or `lane: done` on your own authority.** These are the two moves that assert a fact about the live world — that the change is actually running in production, or that it has been reviewed and accepted — and only the operator can confirm either one.

Before asking, re-read the board for this item so you're not about to overwrite a decision someone else made:

```bash
py -3 backlog/sync.py --hosted --check --item <id>
```

If the card is no longer in `building` (or wherever you left it), a person moved it while the work was in progress. **Stop.** Report both states and ask. `sync.py` runs import before export, so the file wins over the board, and writing a new lane here would silently discard their decision.

To ship: report that the code is built, tests are green, and it has been pushed/deployed, then ask the operator to confirm it is actually live and working before setting `status: shipped`, `lane: shipped`. To close: ask before setting `status: done`, `lane: done` or `archive`. Once approved, validate, sync (`converged`) and commit the same way as Phase 3.

## Abort

If the work is abandoned, blocked or handed off, the item must not be left in `now` claiming to be active. `now` holds one card per agent that is running, plus whatever the operator is working themselves, so a stale claim there reads as an agent still at work on something nobody is touching.

Move it to the lane that tells the truth — back to its original lane, or `parked` if blocked, or `next`/`later` if it's just being deferred, then set `status` to match (`blocked` or `held`, not `wip`), validate, sync and commit with a message saying why it stopped.

## Hard stops

**Non-convergence.** If `sync.py` prints `NOT CONVERGED - N file(s) still differ`, do not commit. The state is unstable and the next run will flip it back, churning commits indefinitely. The likely cause is two cards sharing a rank in one lane, where the exporter's tiebreak is not stable. Name them with a dry-run export:

```bash
bun run etl:export --project cardstock --board cardstock-dev \
  --source "backlog/tracker" --dry-run
```

Fix it by renumbering the affected lane in the board database to match what the tracker files already record, which churns no files.

**A human moved the card.** Covered in Phase 4. Always stop.

## Guards

`sync.py` runs two checks before every import and refuses to import on a `PROBLEM` (`--force` overrides; do not use it without the operator). They exist because the ETL is silent about both cases.

**ID collision.** Cards can be created on the site. The site allocates `max id + 1`, and so does an agent filing a new item, so the two can mint the same number between syncs. The guard flags an app-created card whose `<id>.md` carries a different title. Importing would overwrite the site's card with the file. Fix: renumber the file to the `next-id` the check prints. Prevent: run `sync.py --hosted --check` before filing anything and use its `next-id`.

**App-owned body.** Editing a body or posting a comment on the site sets `body_edited_at`; from then on the import ignores the file's body and the export overwrites it. The guard flags a file whose body has diverged from such a card. Fix: make the change on the card page, or revert the file's body. A file whose only change is frontmatter is not flagged.

**Validator failures.** `validate_tracker.py` must report 0 problems before either commit. It parses the frontmatter, so it cannot catch a title that is invalid YAML: any `title:` beginning with a double quote must be escaped or single-quoted, or the parser silently drops characters.

## What the lanes mean

`unsorted` is unfiled. `now` is what is being worked at this moment — one card per agent that is running, plus whatever the operator is working themselves; it is not a queue. `next` is what goes into `now` when something in `now` finishes. `later` is after that — being in `later` says nothing about whether code exists, only that nobody is on it today.

`nice-to-have` and `parked` hold what's deferred or blocked. `building` is the single pre-release lane. `shipped` means live in production. `done` means the operator has reviewed and accepted it; `archive` is closed without shipping.

This is why `wip` and `now` are the same statement made twice, and why the validator enforces it: a `wip` item filed in `later` claims someone is working something nobody is working.

For work that is genuinely started but set aside, use `held`. For work that cannot proceed until someone else acts, use `blocked`.

## Field reference

`status` — one of `backlog`, `blocked`, `wip`, `held`, `built`, `handed`, `shipped`, `done`.

`lane` — one of `unsorted`, `now`, `next`, `later`, `nice-to-have`, `parked`, `building`, `shipped`, `done`, `archive`.

`status` and `lane` must agree, and `validate_tracker.py` fails the build if they do not: `wip` only in `now`; `built`/`handed` only in `building`; `shipped` only in `shipped`; `done` only in `done` or `archive`. Nothing derives one field from the other, so this check is the only thing standing between the two and silent drift.

This loop writes `lane` and `status`. Fields owned by the board's export — `rank`, `priority`, `target`, `archived`, `archived_by` — are never edited by hand. `effort` is human-editable. See `backlog/cardstock/README.md` for the full field-ownership table.

## Related

- `backlog/tracker/README-scheme.md` — frontmatter, epics and tag vocabulary
- `backlog/cardstock/README.md` — who owns which field, and hosted versus local
- `backlog/cardstock/seed.cardstock.sql` — project, board, lanes, tag groups
