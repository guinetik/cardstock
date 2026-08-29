# Board import and export — sheets in, sheets out

**Date:** 2026-08-29
**Status:** approved in conversation; implementation follows this document.
**Origin:** the round trip lives in `etl/` and runs only on the engineer's laptop with the service-role key. The projects page can create boards and export CSV, but cannot take a folder of markdown in or give one back. The "Import project" dialog promises a zip drop and documents a command line instead. See `docs/fichario.md`: a card is a loose sheet, and a sheet must be able to leave the binder and come back.

---

## The problem

A project member who has a folder of `<n>.md` files has no way to file them on a board without the engineer. A project member who wants the sheets back — to edit in git, to hand to an agent, to leave — gets CSV. Both halves exist as scripts; neither exists as a button. And the only person who can run the scripts is the sync loop.

## What we're building

Three affordances on the projects page, all built on one shared importer and one shared writer:

1. **Board import** — on a board tab: drop a zip (or folder) of `<n>.md`; see a dry-run table of what would happen to every card, lane and tag; confirm; it lands.
2. **Board export** — on a board tab: download a zip of `<n>.md`, one per card, where an untouched sheet comes back byte-identical and an edited one differs only where the board made a mark.
3. **Project import** — the existing grey button: drop the same kind of zip, name the project and its first board, and get a binder whose lanes and tag groups come from the sheets, through the same dry-run table.

Owner-only for project import (it sits beside "New project"); owner or project admin for board import and export (the same people who can create boards).

The CLI (`etl:import`, `etl:export`) keeps working and is rebuilt on the same modules, so there is one set of rules.

---

## Decisions taken

1. **The sheet wins on import.** A web import is a deliberate act — someone chose a folder and pressed a button — so every key the file states replaces what the board has, including lane, rank, priority, effort, target, tags and body. This differs from the CLI sync, where the board owns lane and a file only moves a card when it has changed its mind. The CLI keeps its merge rule; the web import does not need one.
2. **A key the file does not state is left alone.** Absence is not a value. A file without `priority:` does not clear a priority.
3. **Import never deletes.** Not cards, not lanes, not tags. A card missing from the zip is untouched.
4. **Dry run first, always.** The dialog plans, shows the plan, and only then applies. The apply re-plans server-side from the same upload; nothing the browser saw is trusted.
5. **All or nothing.** One file failing validation blocks the whole import. A partial stack is not filed.
6. **The sheet is stored.** `cards.source_text` keeps the raw file as uploaded. It is the base the export is written from, not the truth — the row is the truth.
7. **Export is a line edit of the sheet, not a render of the row.** Only keys whose value the board disagrees with are rewritten, in place. Unknown keys and unchanged lines are byte-identical. The body is replaced only when it changed, and an append (a comment) is written as an append.
8. **Export rebases.** After a download, `source_text` becomes the exported text and `lane_from_source` the lane. Export → import → export is a fixed point.
9. **The zod schema is the contract.** `frontmatterSchema` moves to `src/lib/frontmatter/schema.ts`. It validates imports, decides the key order of new files, generates the dialog's instructions and `docs/frontmatter.schema.json`, and types the plan's diff. A drift test fails if the JSON file is stale.
10. **`tracker-item` is no longer required.** It was the Staffeto wiki's own validator rule; inside cardstock it meant nothing. It is an ordinary tag now. Fixtures and tests that carried it only to pass are updated.
11. **Zip parsed on the server with `fflate`.** No native dependencies, no client bundle cost. Uploads over 4 MB are refused with a message; a markdown tracker is well under.
12. **A lane the board lacks is created as `work`**, named from its key, inserted before the first built/done/archive lane. A `group:tag` the board lacks creates the group (next position, next hue) and the tag. A bare tag no group declares is reported as not applied — the product does not guess concepts. Same rule as the CLI.
13. **No compensating delete on project import.** If applying cards fails after the project and board exist, the empty project stays and the dialog says so. Deleting a project is the owner's decision, never a side effect.

---

## Modules

All under `src/lib/frontmatter/` (schema, parser, writer) and `src/lib/import/` (planner, applier, zip). `etl/*.ts` become thin CLI wrappers that read a directory, call these, and print.

### `src/lib/frontmatter/`

