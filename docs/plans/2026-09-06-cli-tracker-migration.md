# #19 — Migrate tracker clients to one CLI configuration

Prepared 2026-09-06 against `fd299b5` (CLI 0.2.2), after pulling the hosted `cardstock/cardstock-dev` board.

## Revised direction and current implementation

The product owner explicitly removed Designer-specific validation parity as an
acceptance gate. Migrate to Cardstock's generic contract; do not reproduce Staffeto
conventions in application code. The original inventory below is historical.

- Area is free-form text; legacy area/epic vocabulary lists are suggestions only.
- Epics are optional board entities: reuse by name, create missing names, download
  website assignments, and clear assignments without deleting entities. Epic names
  do not trigger tags, audience or workflow behavior in the generic sync path.
- Audience is explicitly `all` or `internal`, an independent filter classification
  with no access-control effect. Tags are board-defined labels, not audience rules.
  Remove hardcoded internal-tag/engineering-epic inference from the importer too.
- Retain aliases as explicit configuration. Legacy `audience_internal_when` is inert
  metadata; nonempty tag-derivation overrides remain rejected by sync rather than
  being silently applied. They can be replaced with explicit frontmatter tags.

Implemented locally: frontmatter and snapshot audience, bidirectional updates,
generic area/epic validation, optional epic assignment, UI clarification, and
protocol-3 safety gates. Migration `20260915000000_explicit_card_audience.sql`
preserves stored audience and access policies, extends revision projections, and
adds a separate v3 apply function so incomplete deployments fail before writes.
Finish/reconcile pending journals before upgrading; retain old baselines so existing
internal audience can be downloaded safely. Default/omitted audience is `all`.

Deployed in b9a2002 after Joao applied the migration. Hosted CLI smoke passed on
2026-09-06: temporary area, epic and audience values uploaded from the primary
checkout, downloaded to an independent tracker, then restored and verified clean
in both trackers. No internal tag was required. See tracker #19 for evidence.

CLI 0.3.0 and 0.4.0 were subsequently released. Protocol 4 adds explicit deletion
and recovery; provisioning remains a separate administrator workflow, not a CLI
seed feature. Reproducing Designer's validation conventions is not a gate.

The user relayed the wiki agent's verified cutover report: both boards clean with
zero conflicts, validation at 34 and 125 files, and a write/read-back/revert on #75.
The report also records a backed-up production provisioning run and 15 tests of
the separate administrator tool. These are reported wiki-side results, not tests
rerun from this repository.

The Cardstock repository's two obsolete Python wrappers are now removed. Its
active runbook, tracker scheme and task-loop skill use the CLI and root
`cardstock.json`; legacy configuration fixtures and seed SQL remain available for
migration history and authorized administrator provisioning. Historical commands
in the original plans below are not current operating instructions.

## Historical outcome and boundary

Cardstock, Designer and Website use the same installed CLI with one portable configuration per tracker. Preserve each board's workflow, vocabulary, mappings and validation rules. No copied Python engine, app checkout, Docker database or database credentials should be needed for everyday validation and sync.

The configuration and validation work can begin now. Retiring the sync shims requires #17's preview/baseline planner and #18's conflict-aware apply/recovery flow. Those commands are absent from the current CLI; #19 must not replace them with the old import/export ordering. This document prepares implementation; it does not implement or retire anything.

## Current evidence

- `packages/core/src/config.ts` accepts only version, project, board, tracker and optional remote. `packages/core/src/validate.ts` checks the shared frontmatter contract and file identity, without board rules.
- `packages/cli/src/run.ts` implements init, validate, login and logout. Configuration discovery already searches parents and resolves tracker paths relative to the selected configuration.
- `backlog/sync.py` and `backlog/validate_tracker.py` import the shared Python engine from the Staffeto wiki through `STAFFETO_VAULT` or a machine-specific fallback.
- Legacy sources are `backlog/board.json`, plus `delivery/designer/board.json` and `delivery/website/board.json` in the Staffeto wiki. Each references a mapping file, seed SQL and an inline scheme.
- The API sync route calls `planImport(files, state)` without a client mapping. Its request accepts card Markdown and revisions; preserving custom mapping behavior needs an explicit integration design. The cards snapshot route also has no client mapping input.
- Hosted pull changed #9, #17, #18 and #19; the exporter verified that a second export changes nothing. #19 is now WIP in `now`, assigned to Joao, priority 1, effort H.
- Baseline validation: CLI reports 19 files and zero errors. The legacy validator reports one error: #9 has `status: wip` with `lane: next`. Preserve this diagnostic; do not change unrelated card intent to make migration checks pass.

## Compatibility inventory

