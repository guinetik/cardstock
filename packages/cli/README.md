# Cardstock CLI

Command-line companion for [Cardstock](https://github.com/guinetik/cardstock).
Initialize tracker configuration, validate Markdown offline, preview changes, and
sync Markdown with the board using explicit conflict resolution and recovery.
Apply requires a server deployed with sync protocol 2 and its database migration.

Requires Node.js 22 or newer. Bun is only needed by package developers.

```sh
npm install -g @guinetik/cardstock-cli
cardstock --version
cardstock init --project staffeto --board designer --dir tracker
cardstock validate
cardstock validate --json
cardstock login --remote https://cardstock.example.com
cardstock status --remote https://cardstock.example.com
cardstock sync --dry-run --remote https://cardstock.example.com --json
cardstock logout --remote https://cardstock.example.com
```

Or run without a global installation:

```sh
npx @guinetik/cardstock-cli --version
```

Licensed under GPL-3.0-only; see LICENSE.

`init` creates `cardstock.json` in the current directory and refuses to replace it.
`validate` searches this directory and its parents for that file. `--config <file>`
selects it explicitly. Tracker paths resolve relative to the configuration file.
The tracker directory must already contain `<id>.md` files; other filenames are
ignored, matching the existing ETL. No issue files are changed during validation.

Validation uses the website's frontmatter contract and checks IDs against filenames.
An optional `scheme` adds board-specific workflow, vocabulary, tag cardinality,
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

Mappings preserve group aliases, tag/epic/area overrides and audience rules for
future sync integration. Validation checks the configured tracker vocabulary;
it does not contact the board to verify its tags or lanes. Keep existing sync and
provisioning scripts until remote sync and round-trip parity are available.
Configuration import alone does not complete the sync migration.

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
is a conflict, never an automatic recreation or deletion. Duplicate IDs and
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
Nonempty tag/epic/area mapping overrides and custom audience rules are refused
pending #19 integration. Existing app-managed audience is retained on updates;
new cards use the default internal-tag audience rule. For tag resolution,
normal tag references, unambiguous bare tags and group aliases are supported.

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
