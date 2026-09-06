# Cardstock dev board — CLI workflow

The board is hosted at `https://cardstock.guinetik.com` (project `cardstock`, board `cardstock-dev`); `backlog/tracker/*.md` is the Markdown side of the same data. The root `cardstock.json` is the operational configuration for validation and sync. This directory retains administrator provisioning SQL and legacy mapping metadata, not a second sync configuration.

This is the app's own backlog. It is deliberately a separate project from `staffeto`, so that feedback about the board tool never lands in a client-delivery board. Item ids are unique per board: `#1` here is not `#1` on the designer board.

## Commands

Run from the repo root. These examples use the development CLI; an installed
`cardstock` at the matching release supports the same commands. Version 0.4.0
requires the protocol-4 server and deletion migration.

```bash
bun run cli validate --json
bun run cli status --remote https://cardstock.guinetik.com --json
bun run cli sync --dry-run --remote https://cardstock.guinetik.com --json
# After reviewing the plan and with authorization to write:
bun run cli sync --remote https://cardstock.guinetik.com --json
bun run cli status --remote https://cardstock.guinetik.com --json
```

Sign in with `bun run cli login --remote https://cardstock.guinetik.com` if needed.
Everyday validation and sync require neither Python, the Staffeto vault, Docker,
nor database credentials. The old sync/validation wrappers have been retired.
`backlog/board.json` and `mapping.json` remain historical migration fixtures;
edit `cardstock.json` for operational rules. `provisioning.seed` is only a reference.

## Concurrent edits: agents and the board

There is no app-owned/file-owned field split. The CLI compares local Markdown,
the hosted snapshot and a saved baseline. Disjoint edits merge; conflicting edits
require an explicit choice. `body_edited_at` does not choose a winner.

`--ours 19:body` chooses local content for that conflicting field;
`--theirs 19:body` chooses hosted content. Omit `:field` for whole-card conflicts.
Do not override another person's triage just to obtain a clean result. Preview
again after applying: success is not the same as `clean: true`.

Missing files never request deletion. Use `delete <id>` or `delete --file <path>`,
with a dry-run first and authorization for the specific IDs. Remote deletion
records propagate to other checkouts; local edits become delete-versus-edit
conflicts. Interrupted operations use `sync --resume` or `sync --abort`; never
remove the baseline to force agreement. See the [CLI README](../../packages/cli/README.md)
for JSON output, deletion choices, backups and recovery.

## Administrator provisioning

Provisioning is separate from sync. Keep `seed.cardstock.sql` for authorized
administrator use; the CLI never executes seeds. Before applying it, verify the
database selected by `SUPABASE_DB_URL` and take a backup. From the app checkout,
the administrator command is:

```sh
bun run db:apply --file backlog/cardstock/seed.cardstock.sql
```

This requires administrator credentials. Seed inserts add missing entries;
`ON CONFLICT DO NOTHING` does not reconcile edits to existing configuration.

## Lanes

Cardstock is its own product, not a Staffeto client delivery, so it carries no four-gate gauntlet. There is no Sanjay's machine and no staging tier between a laptop and Vercel, so `building` is the single pre-release lane and `shipped` means it is live.

A new card never starts at a lane that implies work has begun. File into `unsorted`, or `now` only if it is being worked immediately.