- `schema.ts` — `frontmatterSchema`, `STATUSES`, `KNOWN_KEYS`, `MANAGED_KEYS`, `validateFrontmatter`, `jsonSchema`, `isoOrNull`. Moved from `etl/schema.ts`; the `tracker-item` refine removed.
- `parse.ts` — `parseFile`, `extractAsk`, `bodyWithoutH1`. Moved. The sha256 is computed with the Web Crypto API so it runs in a server action.
- `write.ts` — the writer, three functions:
  - `cardToMarkdown(card): string` — a complete file from a row: keys in `KNOWN_KEYS` order, then `frontmatter_extra` verbatim, then the managed block, then `# #n — title`, then `body_md`. Used when there is no `source_text`. Supersedes `createNewCardMarkdown`.
  - `writeSheet(sourceText, card): string` — the line edit described under *Export algorithm*. Supersedes `writeManaged` + `writeBody`.
  - `formatScalar` as today.

### `src/lib/import/`

- `zip.ts` — `filesFromZip(bytes): SheetFile[]` where `SheetFile = { name: string; text: string }`. Accepts any folder depth; keeps only entries whose basename is `<positive integer>.md`; rejects a zip with none, or over the size cap.
- `plan.ts` — pure. `planImport(files, board): Plan`.

  ```ts
  interface BoardState {
    lanes: { id; key; kind; position }[];
    groups: { id; key; position; color; tags: { id; key }[] }[];
    cards: Map<externalId, ExistingCard>;   // the columns the planner compares
    epics: Map<sourceName, id>;
  }
  interface Plan {
    ok: boolean;                              // false if any row is an error
    rows: PlanRow[];
    newLanes: { key; name; position }[];
    newGroups: { key; name; position; color }[];
    newTags: { groupKey; key; name }[];
    unappliedTags: { ref; cards: string[] }[];
    ambiguousTags: { tag; cards: string[] }[];
    counts: { new; changed; unchanged; error };
  }
  type PlanRow =
    | { id; title; verdict: "new"; lane; changes: Change[] }
    | { id; title; verdict: "changed"; changes: Change[] }
    | { id; title; verdict: "unchanged" }
    | { id; title?; verdict: "error"; message };
  interface Change { key: keyof Frontmatter | "body" | "tags"; from?: string; to?: string }
  ```

  Rules: `source_hash` equal → unchanged. Otherwise every schema key present in the file is compared, normalized, against the row; a difference is a `Change`. `body` compares `bodyWithoutH1(file body)` to `body_md`. `tags` compares the resolved ref set. Lanes and tags to create are collected across all rows and deduplicated. Validation errors become error rows; the id-versus-filename check too.

