# Cardstock CLI

Command-line companion for [Cardstock](https://github.com/guinetik/cardstock).
Initialize tracker configuration, validate Markdown offline, preview changes, and
sync Markdown with the board using explicit conflict resolution and recovery.
Apply requires a server deployed with sync protocol 4 and its database migrations.

Requires Node.js 22 or newer. Bun is only needed by package developers.

## Features in 0.4.0

Version 0.4.0 adds explicit deletion and requires sync protocol 4. Version 0.3.0
does not support deletion and uses sync protocol 3.

- Portable `cardstock.json` configuration and offline Markdown validation.
- Browser-approved sign-in; no database credentials or app checkout required.
- Read-only status and dry-run plans with field-level uploads, downloads and conflicts.
- Bidirectional sync using a saved baseline, explicit `ours`/`theirs` choices,
  transactional uploads, revision/identity checks and resumable recovery.
- Free-form areas, board-defined epics and tags, explicit audience classification,
  and preservation of untouched formatting and unknown nested frontmatter.
- Explicit single/bulk card deletion, retained deletion snapshots, recoverable
  local backups, and delete-versus-edit conflicts across checkouts.

This release requires sync protocol 4 for writes. Upgrade the server and database
before upgrading a tracker client; older apply protocols are refused, not silently
downgraded. See [Generic fields and audience](#generic-fields-and-audience) and
[Interrupted sync and recovery](#interrupted-sync-and-recovery).

## Install and connect

```sh
npm install -g @guinetik/cardstock-cli@0.4.0
cardstock --version
mkdir tracker
cardstock init --project acme --board product --dir tracker --remote https://cardstock.example.com
cardstock login
cardstock validate --json
cardstock sync --dry-run --json
# After reviewing the plan:
cardstock sync --json
cardstock status --json
```

Use existing project/board slugs from the website. `init` creates local configuration,
not a hosted project or board. An empty tracker downloads remote cards on its first
sync. If files already exist on both sides, resolve any first-contact differences
before applying; never delete a baseline to force a result.

Or run without a global installation (pin the same version for repeatable use):

```sh
npx --yes @guinetik/cardstock-cli@0.4.0 --version
```

Licensed under GPL-3.0-only; see LICENSE.

## Agent quick reference

Use the installed `cardstock` command from the tracker repository. In the Cardstock
source repository only, `bun run cli <command>` runs the development source instead.
Read the existing configuration before changing it; `--config <path>` selects a
specific tracker and `--remote <url>` overrides its configured server.

| Command | Effect |
| --- | --- |
| `validate --json` | Offline checks; no writes. |
| `status --json` or `sync --dry-run --json` | GET-only plan; no tracker/baseline changes. |
| `baseline --json` | Save agreed state locally; no board writes. |
| `sync --json` | Apply both directions and save verified baseline checkpoints. |
| `sync --ours 19:body --json` | Choose local content for that conflicting field only. |
| `sync --theirs 19:frontmatter.priority --json` | Choose the board value for that conflicting field only. |
| `delete 19 --dry-run --json` | Preview explicit deletion of only #19; no writes. |
| `delete --file deletions.txt --json` | Delete only the listed IDs; retain local backups and remote snapshots. |
| `sync --resume --json` | Continue the recorded operation, preserving its retry ID. |
| `sync --abort --json` | Archive an interrupted intent; does not undo completed writes. |
| `login --no-browser` | Print a browser approval URL for the user. |
| `logout` | Revoke the token and remove the local credential. |

A normal task-update workflow:

```sh
cardstock status --json
# If the reviewed plan has safe pending changes, sync before editing.
cardstock sync --json
# Edit the appropriate tracker/<id>.md; preserve unrelated edits.
cardstock validate --json
cardstock sync --dry-run --json
# Apply only after reviewing the new plan:
cardstock sync --json
cardstock status --json
git diff -- tracker
```

Only write to the board when the user's task authorizes it. For a read-only review,
stop after `status`/dry-run. Do not select a conflict winner merely to obtain a clean
result: inspect the baseline/local/remote values and choose per field, or ask the
user. `ours` is local Markdown; `theirs` is the board, never an ownership flag.

For automation, read JSON from stdout and keep stderr separate. Preview counts are
under `counts`; a completed apply reports pending work under `remaining` and remote
write IDs under `applied` (including deletions/restorations; downloads are not listed there). Exit 0 means success,
not necessarily a clean board. Require `ok: true`, `clean: true`, and no diagnostics
when checking completion. Exit 1 signals conflicts/validation failures; exit 2
signals configuration, authentication, filesystem, network or execution failure.
Errors can occur after a remote commit: inspect the journal before retrying.

Keep `.cardstock/`, `*.md.cardstock-*.before` and `*.md.cardstock-*.tmp` out of Git.
Never commit credentials or print tokens, never infer deletion from a missing card
file, and never overwrite a corrupt baseline or live lock. Recovery is described
below. A downloaded board edit changes local files: review those changes and commit
them only when the task includes committing work.

## Configuration and validation

Minimal `cardstock.json` (paths are relative to this file):

```json
{
  "version": 1,
  "project": "acme",
  "board": "product",
  "tracker": "tracker",
  "remote": "https://cardstock.example.com"
}
```

`init` creates `cardstock.json` in the current directory and refuses to replace it.
`validate` searches this directory and its parents for that file. `--config <file>`
selects it explicitly. Tracker paths resolve relative to the configuration file.
The tracker directory must already contain `<id>.md` files; other filenames are
ignored, matching the existing ETL. No issue files are changed during validation.

Validation uses the website's frontmatter contract and checks IDs against filenames.
An optional `scheme` adds board-specific workflow, tag vocabulary and cardinality,
open-item summary and required-section checks. Scheme validation also checks strict
YAML syntax (including duplicate keys); minimal configurations retain the existing
lenient parser. JSON diagnostics include a code and field, plus a scheme document
reference for board rules.
Exit codes: 0 success, 1 invalid issues, 2 command/configuration/filesystem error.

## Import an existing tracker configuration

```sh
cardstock init --from backlog/board.json --out cardstock.migrated.json --dry-run --json
cardstock init --from backlog/board.json --out cardstock.migrated.json
cardstock validate --config cardstock.migrated.json
```

Omit `--out` to create `cardstock.json` when it does not already exist. Both normal
creation and preview refuse an existing destination. Preview writes no files.
After reviewing and validating an alternative output, back up the existing
configuration and adopt the new file as `cardstock.json`, or keep selecting it
with `validate --config`. `--from` cannot be combined with `--project`, `--board`
or `--dir`; board identity comes from the legacy file.

The importer embeds the old scheme and mapping in the version-1 configuration.
It resolves tracker, mapping and seed paths relative to `board.json`. For legacy
repository-relative `scheme_doc`, it searches from that directory through its
ancestors and reports the first existing document it finds. Tracker, scheme
document and seed references are then saved relative to the new configuration.
Keep that relative directory layout when relocating the tracker. The referenced
files and tracker directory must exist at import time; validation subsequently
only needs the new configuration and Markdown files.

Missing files, unknown keys and unsupported rules fail before configuration is
written. `$comment` metadata is preserved. `provisioning.seed` records the SQL
seed for administrators and recovery; the CLI never executes it. Credentials
remain outside the configuration. `--remote <url>` is optional for offline work.

Configuration import preserves legacy mapping metadata and reports changed
semantics. Group aliases resolve tag spelling; legacy audience rules are never
evaluated. Validation does not contact the board to verify tags or lanes.
Migrating clients must pass Cardstock's contract, not reproduce their old project's
validator. Keep provisioning artifacts until the new workflow is verified.

To recover from an incorrect configuration, select the saved original file or
correct the imported one and rerun validation. Init and validation do not modify
issue files or the remote board, and do not create a sync baseline.

## Sign in

`cardstock login` opens the Cardstock website for approval. Sign in with your
existing Cardstock account, approve the request, then return to the terminal.
The credential is a personal access token saved in your user configuration
directory, outside the tracker and repository. `cardstock logout` revokes that
token remotely and removes the local credential.

Pass `--remote` or configure a `remote` URL with `cardstock init`. Use
`--no-browser` to print the approval URL without opening it.

## Preview and baseline

`status` and `sync --dry-run` produce the same plan. Both support `--config`,
`--remote`, and `--json`, use the credential saved by `login`, and make only GET
requests to the board API. They write no tracker files, configuration or baseline
state. An empty tracker can preview cards to download; no missing file is treated
as an instruction to delete a remote card.

The planner compares each frontmatter field and the body against a saved baseline.
It reports local-only edits as uploads, remote-only edits as downloads, identical
edits on both sides as equal changes, and different edits to one field as conflicts.
One card may have both upload and download fields. JSON includes each field's
baseline, local and remote values and whether the field is present; removing a
field differs from setting it to null. Counts are per card and directions can
overlap. Unknown nested fields are compared, tags/relations compare as sets, and
tag aliases and unambiguous bare tags use the board vocabulary. Formatting-only
frontmatter changes, CRLF versus LF and the leading title H1 do not create edits.
To avoid ambiguous comparisons, preview requires valid YAML even when a minimal
configuration permits lenient parsing during `validate`.

Without a baseline, a local-only card is a proposed upload and a remote-only card
is a proposed download. Differing existing cards require reconciliation; the CLI
does not infer which side changed. Different titles under the same ID are flagged
as a possible identity collision. A previously tracked card disappearing remotely
without a retained deletion record is a conflict, never an automatic recreation
or deletion. A confirmed deletion downloads only when the local copy is unchanged;
local edits require an explicit delete-versus-edit choice. Duplicate IDs and
filename/ID mismatches fail planning.

Once both sides agree and validation passes, explicitly record their agreed state:

```sh
cardstock baseline --remote https://cardstock.example.com
```

This writes only `.cardstock/<scope-hash>.json` beside the configuration. The scope
includes remote, project, board, relative tracker path and mapping, keeping state
separate for each checkout and board. Ignore `.cardstock/` in version control;
baseline files contain card Markdown. They contain no credentials. Equal edits
since a previous baseline can be recorded with the same command. `status` and
`sync --dry-run` never advance it.

Baseline writes use an exclusive lock and atomic replacement. Corrupt, mismatched
or concurrently changed state fails without resetting it. If a run is interrupted,
inspect the reported baseline path and make sure no CLI process is using it before
removing its stale `.lock`/`.tmp` artifacts. Preserve the last valid JSON file;
discarding it loses the information needed to classify earlier edits. Recreating
a missing baseline still requires agreement on both sides.

Preview exit codes: 0 for a successfully computed plan without conflicts or
validation errors (pending uploads/downloads can still exist); 1 for conflicts,
scheme validation errors, or a refused baseline; 2 for configuration, credentials,
filesystem, malformed input/snapshot, or network errors. `clean` means there are
no pending data changes or conflicts; check `ok`/diagnostics as well before using
a plan. Snapshot and tracker changes during a read require retrying the preview.

## Apply and conflict choices

```sh
cardstock sync --remote https://cardstock.example.com --json
cardstock sync --dry-run --ours 17:body --theirs 18:frontmatter.priority
cardstock sync --ours 17:body --theirs 18:frontmatter.priority
```

Ours always means local Markdown; theirs always means the hosted board. A choice
affects only the selected conflicting fields, preserving unrelated edits from both
sides. Omit `:field` to select all conflicts on a card. Repeat flags for additional
cards. Missing/replaced identities cannot be resolved by choosing a content side.
Legacy app-owned/file-owned body flags never choose the winner in this sync path.

The CLI records the complete intent before writes. Remote uploads are a single
transaction containing the card, tags, links and history. Existing rows require
immutable UUIDs and revisions; new rows use insert-only creation. An operation ID
makes retries idempotent, including when the server committed but its response was
lost. Snapshots are read back before local publication and baseline advancement.
Each verified card checkpoints independently; a failure never advances unverified
cards. Later edits can still appear as pending work in the final preview.

Older baselines lack immutable IDs. Once both sides agree, rerun `baseline` against
the updated server. Alternatively, `sync --adopt-identities` explicitly trusts the
currently observed identity mapping for this one upgrade. It does not override a
known UUID mismatch or resolve any content conflicts.

Optional field removal is a real removal, not an instruction to retain an old
database value. Untouched source formatting and nested unknown YAML are preserved.
Rank is a position in a lane: invalid or contradictory positions fail the entire
remote batch. Ambiguous tied lane ranks require a board reorder before applying.
Nonempty tag/epic/area tag-derivation overrides remain unsupported: put the desired
tags directly in frontmatter before removing those rules. Normal tag references,
unambiguous bare tags and group aliases are supported. No alias name is built in.

## Explicit card deletion

Deletion requires the same signed-in board-admin access as other sync writes.
It never needs database credentials, SQL seeds or a missing-file heuristic.

```sh
cardstock delete 17 --dry-run --json
# Review the exact card and action before applying:
cardstock delete 17 --json

# Bulk: one positive integer card ID per line; blank lines and # comments allowed.
cardstock delete --file deletions.txt --dry-run --json
cardstock delete --file deletions.txt --json
```

You can also pass several IDs: `cardstock delete 17 18`. Choose positional IDs or
`--file`, not both. Duplicate/invalid IDs and empty lists are errors; at most 1,000
IDs may be selected. The command affects only those cards, not unrelated pending
edits. `--config`, `--remote` and `--json` work as for sync. The final `remaining`
counts cover the whole tracker, so a successful scoped deletion may not be clean.

Deleting a live card requires a saved baseline with its immutable UUID. First sync
or establish agreement with `baseline`; new local-only cards must be synced before
this command can delete them. Removing a Markdown file by itself still causes a
download, **never** a remote delete. Completed tasks should normally be marked done
or archived, not deleted. Agents must have user authorization for the selected IDs.

Each deleted identity stays reserved remotely with its last sheet snapshot and a
new revision. Ordinary sync carries that deletion to other checkouts. Unchanged
local copies move to `17.md.cardstock-<operation>.before`; locally edited copies
produce an `existence` conflict. The JSON plan reports `delete_remote`,
`delete_local`, or `restore_remote` explicitly; `existence` values are booleans
(`false` means deleted). Never interpret an absent API card as a tombstone.

| Conflict | `--ours <id>` | `--theirs <id>` |
| --- | --- | --- |
| `delete 17`: hosted card changed since baseline | Delete the hosted card; preserve local bytes in a backup. | Cancel deletion and download the hosted content. |
| `sync`: hosted deletion versus local content | Restore the local content remotely under the same UUID. | Accept deletion and move the local file to a backup. |

```sh
cardstock delete 17 --ours 17 --dry-run --json
cardstock delete 17 --ours 17 --json

# In another checkout with a local edit that should survive a hosted deletion:
cardstock sync --ours 17 --dry-run --json
cardstock sync --ours 17 --json
```

Existence conflicts are whole-card decisions; content-field flags cannot resolve
them. A replaced UUID is still an identity error, not an ours/theirs choice.
To restore after accepting a deletion, copy the preserved `.before` file back to
`17.md`, inspect `status`, then explicitly choose `sync --ours 17`. Simply restoring
a file never silently recreates the hosted card. Restoration validates current
lanes/tags and restores sheet content and outgoing links, **not** deleted comments,
event history or incoming links. Keep administrator backups when full undo matters.

The remote batch is atomic and revision-checked. Repeated requests use the same
operation receipt; interrupted deletion uses `sync --resume`, not a new delete
command. `sync --abort` archives intent without undoing an already committed
deletion. Keep journal archives and `.before` files until results are verified.

Administrator deletions after the migration also create tombstones. Deletions
before it was installed cannot be reconstructed and remain missing-identity
conflicts. Tombstones remain until explicit restoration or deletion of the parent
board; there is no automatic expiry, CLI purge or reuse of deleted IDs.

Deployment: apply `20260916000000_cli_card_deletion.sql`, deploy the protocol-4
server, then upgrade the CLI. Complete pending operations with their matching
client/server before upgrading. This release refuses older servers for writes;
the new server refuses protocol-3 writes. Provisioning remains administrator-only:
the CLI does not execute `provisioning.seed` or add a `--seed` command.

## Generic fields and audience

```yaml
area: Customer experience
epic: Improve onboarding
audience: internal
tags: [enhancement]
```

Area is free-form nonempty text, not an enum. Epic is an optional assignment by
name (up to 200 characters): sync reuses an epic on that board or creates it.
Clear the assignment with an omitted, empty or null epic; this never deletes the
epic or its other cards. Epics created on the site can be assigned to cards and
round-trip normally. Empty epics without cards have no standalone Markdown file.
Legacy `scheme.areas` and `scheme.epics` lists are retained as suggestions only,
and a legacy required-epic rule does not prevent an unassigned card.

Audience is an independent filter classification: `all` (the UI's General option)
or `internal`. It is **not an access-control boundary**. A board needs no internal
tag; a tag named internal or any area/epic name has no automatic effect on audience.
Legacy `audience_internal_when` is retained as inert metadata, never evaluated by
sync or the importer. Existing database audience values are not migrated or reset.

Omitted audience means `all`. Protocol-3 snapshots expose the existing stored
classification, so old baselines download an internal value before future edits.
Removing a previously synced `audience: internal` is an explicit change back to
`all`. Field merging, revision checks and recovery apply as for other fields.
Older clients/servers cannot apply across this protocol change. Finish or archive
pending journals before upgrading; do not delete the baseline or recovery files.

## Interrupted sync and recovery

```sh
cardstock sync --resume --remote https://cardstock.example.com
cardstock sync --resume --recover-lock --remote https://cardstock.example.com
cardstock sync --abort --remote https://cardstock.example.com
```

Resume uses the saved intent and retry ID, not a freshly guessed winner. Do not
pass new `--ours`/`--theirs` choices to resume. If either side changed incompatibly,
preserve those edits, abort the old intent, then preview/reconcile a fresh plan.
Abort archives the journal; it does **not** roll back completed remote or local
writes. An explicit baseline replacement is refused while a journal is pending.

The scope lock excludes other cooperating sync/baseline writers. `--recover-lock`
only reclaims a lock recorded on this machine whose process has exited. Unknown
owners and live processes require inspection, never automatic lock stealing.

Local files are staged and flushed, then published with an exclusive filesystem
link so a file that appears concurrently is never overwritten. An existing file
is first moved to its per-operation `.before` name and checked again. A crash in
that brief filename gap is recoverable with `--resume`; file contents are never
published partially. Displaced originals are retained to preserve writes from
editors holding an old file descriptor. These backups and journal archives contain
Markdown, not credentials. Add these patterns to each tracker's ignore file:

```gitignore
.cardstock/
*.md.cardstock-*.before
*.md.cardstock-*.tmp
```

Do not delete recovery artifacts until the run is verified and any concurrent
editor changes have been reconciled. Hard-link publication requires a filesystem
that supports hard links; an unsupported filesystem stops with originals retained.
File data is flushed; directory durability follows platform filesystem guarantees
(Windows does not expose POSIX directory fsync through Node).

Apply exits 0 when the recorded operation completes without remaining conflicts,
1 for plan/validation conflicts, and 2 for failed or interrupted execution. JSON
errors include the pending journal path and recovery guidance when available.