| Client | Workflow and vocabulary | Mapping behavior |
| --- | --- | --- |
| Cardstock | `building`/`shipped` lanes; six product epics; exactly one kind, at most one surface | Bare tags; `internal` audience rule |
| Designer | `built`, `gate-2`, `gate-3`, `gate-4`; nine epics; required `tracker-item`; integration, step, kind and objective groups | `int` aliases to board group `area`; internal tags and engineering epic affect audience |
| Website | Delivery gate lanes; five epics; exactly one kind, at most one page; `general` area | Bare tags; `internal` audience rule |

All three include required fields, accepted statuses, closed statuses, status/lane restrictions, the reverse `now` rule, area/epic vocabularies, sizes, priorities, required body sections and summaries for open items. The Python implementation also contains rules beyond the JSON, notably open-item summaries and nonempty sections. Port those behaviors explicitly rather than merely copying configuration keys. Retain strict YAML validation and filename/ID diagnostics.

## Implementation sequence

1. **Capture compatibility fixtures.** Record all three legacy configurations and mappings, representative sanitized Markdown and matching board snapshots. Include valid and invalid cases from the Python validator tests. Keep client content and credentials out of committed fixtures. Record expected diagnostics and documented legacy quirks separately from intended corrections.
2. **Extend the shared configuration contract.** Keep existing version-1 minimal configurations valid. Add optional, strictly validated `scheme` and `mapping` objects so a migrated tracker has one operational JSON file. Preserve legacy key names where practical. Reject unknown configuration and rule keys with paths and actionable messages. Keep path resolution independent of the process working directory.
3. **Implement board validation in core.** Make the scheme optional in `validateTracker`; existing callers retain their behavior. Add all inventoried rules, structured diagnostic codes and field locations, and actionable scheme references. Keep core independent of filesystem, Next.js and database access. Have CLI validation load the optional scheme and preserve existing exit-code conventions.
4. **Add explicit legacy configuration import.** Proposed interface: `cardstock init --from <board.json> --remote <url>` with a preview mode. Resolve the old tracker and mapping relative to the old file, rebase tracker paths to the output configuration, and inline the mapping. Never replace an existing `cardstock.json` implicitly: report the collision and support an explicit alternative output path. Diagnose missing files, invalid rules and unsupported fields before writing anything. Treat `$comment` as documented metadata. Report how `scheme_doc` is resolved because current values are repository-relative, unlike tracker/mapping paths.
5. **Handle seeds as migration metadata.** Preserve and report the referenced seed as a provisioning/recovery artifact; never execute arbitrary SQL during init, validate or everyday sync. Compare required lanes, groups and tags with board metadata before cutover. Missing provisioning must produce diagnostics rather than silently dropping tags. Document the supported administrator provisioning path before calling migration complete.
6. **Integrate mapping with #17/#18 and the API.** Specify how aliases, tag/epic/area overrides and audience rules reach both planning and export. Reuse shared mapping semantics, preserving the tracker spelling of aliases on export. Any API extension must validate inputs and retain authorization/revision checks. Test Designer's `int:*` round trip explicitly. Avoid silently relying on the current default mapping or conflating similarly named tag groups.
7. **Validate and cut over one client at a time.** After #17/#18 are ready, start with Cardstock, then Designer and Website. Capture a baseline and backup, preview differences, reconcile known data errors, apply the reviewed plan and verify a second preview is empty. Compare semantic fields and byte preservation of untouched Markdown, including unknown frontmatter, comments and CRLF. Retire each shim only after that client's parity is demonstrated.
8. **Document installation and recovery.** Update CLI documentation and each tracker runbook with the installed Node CLI, configuration migration, authentication, validation, preview, sync and interrupted-run recovery. Explain backup/baseline locations and restoring local files without overwriting newer remote work. Retain legacy provisioning artifacts until their replacement is proven. No release or publication is part of this preparation.

## Verification and acceptance

- Meaningful core tests cover every supported scheme rule, malformed field types, aliases, ambiguous/unresolved tags, audience mappings and required sections. Include #9's current lane/status mismatch as a regression case.
- CLI integration tests cover importing each legacy configuration, preview without writes, an existing destination, missing mapping, relocated paths, parent discovery, explicit configuration, JSON diagnostics and unchanged minimal configurations.
- Run package checks and CLI integration tests, then install the npm tarball in an isolated Node environment with no app checkout or Python engine. Offline validation must work for all three fixtures.
- At the sync integration stage, verify concurrent local/remote edits, identity collisions, missing files without inferred deletion, interrupted writes, recovery and an empty follow-up plan on all three board snapshots. Separate intended legacy data diagnostics from migration regressions.
- If the implementation changes shared app modules or API routes, read the relevant installed Next.js guides before coding and run the affected app/API checks as well.

## Recommended first slice

Implement the optional scheme/mapping schema, board-specific validation and explicit legacy configuration import, with three-client fixtures and diagnostics. Keep the existing sync commands available. Full migration remains dependent on #17/#18 and mapping support across the API boundary.