- `apply.ts` — `applyPlan(db, board, files, plan, actor)`. Creates lanes, groups and tags first, then upserts cards in file order (rank rules as the CLI: file rank if it names the card's lane, else appended), replaces `card_tags`, rewrites `relates` links after all ids are known, writes one `card_events` row per created/changed card (`kind: created | imported`, `actor: <member email>`, payload `{ source: "<n>.md", hash, changes }`), sets `source_text`, `source_hash`, `source_path: "<n>.md"`, `lane_from_source`. A changed body sets `body_md` and clears `body_edited_at`. Runs with the member's RLS client.

### Export algorithm — `writeSheet(sourceText, card)`

Let `fm = parseFile(sourceText).frontmatter`, `srcBody = parseFile(sourceText).body`, `nl` = the file's line ending.

1. **Frontmatter, key by key, schema order.** For each key in `KNOWN_KEYS` ∪ `MANAGED_KEYS`:
   - `want` = the row's value in file form (`P2` → `2`, dates ISO, tags as refs, `null` when unset).
   - `have` = `fm[key]`, normalized the same way.
   - equal → the line(s) stay exactly as they are.
   - differ, key present → the line is rewritten in place; a list is rewritten across its existing `- item` lines (file order kept for surviving items, new items appended).
   - differ, key absent, `want` non-null → appended before the closing fence, in schema order relative to other appended keys.
   - differ, `want` null → the line(s) removed.
   - Keys not in the schema are never touched.
2. **Body.** Let `base = bodyWithoutH1(srcBody)`.
   - `body_md === base` → body bytes untouched.
   - `body_md.startsWith(base)` → original body bytes + the tail (`body_md.slice(base.length)`), line endings converted to `nl`. A posted comment is written as exactly the appended lines.
   - otherwise → `# #n — title`, blank line, `body_md` (as `writeBody` today).
3. **Trailing newline** preserved as in the source.

A card with no `source_text` is written with `cardToMarkdown`.

After writing, the exporter updates `source_text` to the output and `lane_from_source` to the lane key.

### Guarantees, as tests (`src/lib/frontmatter/write.test.ts`, fixtures from `examples/tracker`)

- import → export with no activity → every file byte-identical.
- import → set priority on the site → export → exactly one frontmatter line differs.
- import → post a comment → export → the diff is only the appended `## Comments` lines.
- import → move to another lane → export → only `lane:` and `rank:` differ.
- export → import that export → plan counts `changed: 0, error: 0`.
- a file with an unknown key `foo: bar` keeps it verbatim through import → edit → export.
- CRLF file stays CRLF.

---

## Server surface

`src/app/import-actions.ts` (`"use server"`):

- `planBoardImport(form: FormData) → Plan | { error }` — fields `boardId`, `file`. Loads `BoardState` through the member's client, unzips, plans. Errors: not an owner or project admin, not a zip, no sheets, too large.
- `applyBoardImport(form: FormData) → { ok; counts } | { error }` — same fields. Re-plans; refuses if `plan.ok` is false; applies; `revalidatePath("/")` and the board path.
- `planProjectImport(form)` — fields `name`, `boardName`, `file`. Owner only. Plans against a *virtual* fresh board (the five default lanes from `create_board`, no groups) so the table can be shown before anything is created.
- `applyProjectImport(form)` — owner only. `create_project` RPC, `create_board` RPC, load the real `BoardState`, re-plan, apply, redirect to the board. On apply failure returns `{ error, projectSlug }` and the dialog says the project exists and is empty.

`src/app/p/[project]/b/[board]/export.zip/route.ts` — `GET`, member only. Loads every card (archived included) with `source_text`, writes each sheet, builds the zip with `fflate`, streams `attachment; filename="<project>-<board>-<date>.zip"`, then rebases `source_text`/`lane_from_source` for the exported cards.

---

## Database

Migration `20260903000000_source_text.sql`: `alter table cards add column source_text text;` No backfill — cards imported before this have no sheet and export via `cardToMarkdown` until the next import or export stores one. Members can already `update` cards under RLS, so no policy change.

---

## UI (Paper)

On each board tab in `Binder` (`src/components/binder.tsx`), two small controls in the tab's footer beside the card count: **Download** (`↓`, link to `export.zip`) and **Import** (`↑`, opens `BoardImportDialog`).

`BoardImportDialog` (`src/components/board-import-dialog.tsx`), three states on one sheet:

1. **Drop.** A dashed `--surface-well` dropzone: *"Drop a zip of the tracker — one `<n>.md` per card."* Beside it, the contract rendered from `jsonSchema()`: required keys with their enums, optional keys, managed keys marked *written by the board*, and one sample file from `cardToMarkdown()` on a fixture. Choose-file fallback.
2. **Plan.** Heading *Importing into <board>*. Above the table, the side effects as `.stat`s: *3 lanes to create · 2 tags to create · 1 tag not applied*, each expanding to its list. The table: `#id` (mono) · title · verdict as a `.stat` in pen (new green, changed amber, unchanged hairline, error red) · changes as mono `key: from → to` chips. Footer: counts, *Cancel*, *Import N cards* (disabled when any row is an error, with the reason).
3. **Done.** Counts, link to the board. Errors from the server render on the sheet, never as a toast.

`ImportProjectDialog` is rewritten: the same dropzone and contract panel, plus *Project name* and *First board name* fields (validated with `cleanName`/`keyFromName` like `CreateProjectDialog`), then the same plan table, then *Create project and import N cards*. The command-line explainer moves to `README.md` under ETL.

The file is held in component state; both plan and apply post it. No upload survives a reload.

---

## Testing

- **Unit** (`bun test`): `plan.test.ts` — new/changed/unchanged/error rows, absent key leaves value, lane and group creation, bare-tag reporting, id/filename mismatch, blocked plan. `write.test.ts` — the guarantees above. `zip.test.ts` — nested folders, non-sheet files ignored, empty zip rejected. `schema-discipline.test.ts` — `docs/frontmatter.schema.json` equals `jsonSchema()`. Existing `etl/*.test.ts` move with their modules and lose `tracker-item`.
- **E2E** (Playwright): import `examples/tracker` as a zip into the demo board — table shows all unchanged after seed; edit one fixture, re-import — one changed row, board reflects it; download `export.zip` — a file in it matches the fixture byte-for-byte; import a zip as a new project — project and board exist with the cards. Selectors stay stable: "Import project", "New project", "New board", label "Name".
- `bun run check` green.

---

## Out of scope

Deleting cards through import; importing attachments or images; a background/scheduled sync; exports of a filtered subset (CSV already does that); merging two uploads three-way. Uploads over the cap go through the CLI.
