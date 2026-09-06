# CLI workspace and releases

The Next.js application stays at the repository root. `packages/core` is the
private `@cardstock/core` workspace; `packages/cli` is the public
`@guinetik/cardstock-cli` package. One root `bun.lock` installs all three.
Existing web, ETL and deployment commands keep their current working directory.

The core holds the shared parser, frontmatter schema, color vocabulary, config
schema and offline validation. Parsing uses Node crypto for source hashes;
schema/color subpath exports keep that dependency out of browser imports.
Future sync planning belongs there, without Next.js, filesystem or database imports.
Both consumers declare a workspace dependency (the CLI uses a dev dependency
because shared code is bundled at build time). Next.js consumes core TypeScript
directly; the CLI's Bun build targets Node and bundles imported code. No core
package needs publishing, and CLI users do not need Bun or the app checkout.

Package TypeScript configs are independent of the Next.js config. Root
`bun run check` checks the app and both packages.

```sh
bun install --frozen-lockfile
bun run check:packages
bun run cli --version
bun run build:cli
node packages/cli/dist/index.js --version
npm pack ./packages/cli
```

The packed executable embeds the version from its own package.json. It supports
`init` (including legacy configuration import), `validate`, `login`, `logout`,
`status`, `sync --dry-run`, `baseline`,
`--help`, and `--version` (`-v`). See the CLI README for usage
and exit codes. `bun run --cwd packages/cli test` builds and tests the Node CLI.
The npm package contains the compiled executable, manifest, README and license.
Do not add Next.js or workspace runtime dependencies to its published manifest.

## npm setup

Publishing follows the tag-driven pattern in guinetik-backend. The workflow is
`.github/workflows/publish-cli.yml`, the package is `@guinetik/cardstock-cli`,
and the release tag must be `cli-v<packages/cli/package.json version>`.

If the package does not exist on npm yet, make its initial public publication
from an authenticated maintainer machine (with Bun installed for prepack):

```sh
npm login
npm publish ./packages/cli --access public
```

Then configure the package's npm **Trusted Publisher**:

| Setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `guinetik` |
| Repository | `cardstock` |
| Workflow filename | `publish-cli.yml` |
| Environment | Leave empty |
| Allowed action | Direct publishing with `npm publish` |

The GitHub-hosted workflow grants `id-token: write`, installs Node 22 and npm 11,
builds and packs the CLI, installs the tarball and checks its command, then
publishes that same tarball to the public npm registry. No `NPM_TOKEN` secret is
required. npm supplies provenance automatically when eligible; the workflow does
not force it for private repositories. See the
[npm trusted publishing guide](https://docs.npmjs.com/trusted-publishers/).

## Releases

Commit the workspace setup before running the helper. It refuses a dirty tree.

```powershell
# Release the version already in the manifest, if not published yet:
./scripts/release-cli.ps1

# Next release (also use this after manually publishing the initial version):
./scripts/release-cli.ps1 -Bump patch

# Prepare a tag locally without pushing:
./scripts/release-cli.ps1 -Bump minor -NoPush
```

Bumps update both the CLI manifest and root lockfile and create a release commit.
Current-version mode creates only a tag. The helper checks/builds locally; the
workflow verifies the npm installation with Node before publication. npm versions
are immutable: do not tag an already published version expecting it to republish.
Web deployment and CLI versioning are independent.

## Tracker configuration migration

Core owns the optional scheme and mapping schemas and pure board validation.
The CLI handles legacy JSON reads, path rebasing and exclusive destination
creation. `yaml` is bundled into the executable for strict scheme validation;
there is no new runtime installation requirement for CLI users.

Run `bun test packages/core/test` for scheme rules and
`bun run --cwd packages/cli test` for Node command integration, including all three
legacy board configurations and synthetic Markdown. The fixtures are local and
contain no credentials or private card content. To run the same integration suite
against an installed tarball, set `CARDSTOCK_TEST_ENTRY` to its absolute
`dist/index.js` path, then run
`node --test packages/cli/test/cli.test.mjs packages/cli/test/preview.test.mjs`.

This stage preserves mapping configuration but does not add remote sync or retire
the Python clients. Mapping execution through the API and three-way sync remain
separate implementation stages.

## Sync previews (#17)

`packages/core/src/sync-plan.ts` compares local, baseline and remote cards per
field without filesystem or network operations. `packages/cli/src/preview.ts`
reads credentials and snapshots, checks the board scope and snapshot consistency,
and formats the resulting plan. Both `status` and `sync --dry-run` call that path.
They do not POST to the API's import planner or write any local state.

An explicit `baseline` command records only fully agreed, valid state. The
baseline contract stores remote Markdown, revisions and local filenames, scoped
by remote/project/board/tracker/mapping. Writes take a per-baseline lock, compare
the originally read state and atomically rename a temporary file. #18 can reuse
the contract, but must advance it only after verifying applied results.

The client re-reads both metadata and card payloads because older server ETags do
not capture every vocabulary edit. A changing snapshot or tracker aborts preview.
This is a stable observed snapshot, not a transaction lock on the board; #18 must
still enforce server revisions when applying changes. API identity currently uses
external IDs; detecting deletion/recreation under a reused ID will require an
immutable remote identity in the later sync integration.

Core tests exercise three-way decisions, identity collisions, missing files and
unknown fields. Node integration tests run a local HTTP server with isolated
credentials and assert that previews make only GET requests and preserve local
files/baselines. No production tokens or board writes are needed for those tests.

## Board API

The web application exposes a versioned API for future CLI sync commands at
`/api/v1`. Create a personal access token in **Profile → CLI tokens**. The
plaintext token has the shape `cst_<id8>_<secret43>` and is shown once; only a
SHA-256 hash is stored. Revoke it from the same page when it is no longer used.

Send it on every request:

```sh
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/boards
```

| Route | Response |
| --- | --- |
| `GET /api/v1/boards` | Projects and boards visible to the token holder. |
| `GET /api/v1/boards/:project/:board` | Lanes, tags, epics, roster, settings, and an etag. |
| `GET /api/v1/boards/:project/:board/cards` | Markdown cards with each card's revision and the board etag. |
| `POST /api/v1/boards/:project/:board/sync` | A plan, or a revision-checked write when `apply` is true. |

For example, a dry run sends:

```json
{ "apply": false, "cards": [{ "externalId": "16", "markdown": "---\nid: 16\n…" }] }
```

An applied change must quote the `revision` returned by the snapshot for every
changed card. Missing revisions return `409 conflict` with
`details.code = "revision_required"`; stale revisions return `409` and list
the conflicting cards alongside any cards that were already applied.

Errors always have the form `{ "error": { "code", "message", "details"? } }`.
The API uses `unauthenticated` (401), `forbidden` (403), `not_found` (404),
`invalid_request` (422), and `conflict` (409). See
[`docs/specs/2026-09-06-authenticated-board-api-design.md`](specs/2026-09-06-authenticated-board-api-design.md)
for the rationale and compatibility rules.

### Browser sign-in

Run `cardstock login --remote https://your-cardstock.example` to authorize the
CLI through an existing Cardstock browser session. The CLI starts a ten-minute,
single-use device request, opens its approval page, and polls until approval.
It stores the resulting personal access token in the operating system's user
configuration directory, never beside `cardstock.json` or the tracker.

`cardstock logout --remote …` revokes the stored token from the website and
removes its local copy. A token can also be revoked from **Profile → CLI
tokens**.
