# #18 — Safe bidirectional sync apply

## Sequence

1. Materialize the conflict-free field plan into local and remote Markdown,
   preserving untouched bytes, unknown YAML, comments and newline style.
   Reject unresolved conflicts or documents that cannot be edited losslessly.
2. Persist a scoped, versioned intent journal before side effects. Keep original
   and intended content, revisions and per-card verification progress. Interrupted
   writes must be inspectable and recoverable, never guessed or blindly replayed.
3. Harden the API: expose immutable card UUIDs; require expected UUID/revision for
   existing cards and insert-only creation; commit the card, tags, links and event
   together. Full-sheet removals must be explicit rather than silently omitted.
4. Wire the CLI executor to the guarded API and atomic local file replacement.
   Compare local bytes immediately before replacement; verify remote results before
   advancing only that card's baseline. Never infer deletion from absent files.
5. Test concurrency and interruption at each boundary, then run a controlled hosted
   apply smoke test after deploying the server changes.

## Conflict model (user direction)

This sync supersedes legacy app-owned/file-owned body rules. Ownership timestamps
must never choose a winner. The baseline provides the common ancestor: merge edits
to different fields automatically; stop on differing edits to the same field.
`ours` always means local Markdown, `theirs` always means the hosted board.
Explicit selections resolve conflicting fields only, preserving unrelated changes.
Support per-card choices and narrower per-field choices; reject overlapping or
nonmatching selections instead of pretending they did something. Missing identities
and ambiguous identity collisions require identity reconciliation, not a content
overwrite. Resolved intents retain before/after values and the explicit selection
for recovery/audit. Manual editing to make both sides agree remains valid.

Initial CLI surface: `sync --dry-run --ours 17:body` or `--theirs 17` previews that
choice without saving it or writing either side. Repeat flags to select more cards.

## Initial implementation boundary

The first implementation slice covers merge materialization and recovery-journal
storage/state transitions. It does not enable `sync` writes. The existing #16 API
is insufficient for a safe general executor: new-card upsert can overwrite a racing
creation, tag/link/event writes are not part of the revision-checked card update's
transaction, and snapshots do not expose immutable UUIDs. These are correctness
prerequisites, not reasons to silently omit those cases during apply.

Journal data must not contain credentials. A lock serializes cooperating writers;
crash-left locks require explicit operator inspection rather than automatic stale
lock deletion. Journal reads do not create files. Transitions compare the previous
generation to reject stale writers. Original content stays available after partial
success. Baseline advancement and filesystem replacement belong to the executor,
not the journal store. No production card content is changed by these tests.

## First-slice verification

65 core/journal tests and 19 real-Node CLI integration tests pass. Package and app
TypeScript checks pass. The CLI test script runs journal tests before building and
testing the Node executable; the check workflow also runs core tests.

Lossless edits support block-mapping frontmatter, nested unknown values, scalar
comments, quoted keys, null/removal, per-side newline style and redundant local H1s.
YAML anchors/aliases and top-level flow maps are deliberately refused when a YAML
edit is needed, rather than flattened. Unchanged documents are left untouched.
The rendered result is parsed and checked against the intended merged values.

Journal tests cover retained originals, reopening partial progress, stale generation
rejection, competing writers, corrupt state, crash-left locks/temp files and ordered
verification. They do not establish end-to-end crash recovery for the future
executor. No live CLI apply command, resume command or automatic baseline advancement
is enabled by this slice.
