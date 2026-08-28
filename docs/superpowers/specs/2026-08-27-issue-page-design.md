# Issue page — body editor and comments

**Date:** 2026-08-27
**Status:** approved in conversation; implementation follows this document.
**Origin:** the card detail route (`/p/[project]/b/[board]/c/[externalId]`) renders `body_md` as read-only HTML. The tracker file is still the narrative source; people and agents should be able to edit that narrative in the app and leave a comment thread that round-trips in the same `.md`.

---

## The problem

The issue page already edits summary, ratings, dates, tags, and archive. The markdown body — `## Ask`, `## Status`, the words a person or an agent actually works from — is display-only. There is no place on the hosted board to leave a note that will still be there when someone opens the tracker file.

Comments do not belong in a separate table. The tracker is one file per item; the conversation has to live at the bottom of that file so git, agents, and the board see the same thread.

## What we're building

On the issue page:

1. **Read the body by default.** An **Edit** control opens a markdown-native WYSIWYG (MDXEditor). **Save** / **Cancel** commit or discard. Markdown is the stored format.
2. **Append-only comments** in the same `body_md` blob, after a `## Comments` heading. A composer under the thread posts one block. No edit, no delete, no replies.

Postgres is the working copy. `etl:export` writes the body back into the tracker file **only after** someone has edited or commented in the app. Import then leaves that body alone (`body_edited_at`, same rule as `summary_edited_at`).

Out of scope: editing title/status/epic from the WYSIWYG, comment threading, comment edit/delete, notifications, writing files from Vercel, attachments.

---

## Decisions taken

1. **Board wins the body** once `body_edited_at` is set. Markdown seeds it; later imports do not overwrite `body_md`. Agents who comment in the file after the board owns the body are ignored until the next export. Same contract as summary.
2. **True WYSIWYG** for the body. Headings, bold, and lists look like the published article while typing. MDXEditor, not TipTap (HTML-native serializers mangle `## Ask` and `[[wiki-links]]`) and not a split markdown pane.
3. **Append-only comments.** The file is a log.
4. **Read, then Edit.** The page is a reading surface. The editor is an explicit mode, not autosave-on-blur.
5. **One `body_md` blob** with a `## Comments` suffix. Not a `comments_md` column, not `card_events` as the source of the thread.
6. **Comments are not inside the WYSIWYG.** The editor sees only the issue body. Save joins that markdown to the comments suffix currently in the database (not the suffix from when Edit was opened), so a comment posted during an edit is kept.

---

## File format

Tracker files keep frontmatter as they are today. After the closing `---`, the body looks like this once someone has commented:

```markdown
# #1 — Sign-up form loses what you typed when the email is invalid

## Ask

…

## Status

…

## Comments

### 2026-08-27 23:38 · joao@staffeto.com

> Need a decision on the API shape before we estimate.

### 2026-08-27 23:45 · sam@staffeto.com

> Let's lock POST /signup this week.
```

### Fence

- A comments fence is a line that matches `^## Comments\s*$`.
- Split on the **last** such line in the file so an accidental `## Comments` in Ask is less likely to steal the thread.
- If there is no fence, the whole `body_md` is the issue body and the comment list is empty.
- Do not write a fence until the first comment exists. An empty thread is absence of the heading, not `## Comments` with nothing under it.

### Comment block

- Heading: `### YYYY-MM-DD HH:mm · {email}`
- Timestamp is **UTC**, 24-hour, minutes precision, no timezone suffix in the heading (the format is the contract).
- `{email}` is the signed-in member's email (the rest of the heading line after ` · `).
- Body is a markdown blockquote: every line of the comment prefixed with `> `. Multi-line comments are multiple `>` lines. A blank line inside a comment is `>`.
- Blocks are appended in time order. Never rewrite an earlier block.

### What `body_md` stores

`cards.body_md` holds the issue body **plus** the comments suffix when present. It does **not** include the tracker H1 (`# #n — title`). Import already strips that H1 (`bodyWithoutH1`). Export prepends it when rewriting the file:

