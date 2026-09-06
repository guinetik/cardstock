# Cardstock CLI

Command-line companion for [Cardstock](https://github.com/guinetik/cardstock).
Initialize tracker configuration and validate Markdown offline. Remote sync is not implemented yet.

Requires Node.js 22 or newer. Bun is only needed by package developers.

```sh
npm install -g @guinetik/cardstock-cli
cardstock --version
cardstock init --project staffeto --board designer --dir tracker
cardstock validate
cardstock validate --json
cardstock login --remote https://cardstock.example.com
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
