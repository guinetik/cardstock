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
`init`, `validate`, `--help`, and `--version` (`-v`). See the CLI README for usage
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
