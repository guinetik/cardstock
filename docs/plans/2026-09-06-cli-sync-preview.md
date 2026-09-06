# #17 — Preview local and board changes

## Implemented scope

The shared planner compares frontmatter fields and body text across the local
tracker, an optional agreed baseline, and authenticated board snapshots.
`status` and `sync --dry-run` expose the same read-only plan as prose or JSON.
The snapshot's revision is included for the later applier, but this stage sends
no sync writes and never updates tracker files.

Without a baseline, differing cards under the same ID are unresolved, not
automatically uploaded or downloaded. New one-sided cards have explicit create
directions. Missing files are never deletions, and previously tracked cards
missing remotely are conflicts. Per-field presence is tracked separately from
null, so removing a field remains visible.

`baseline` is the explicit bootstrap/update operation: it persists state only
when both sides agree and local validation passes. Files live under `.cardstock/`
beside the configuration, scoped by remote, board, tracker and mapping. Preview
does not create or advance those files. The writer uses a lock and atomic rename;
corrupt or concurrently replaced state is not silently reset.

## Deliberate limits

- Applying changes, resolving conflicts and recovering partially applied syncs
  remain #18. The API must still check revisions at apply time.
- Tag aliases and bare vocabulary references compare canonically. Executing
  tag/epic/area overrides and audience rules through sync remains #19.
- Preview uses strict YAML for unambiguous nested-field comparison; existing
  minimal-config offline validation retains its lenient parser.
- Snapshot payloads are observed twice to detect changes, including vocabulary
  changes not covered by older ETags. This does not lock the remote database.
- The current API exposes external IDs and revisions, not immutable card UUIDs.
  It cannot conclusively identify a deleted/recreated card reusing the same ID.

## Verification

The core decision matrix covers unchanged data, each change direction, equal
changes, conflicting changes, unknown nested data, absence versus null, aliases,
identity collisions and missing cards. Node command tests use a local HTTP server
and temporary credentials, verify HTTP failures and inconsistent reads, and check
that previews leave files and baseline state unchanged. A separate packed-CLI
installation runs the same integration suite.

The hosted-board sync preceding this work uploaded #19's progress and pulled #20
and updated card positions; it was committed as `a82398b`. #20 currently has area
and tags outside the configured tracker scheme. Its content was preserved.
No saved CLI credential is available on this machine for a hosted preview smoke
test; that check requires signing in through the normal CLI flow.
