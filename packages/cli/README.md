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
Board-specific workflow rules and tag vocabularies are not validated yet.
Exit codes: 0 success, 1 invalid issues, 2 command/configuration/filesystem error.

## Sign in

`cardstock login` opens the Cardstock website for approval. Sign in with your
existing Cardstock account, approve the request, then return to the terminal.
The credential is a personal access token saved in your user configuration
directory, outside the tracker and repository. `cardstock logout` revokes that
token remotely and removes the local credential.

Pass `--remote` or configure a `remote` URL with `cardstock init`. Use
`--no-browser` to print the approval URL without opening it.