`# #{external_id} — {title}`

followed by a blank line, then `body_md`. The em dash matches the example tracker.

---

## Parser

`src/lib/issue-body.ts` is the only module that knows the comments fence. The page, Save, Post, and tests import it. ETL does not parse comments; it treats `body_md` as one string.

```ts
type IssueComment = {
  at: string;     // "2026-08-27 23:38"
  author: string; // email
  text: string;   // comment markdown, without leading "> "
};

function splitIssueBody(md: string): {
  body: string;
  comments: IssueComment[];
  leftover: string;
};

function joinIssueBody(
  body: string,
  comments: IssueComment[],
  leftover?: string,
): string;
```

- `splitIssueBody` trims trailing whitespace on the issue body.
- After the fence, parse well-formed blocks from the top of the suffix. A well-formed block is a heading matching `^### (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (.+)$` followed by one or more blockquote lines (`>` / `> `). The first line that cannot start a block, and everything after it, is `leftover` (the unparsed tail). The UI renders leftover as one extra markdown chunk. Nothing after the fence is dropped.
- `joinIssueBody` emits the body; if there are comments or leftover, a blank line, `## Comments`, a blank line, each comment block separated by a blank line, then leftover unchanged. No fence when both comments and leftover are empty.
- New comments are always well-formed `IssueComment` values. Post appends to `comments` and joins with leftover still last.
- Round-trip: for a well-formed suffix, `joinIssueBody(split.body, split.comments, split.leftover)` equals the input aside from trailing whitespace. Messy files keep the unparsed tail after the parsed prefix.

---

## Database

New migration, same shape as `summary_edited_at`:

```sql
alter table public.cards
  add column if not exists body_edited_at timestamptz;

comment on column public.cards.body_edited_at is
  'When a person last edited the body or posted a comment in the app. Null: markdown still owns body_md.';
```

No new table. RLS unchanged: members already update `cards` on their project.

Stamp `body_edited_at` on Save body **and** on Post comment. Null means the next import may replace `body_md` from the file.

---

## Issue page

Route unchanged: `/p/[project]/b/[board]/c/[externalId]`. Metadata, tags, archive, and history stay as they are.

Below the definition list:

1. **Article** — rendered issue body only (`splitIssueBody(body_md).body`), wiki-links still reduced to bold, `.prose` as today. The `## Comments` heading is not shown here.
2. **Edit** — `paper-link` / small button next to the article. Enters edit mode.
3. **Comments** — heading, then each comment (timestamp + email, then blockquote rendered with the same prose map). Then leftover, if any. Then the composer.

### Read vs edit

```
[ article: rendered body ]
[ Edit ]

── Comments ──
  {comments}

[ textarea ]  [ Post ]
```

Edit mode replaces the article with MDXEditor. **Save** and **Cancel** sit on that chrome. The comments thread and composer stay mounted.

- **Save** — take markdown from the editor; `splitIssueBody` the current `body_md` from the database (not the client snapshot); `joinIssueBody(edited, comments, leftover)`; write `body_md`; set `body_edited_at`; `card_events` `kind: 'edited'` with payload `{ body: true }` only — never the full markdown.
- **Cancel** — drop the draft, back to read mode. No write.
- Empty body is allowed.
- No autosave.

### Composer

- Plain `<textarea>`. Markdown is allowed; it is stored as a blockquote, not run through MDXEditor.
- **Post** on empty/whitespace: no write, inline “Write a comment first.”
- **Post** on success: append one `IssueComment` (`at` = UTC now floored to the minute, `author` = member email, `text` = trimmed composer value), join, write `body_md`, set `body_edited_at`, `card_events` `kind: 'commented'` with `{ author, at, preview }` where `preview` is the first 80 characters of `text`. Clear the composer. Refresh. Joining always prefixes every line of `text` with `> `.
- Empty thread: the Comments heading and the composer still show. No placeholder card.

### Editor

