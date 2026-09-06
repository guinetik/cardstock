---
name: cardstock-task-loop
description: Use when an operator points you at a backlog tracker item to work on in this repo. Covers the full loop - claim the item into the Now lane, sync and commit an opening fingerprint, do the work, then move it to Building only once it is genuinely done, and never mark it Shipped or Done without the operator's confirmation. Triggers on "work on #N", "pick up tracker item", "take this backlog task", or any request to move a tracker item through the board.
---

# Cardstock task loop

The loop that carries one cardstock backlog item from claimed to shipped, keeping the markdown tracker files, the cardstock board and git history in agreement at every step.

The board is the surface Hap and Sanjay give feedback against; Joao builds against it. This backlog uses `https://cardstock.guinetik.com`, project `cardstock`, board `cardstock-dev`. The local database is only a development fixture. An item's lane is a claim about reality, so do not overwrite a person's triage or claim deployment without evidence. This skill does not authorize writes, commits, provisioning or deletion beyond the operator's request; read-only reviews stop after preview.

## Where things live

Everything for this loop is in this repo, under `backlog/`:

| Path | What |
|---|---|
| `backlog/tracker/*.md` | The tracker items — the markdown side of the board |
| `backlog/tracker/README-scheme.md` | Frontmatter, epics, tags and lane vocabulary |
| `backlog/cardstock/README.md` | CLI workflow, administrator provisioning and lane meanings |
| `cardstock.json` | Operational configuration: tracker, scheme, mapping and seed reference |
| `packages/cli/README.md` | Commands, conflict choices, JSON output and recovery |

Use the Cardstock CLI exclusively for validation and sync. The Python wrappers
were removed. No vault checkout, Docker or database credentials are needed for
that workflow. Provisioning is administrator-only and never part of routine sync.

Run every command from this repo's root.

## Preconditions

Check all of these before touching anything. Any failure is a stop, not a workaround.

- The item has a file at `backlog/tracker/<id>.md`. If it doesn't exist yet, see **Filing a new item** below.
- Use a CLI matching the deployed server (0.4.0 requires protocol 4), signed in with `bun run cli login --remote https://cardstock.guinetik.com` if necessary.
- Run `bun run cli status --remote https://cardstock.guinetik.com --json`. Review pending changes and conflicts before editing; apply only authorized changes, then confirm `ok: true`, `clean: true`, zero conflicts and no diagnostics. Exit 0 alone does not prove a clean board.
- No other agent is editing the same tracker files. The CLI serializes sync operations with a lock, but that does not serialize editors. Never steal a live lock.
- The working tree has no uncommitted tracker changes from unrelated work. The opening commit is meant to be legible.

## Mining call transcripts for feedback

Hap and Sanjay's feedback on cardstock itself usually arrives as an aside inside a call that is mostly about the Designer product, not as a dedicated cardstock session. Use this when asked to sweep a call (or a date range of calls) for cardstock feedback and reconcile it against the tracker.