- **MDXEditor** (`@mdxeditor/editor`), loaded with `next/dynamic` `{ ssr: false }`.
- Until it hydrates, keep showing the read article (do not flash an empty box).
- If the editor fails to load, stay in read mode and show “Couldn’t open the editor.”
- Toolbar: headings, bold, italic, lists, links, inline code / code block. No image upload, no frontmatter plugin, no diff source mode required.
- Wiki-links stay literal `[[target]]` / `[[target|label]]` in the markdown. Read view still replaces them with bold, as today.
- Chrome uses paper tokens: `.prose` ink, `--surface-input` / `--border-input` for the well, radii within the theme cap (2px). It must not look like a second app (no default MDXEditor large radius / unrelated font). Theme-discipline tests may assert the card page still does not use `text-primary` for tags; do not weaken that.

---

## Server actions

Keep `updateCard` for metadata (summary, priority, …). Do not send `body_md` through it — its event payload is the patch, and the body is too large.

| Action | Writes | Event |
|---|---|---|
| `updateCardBody(cardId, bodyMarkdown)` | `body_md` (joined with latest comments + leftover), `body_edited_at` | `edited` `{ body: true }` |
| `addCardComment(cardId, text)` | `body_md` (append one block), `body_edited_at` | `commented` `{ author, at, preview }` |

Both require a signed-in project member (same `ctx()` as `updateCard`). Both `router.refresh()` on the client after success.

---

## ETL

### Import — `bodyOnImport`

In `etl/mapping.ts`, next to `summaryOnImport`:

```ts
function bodyOnImport(
  prev: { body_md: string; body_edited_at: string | null } | null,
  fileBody: string,
): string | undefined
```

- No previous row: return `fileBody` (already `bodyWithoutH1`).
- `prev.body_edited_at` set: return `undefined` (leave the column alone).
- Otherwise: return `fileBody`.

`etl/import.ts` assigns `body_md` only when this returns a string. Title, status, tags, and other markdown-owned fields still update. Hash-identical files still skip the whole card.

### Export

Today the exporter rewrites frontmatter managed keys and leaves the body byte-identical.

When `body_edited_at` is set, after `writeManaged`, replace everything after the closing frontmatter fence with:

```
{nl}# #{external_id} — {title}{nl}{nl}{body_md}
```

Normalize trailing newlines to a single trailing newline.

When `body_edited_at` is null, do not touch the body (current behaviour). Untouched files stay byte-identical aside from managed frontmatter.

Cards with no file are still reported as missing. Body export does not create files.

Select `body_md`, `body_edited_at`, and `title` on the export query in addition to the fields it already loads.

---

## Errors

- Empty comment: no write, inline message.
- Editor load failure: remain in read mode, “Couldn’t open the editor.”
- Messy suffix: leftover chunk in the thread, never dropped.
- Concurrent body saves: last write wins (same as summary). Concurrent comment vs body: Save re-reads comments from the DB so a comment posted during edit survives.
- Import/export: existing behaviour (named file, abort on parse failure).

---

## Testing

### Unit (`bun test`)

- `splitIssueBody` / `joinIssueBody`: no comments; one comment; two comments; last `## Comments` wins; leftover preserved; round-trip identity aside from trailing whitespace.
- `bodyOnImport`: skip when stamped; take the file when not; new card takes the file.
- Export: stamped card rewrites body and restores H1; unstamped body unchanged; managed frontmatter still written.

### Playwright

Against the card page:

1. Open an issue. Body is rendered. Click Edit, change a heading, Save. Reload: the heading is there.
2. Post a comment. It appears in the thread with the member email. Reload: still there.
3. Edit the body again after a comment exists. Save. The comment is still in the thread (join used the latest suffix).

Do not require asserting the `.md` file on disk in e2e; that is the ETL unit tests.

---

## Docs to update at implementation

- `docs/card-detail.md` — Edit mode, comments thread, composer.
- `docs/specs/2026-08-26-cardstock-design.md` — card detail bullet: body is editable; comments live in `body_md`; `body_edited_at`; export writes the body when stamped.
- This file stays the implementation contract.