1. **Find the transcripts.** They live in the vault at `<STAFFETO_VAULT>/delivery/designer/feedback/<date>.transcript.txt`, each paired with a `<date>.md` summary.
2. **Don't trust the `.md` summary alone.** It's written for the Designer/website work and routinely omits cardstock asides entirely, even when the raw transcript has several. Read it for orientation, then grep the `.transcript.txt`.
3. **Grep for more than the product name.** People say "cardstock" maybe once a call — otherwise it's "the board", "the tool", or just a description of clicking something. Search the literal name, but also ask-shaped language: `would be nice|it'd be cool|can we|should have|doesn't work|can't|hard to find|missing|confusing`. Read enough surrounding context on every hit to tell a cardstock UI complaint from a Designer-product one that happens to share a word like "card" or "board".
4. **Throw out what isn't a new ask.** Naming banter, Joao narrating his own in-progress work back to Hap/Sanjay ("did you see the new calendar?"), and a question that resolves itself in the same exchange (someone tries ctrl-click, it works, done) are not feedback items — skip them.
5. **Check before filing.** For anything that looks like a real ask, check both:
   - the existing tracker files (`backlog/tracker/*.md`) — is this the same ask an item already covers, just said again or in different words?
   - this repo's git history (`git log --oneline`, `git log -i --grep=`, `git log -S<term>` on the likely files) — has it already been built? A feature the ask assumes doesn't exist (like a filter or a chart) may predate the call entirely, which usually means the real gap is something narrower — missing data, discoverability, wrong default — not the feature itself. (`#4` and `#9` are both this shape: the feature existed, the data feeding it didn't.)
6. **Update or file accordingly**, then run the normal validate → sync → commit loop:
   - Already fully covered by an existing item and nothing changed → leave it alone.
   - Already built (found the commit) but the tracker doesn't say so → update that item per **Phase 3**, citing the commit(s) in the `## Status` rewrite.
   - Genuinely new and unresolved → **Filing a new item**, below. Set `relates:` to whatever existing item is closest in shape.
7. **Cite evidence, don't assert.** "Built" claims in the `## Status` section should name the commit(s) found, not just say the feature exists — the next person checking this file should be able to verify it without re-doing the git archaeology.

## Filing a new item

**A new card never starts at a lane that implies work has begun.** File into `unsorted`, or `now` only if you are about to work it immediately. Filing is not a promotion.

Sync first and follow the ID-allocation guidance in `backlog/tracker/README-scheme.md`.
The CLI has no `next-id` command; the scoped baseline includes both live and reserved
deleted IDs. A fresh snapshot is not an ID reservation. If concurrent creation
causes a collision, reconcile it without overwriting the existing card. Write the
file per the scheme, validate, preview, then sync and commit when authorized.

## Phase 1 — Claim

Move the item into `now` so the board shows it is being worked on before any work starts.

1. Read `backlog/tracker/<id>.md` in full. Note its current `lane:` and `status:` — the original lane is needed for the abort path.
2. Set `status: wip` and `lane: now` in the frontmatter. Both fields, not just the lane — this board's configured workflow requires them to agree.
3. Run `bun run cli validate --json`. It must report no diagnostics.
4. Run `bun run cli sync --dry-run --remote https://cardstock.guinetik.com --json`; review it, then `bun run cli sync --remote https://cardstock.guinetik.com --json`. Verify a fresh `status` is clean.
5. Review the diff and, when authorized, commit the tracker files by name. Do not include unrelated work.

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

1. Preview current hosted changes before updating the item body. Overwrite the `## Status` section, never append. Both local and hosted bodies round-trip; resolve simultaneous edits explicitly, with no app-owned/file-owned winner.
2. Set `status: built` and `lane: building`. Record what was built and what remains unverified.
3. Validate, preview and sync using the commands in Phase 1; confirm a fresh status is clean.
4. Commit:

```
tracker(#<id>): <what was built>

<what changed, and what is still owed a human look>
```

## Phase 4 — Shipping and Done: stop and ask

**Never set `lane: shipped` or `lane: done` on your own authority.** These are the two moves that assert a fact about the live world — that the change is actually running in production, or that it has been reviewed and accepted — and only the operator can confirm either one.

Before asking, re-read the board for this item so you're not about to overwrite a decision someone else made:

```bash
bun run cli status --remote https://cardstock.guinetik.com --json
```

Inspect the selected card's changes. If a person moved it out of `building` (or
wherever you left it), report both states and ask before changing their decision.
Three-way sync can merge disjoint changes, but that is not authorization to
override someone else's triage.

To ship: report what has actually been verified and ask the operator to confirm it is live and working before setting `status: shipped`, `lane: shipped`. To close: ask before setting `status: done`, `lane: done` or `archive`. Once approved, validate, preview, sync and verify a clean status, then commit as in Phase 3.

## Abort

If the work is abandoned, blocked or handed off, the item must not be left in `now` claiming to be active. `now` holds one card per agent that is running, plus whatever the operator is working themselves, so a stale claim there reads as an agent still at work on something nobody is touching.

Move it to the lane that tells the truth — back to its original lane, or `parked` if blocked, or `next`/`later` if it's just being deferred, then set `status` to match (`blocked` or `held`, not `wip`), validate, sync and commit with a message saying why it stopped.

## Hard stops

**Conflicts or pending work.** Inspect the JSON plan; never loop apply commands or
choose blanket winners merely to get clean. `--ours <id>[:field]` selects local
content, `--theirs <id>[:field]` selects hosted content. Preview resolutions first.
For tied-rank diagnostics, reconcile the lane ordering on the board when authorized;
do not use direct database writes as a sync workaround.

**Interrupted sync.** Read the journal diagnostic and use `sync --resume` after
fixing the issue, or `sync --abort` to preserve and archive the intent. Abort does
not undo committed writes. Never delete the baseline or recovery files to force
agreement. See the CLI README for lock recovery and backup handling.

**A human moved the card.** Covered in Phase 4. Always stop.

## Guards

**Identity.** Missing or replaced immutable UUIDs cannot be resolved by selecting
a content side. Investigate the identity before proceeding; never drop a baseline
to turn a conflicting card into a new upload.

**Deletion.** Missing local files are restored, not read as delete requests. Delete
only when explicitly authorized for specific IDs, using `delete <id> --dry-run`
before applying. In a delete-versus-edit conflict, choosing the deleted side means
delete; choosing surviving local content means restore. Preserve backups.

**Validation.** `bun run cli validate --json` must report no diagnostics. Sync also
requires unambiguous YAML. Review titles and prose separately; successful parsing
does not prove the writing meets this board's editorial conventions.

## What the lanes mean

`unsorted` is unfiled. `now` is what is being worked at this moment — one card per agent that is running, plus whatever the operator is working themselves; it is not a queue. `next` is what goes into `now` when something in `now` finishes. `later` is after that — being in `later` says nothing about whether code exists, only that nobody is on it today.

`nice-to-have` and `parked` hold what's deferred or blocked. `building` is the single pre-release lane. `shipped` means live in production. `done` means the operator has reviewed and accepted it; `archive` is closed without shipping.

This is why `wip` and `now` are the same statement made twice, and why the validator enforces it: a `wip` item filed in `later` claims someone is working something nobody is working.

For work that is genuinely started but set aside, use `held`. For work that cannot proceed until someone else acts, use `blocked`.

## Field reference

`status` — one of `backlog`, `blocked`, `wip`, `held`, `built`, `handed`, `shipped`, `done`.

`lane` — one of `unsorted`, `now`, `next`, `later`, `nice-to-have`, `parked`, `building`, `shipped`, `done`, `archive`.

`status` and `lane` must agree under this board's `cardstock.json` scheme: `wip` only in `now`; `built`/`handed` only in `building`; `shipped` only in `shipped`; `done` only in `done` or `archive`. Nothing automatically derives one field from the other.

This loop normally changes `lane`, `status` and the Status body section. Other
fields can sync from either side, but change them only within the task's scope.
Area is free-form; epic names are not an enum. Audience is an explicit filter
classification, never inferred from an internal tag and never an access boundary.

## Related

- `backlog/tracker/README-scheme.md` — frontmatter, epics and tag vocabulary
- `backlog/cardstock/README.md` — CLI sync and administrator provisioning
- `backlog/cardstock/seed.cardstock.sql` — project, board, lanes, tag groups
