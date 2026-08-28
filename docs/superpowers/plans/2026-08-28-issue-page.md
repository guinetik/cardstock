# Issue page — body editor and comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people edit a card's markdown body in a WYSIWYG and append comments that live in the same `body_md` / tracker file after `## Comments`.

**Architecture:** `src/lib/issue-body.ts` splits and joins the comments suffix. The issue page reads the body, edits it in MDXEditor, and posts comments through two server actions that rewrite `body_md` and stamp `body_edited_at`. Import skips that column once stamped; export writes the body (with the tracker H1 restored) only when stamped.

**Tech Stack:** Next.js 16.3 App Router · React 19 · `@mdxeditor/editor` · `marked` · bun 1.4 `bun test` · Playwright · Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-08-27-issue-page-design.md`

## Global Constraints

- JSDoc on every exported function (match `src/lib/theme.ts`).
- `cards.body_md` never includes the tracker H1 (`# #n — title`); import still strips it; export prepends `# #{external_id} — {title}` with an em dash.
- Comments fence is a line matching `^## Comments\s*$`; split on the **last** such line.
- Comment heading is `### YYYY-MM-DD HH:mm · {email}` with a UTC timestamp floored to the minute and a middle dot (` · `, U+00B7).
- Append-only comments. No edit, no delete, no threading.
- `updateCard` stays metadata-only. Body writes go through `updateCardBody` / `addCardComment`. Event payload for a body save is `{ body: true }` — never the markdown.
- MDXEditor, not TipTap. Load with `next/dynamic` `{ ssr: false }`. Plugins must not run on the server.
- Editor chrome uses paper tokens (`--surface-input`, `--border-input`, `--color-ink`, `.prose`). Radii stay within the 2px theme cap. Do not weaken the card-editor `text-primary` theme-discipline tests.
- Run unit tests with `bun test <file>` and e2e with `bun run test:e2e`.
- Commit messages: `feat: …` / `fix: …` / `chore: …`, short.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/issue-body.ts` | `IssueComment`, `splitIssueBody`, `joinIssueBody`, `formatCommentAt` |
| `src/lib/issue-body.test.ts` | Parser round-trips |
| `etl/mapping.ts` | `bodyOnImport` next to `summaryOnImport` |
| `etl/etl.test.ts` | `bodyOnImport` cases |
| `etl/frontmatter-write.ts` | `writeBody` — replace post-frontmatter body |
| `etl/export.test.ts` | `writeBody` H1 restore / unstamped untouched |
| `etl/import.ts` | Assign `body_md` only when `bodyOnImport` returns a string |
| `etl/export.ts` | Call `writeBody` when `body_edited_at` is set |
| `supabase/migrations/20260828200000_body_edited_at.sql` | `cards.body_edited_at` |
| `src/app/p/[project]/b/[board]/actions.ts` | `updateCardBody`, `addCardComment` |
| `src/app/p/[project]/b/[board]/c/[externalId]/issue-body-editor.tsx` | Client MDXEditor + plugins (default export) |
| `src/app/p/[project]/b/[board]/c/[externalId]/issue-body-panel.tsx` | Read / Edit / Save / Cancel; dynamic-imports the editor |
| `src/app/p/[project]/b/[board]/c/[externalId]/issue-comments.tsx` | Thread, leftover, composer |
| `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx` | Split body, render panel + comments |
| `src/styles/components/paper.css` | `.issue-editor` skin for MDXEditor |
| `next.config.ts` | `transpilePackages: ["@mdxeditor/editor"]` |
| `e2e/issue-body.spec.ts` | Edit body, post comment, comment survives re-edit |
| `docs/card-detail.md` | Edit mode + comments |
| `docs/specs/2026-08-26-cardstock-design.md` | Card-detail / ETL bullets |

---

### Task 1: Issue-body parser

**Files:**
- Create: `src/lib/issue-body.ts`
- Test: `src/lib/issue-body.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type IssueComment = { at: string; author: string; text: string }`; `splitIssueBody(md: string): { body: string; comments: IssueComment[]; leftover: string }`; `joinIssueBody(body: string, comments: IssueComment[], leftover?: string): string`; `formatCommentAt(d?: Date): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/issue-body.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  formatCommentAt,
  joinIssueBody,
  splitIssueBody,
  type IssueComment,
} from "./issue-body";

const ONE: IssueComment = {
  at: "2026-08-27 23:38",
  author: "joao@staffeto.com",
  text: "Need a decision on the API shape before we estimate.",
};

const TWO: IssueComment = {
  at: "2026-08-27 23:45",
  author: "sam@staffeto.com",
  text: "Let's lock POST /signup this week.",
};

const BODY = "## Ask\n\nHello.";

const ONE_FILE = `${BODY}

## Comments

### 2026-08-27 23:38 · joao@staffeto.com

> Need a decision on the API shape before we estimate.`;

function roundTrip(md: string) {
  const s = splitIssueBody(md);
  expect(joinIssueBody(s.body, s.comments, s.leftover).trimEnd()).toBe(
    md.trimEnd(),
  );
}

describe("formatCommentAt", () => {
  test("UTC floored to the minute, no timezone suffix", () => {
    expect(formatCommentAt(new Date("2026-08-27T23:38:59.999Z"))).toBe(
      "2026-08-27 23:38",
    );
  });
});

describe("splitIssueBody / joinIssueBody", () => {
  test("no comments: whole string is the body", () => {
    const s = splitIssueBody(BODY);
    expect(s).toEqual({ body: BODY, comments: [], leftover: "" });
    expect(joinIssueBody(s.body, s.comments)).toBe(BODY);
  });

  test("one comment", () => {
    const s = splitIssueBody(ONE_FILE);
    expect(s.body).toBe(BODY);
    expect(s.comments).toEqual([ONE]);
    expect(s.leftover).toBe("");
  });

  test("two comments", () => {
    const md = joinIssueBody(BODY, [ONE, TWO]);
    const s = splitIssueBody(md);
    expect(s.comments).toEqual([ONE, TWO]);
  });

  test("last ## Comments wins", () => {
    const md = `## Ask

## Comments

still ask

## Comments

### 2026-08-27 23:38 · joao@staffeto.com

> Need a decision on the API shape before we estimate.`;
    const s = splitIssueBody(md);
    expect(s.body).toBe("## Ask\n\n## Comments\n\nstill ask");
    expect(s.comments).toEqual([ONE]);
  });

  test("unparsed tail is leftover", () => {
    const md = `${ONE_FILE}

not a comment`;
    const s = splitIssueBody(md);
    expect(s.comments).toEqual([ONE]);
    expect(s.leftover).toBe("not a comment");
  });

  test("multi-line comment uses > on every line, blank as >", () => {
    const c: IssueComment = {
      at: "2026-08-27 23:38",
      author: "a@b.com",
      text: "line one\n\nline two",
    };
    const md = joinIssueBody(BODY, [c]);
    expect(md).toContain("> line one\n>\n> line two");
    expect(splitIssueBody(md).comments[0]?.text).toBe("line one\n\nline two");
  });

  test("round-trip identity aside from trailing whitespace", () => {
    roundTrip(BODY);
    roundTrip(ONE_FILE);
    roundTrip(joinIssueBody(BODY, [ONE, TWO]));
  });

  test("no fence when comments and leftover are empty", () => {
    expect(joinIssueBody(BODY, [], "")).toBe(BODY);
    expect(joinIssueBody(BODY, [])).not.toContain("## Comments");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/issue-body.test.ts`

Expected: FAIL with a module-not-found (or `splitIssueBody` is not exported).

- [ ] **Step 3: Write the parser**

Create `src/lib/issue-body.ts`:

```ts
export type IssueComment = {
  at: string;
  author: string;
  text: string;
};

const FENCE = /^## Comments\s*$/;
const HEADING = /^### (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (.+)$/;
const QUOTE = /^>(?: |$)/;

/**
 * UTC wall time floored to the minute, as stored in comment headings.
 *
 * @param d - Instant to format; defaults to now.
 */
export function formatCommentAt(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function quoteLines(text: string): string[] {
  const lines = text.split("\n");
  if (!lines.length) return [">"];
  return lines.map((ln) => (ln === "" ? ">" : `> ${ln}`));
}

function unquoteLines(lines: string[]): string {
  return lines.map((ln) => ln.replace(/^> ?/, "")).join("\n");
}

function skipBlanks(lines: string[], i: number): number {
  while (i < lines.length && !lines[i].trim()) i++;
  return i;
}

/**
 * Split a card body into the issue markdown, parsed comments, and any unparsed tail.
 * The comments fence is the last line matching `## Comments`.
 *
 * @param md - `cards.body_md` (no tracker H1).
 */
export function splitIssueBody(md: string): {
  body: string;
  comments: IssueComment[];
  leftover: string;
} {
  const lines = md.split(/\r?\n/);
  let fence = -1;
  for (let i = 0; i < lines.length; i++) if (FENCE.test(lines[i])) fence = i;
  if (fence < 0)
    return { body: md.replace(/\s+$/, ""), comments: [], leftover: "" };

  const body = lines.slice(0, fence).join("\n").replace(/\s+$/, "");
  const suffix = lines.slice(fence + 1);
  const comments: IssueComment[] = [];
  let i = skipBlanks(suffix, 0);

  while (i < suffix.length) {
    const m = HEADING.exec(suffix[i]);
    if (!m) break;
    const start = i;
    i = skipBlanks(suffix, i + 1);
    if (i >= suffix.length || !QUOTE.test(suffix[i])) {
      i = start;
      break;
    }
    const quoted: string[] = [];
    while (i < suffix.length && QUOTE.test(suffix[i])) {
      quoted.push(suffix[i]);
      i++;
    }
    comments.push({ at: m[1], author: m[2], text: unquoteLines(quoted) });
    i = skipBlanks(suffix, i);
  }

  const leftover = suffix.slice(i).join("\n").replace(/^\s+/, "").replace(/\s+$/, "");
  return { body, comments, leftover };
}

/**
 * Join an issue body with comments (and an optional unparsed tail) into `body_md`.
 * Omits `## Comments` when both comments and leftover are empty.
 *
 * @param body - Issue markdown, no fence.
 * @param comments - Well-formed comments in time order.
 * @param leftover - Unparsed tail from `splitIssueBody`; default empty.
 */
export function joinIssueBody(
  body: string,
  comments: IssueComment[],
  leftover = "",
): string {
  const head = body.replace(/\s+$/, "");
  if (!comments.length && !leftover) return head;
  const parts: string[] = [head, "", "## Comments"];
  for (const c of comments) {
    parts.push("", `### ${c.at} · ${c.author}`, "", ...quoteLines(c.text));
  }
  if (leftover) parts.push("", leftover.replace(/\s+$/, ""));
  return parts.join("\n");
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `bun test src/lib/issue-body.test.ts`

Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/issue-body.ts src/lib/issue-body.test.ts
git commit -m "feat: split and join issue body comments"
```

---

### Task 2: Import ownership and export body rewrite (pure)

**Files:**
- Modify: `etl/mapping.ts` (append `bodyOnImport` after `summaryOnImport`)
- Modify: `etl/etl.test.ts` (import `bodyOnImport`; add a describe block after `summaryOnImport`)
- Modify: `etl/frontmatter-write.ts` (append `writeBody`)
- Modify: `etl/export.test.ts` (import `writeBody`; add tests after `writeManaged`)

**Interfaces:**
- Consumes: `bodyWithoutH1` is already used by import; this task does not call it
- Produces: `bodyOnImport(prev: { body_md: string; body_edited_at: string | null } | null, fileBody: string): string | undefined`; `writeBody(text: string, externalId: string, title: string, bodyMd: string): string`

- [ ] **Step 1: Write the failing tests**

Add to `etl/etl.test.ts` imports: `bodyOnImport` from `./mapping`.

Append:

```ts
describe("bodyOnImport", () => {
  const edited = {
    body_md: "## Ask\n\napp",
    body_edited_at: "2026-08-27T00:00:00Z",
  };
  const untouched = { body_md: "## Ask\n\nfile", body_edited_at: null };

  test("never overwrites a body edited in the app", () => {
    expect(bodyOnImport(edited, "## Ask\n\nfrom file")).toBeUndefined();
  });

  test("file wins while the app has not touched it", () => {
    expect(bodyOnImport(untouched, "## Ask\n\nfrom file")).toBe(
      "## Ask\n\nfrom file",
    );
  });

  test("new card takes the file body", () => {
    expect(bodyOnImport(null, "## Ask\n\nfrom file")).toBe("## Ask\n\nfrom file");
  });
});
```

Add to `etl/export.test.ts` imports: `writeBody` from `./frontmatter-write`.

Append:

```ts
describe("writeBody", () => {
  test("replaces the body and restores the tracker H1", () => {
    const out = writeBody(FILE, "152", "Filter what to sync", "## Ask\n\nEdited.");
    const { body } = parseFile(out);
    expect(body.trim()).toBe(
      "# #152 — Filter what to sync\n\n## Ask\n\nEdited.",
    );
    expect(parseFile(out).frontmatter.id).toBe("152");
  });

  test("keeps CRLF files CRLF", () => {
    const crlf = FILE.replace(/\n/g, "\r\n");
    const out = writeBody(crlf, "152", "Filter what to sync", "## Ask");
    expect(out.includes("\r\n")).toBe(true);
    expect(out.split("\r\n").join("").includes("\n")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test etl/etl.test.ts etl/export.test.ts`

Expected: FAIL — `bodyOnImport` / `writeBody` not exported.

- [ ] **Step 3: Implement**

Append to `etl/mapping.ts`:

```ts
/**
 * What an import should write to `body_md`, or `undefined` to leave it alone.
 *
 * Once someone edits the body or posts a comment in the app, the database owns
 * `body_md`. The exporter writes it back; an import must not replace it.
 *
 * @param prev - Existing card, or `null` for a create.
 * @param fileBody - `bodyWithoutH1` of the tracker file.
 */
export function bodyOnImport(
  prev: { body_md: string; body_edited_at: string | null } | null,
  fileBody: string,
): string | undefined {
  if (!prev) return fileBody;
  if (prev.body_edited_at) return undefined;
  return fileBody;
}
```

Append to `etl/frontmatter-write.ts` (after `formatScalar`):

```ts
/**
 * Replace everything after the closing frontmatter fence with the tracker H1
 * plus `bodyMd`. Used only when the app owns the body (`body_edited_at` set).
 *
 * @param text - Full file (frontmatter + old body).
 * @param externalId - Tracker id, used in `# #n — title`.
 * @param title - Card title.
 * @param bodyMd - `cards.body_md` (no H1).
 */
export function writeBody(
  text: string,
  externalId: string,
  title: string,
  bodyMd: string,
): string {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---")
    throw new Error("file does not open with a --- frontmatter fence");
  let end = -1;
  for (let i = 1; i < lines.length; i++)
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  if (end < 0) throw new Error("frontmatter fence is never closed");
  const body = bodyMd.replace(/\r?\n/g, nl).replace(/(\r?\n)+$/, "");
  const h1 = `# #${externalId} — ${title}`;
  const out = [...lines.slice(0, end + 1), h1, "", body].join(nl);
  return out.endsWith(nl) ? out : `${out}${nl}`;
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `bun test etl/etl.test.ts etl/export.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add etl/mapping.ts etl/etl.test.ts etl/frontmatter-write.ts etl/export.test.ts
git commit -m "feat: body import ownership and export rewrite"
```

---

### Task 3: Migration and ETL wiring

**Files:**
- Create: `supabase/migrations/20260828200000_body_edited_at.sql`
- Modify: `etl/import.ts` (select `body_md, body_edited_at`; call `bodyOnImport`; file header comment)
- Modify: `etl/export.ts` (select extra columns; call `writeBody` after `writeManaged`)

**Interfaces:**
- Consumes: `bodyOnImport` from Task 2; `writeBody` from Task 2
- Produces: `cards.body_edited_at timestamptz`; import skips `body_md` when stamped; export rewrites body when stamped

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260828200000_body_edited_at.sql`:

```sql
-- The card body is editable on the issue page, and comments are stored in the
-- same body_md blob. The database has to tell a body a person typed from one
-- seeded out of markdown, or the next import would wipe comments.
--
-- Null means "still owned by markdown". Set means a person edited the body or
-- posted a comment here; from then on the app owns it and the exporter writes
-- it back out.

alter table public.cards
  add column if not exists body_edited_at timestamptz;

comment on column public.cards.body_edited_at is
  'When a person last edited the body or posted a comment in the app. Null: markdown still owns body_md.';
```

Apply locally:

Run: `bun run db:reset`

Expected: migrations (including this one) + seed apply. Local `cards` has `body_edited_at`.

- [ ] **Step 2: Wire import**

In `etl/import.ts`:

1. Import `bodyOnImport` from `./mapping`.
2. Change the file header to: `DB owns: … summary (once edited in the app), body_md (once body_edited_at is set), archive.`
3. Add `body_md, body_edited_at` to the existing-cards select string (the one that already lists `summary, summary_edited_at, audience`).
4. In the `row` object, **do not** always set `body_md`. After `row` is built (and after the `prev` / new-card branch), add:

```ts
  const fileBody = bodyWithoutH1(parsed.body);
  const nextBody = bodyOnImport(
    prev
      ? { body_md: prev.body_md, body_edited_at: prev.body_edited_at }
      : null,
    fileBody,
  );
  if (nextBody !== undefined) row.body_md = nextBody;
```

5. Remove `body_md: bodyWithoutH1(parsed.body)` from the initial `row` literal so a stamped update does not send the file body.

`prev` comes from `existing.get` — that map is filled from the select. TypeScript may infer `any`/row objects; pass `body_md` and `body_edited_at` through. If `existing` rows are untyped `Record`s, read them as `prev.body_md as string` and `prev.body_edited_at as string | null`.

- [ ] **Step 3: Wire export**

In `etl/export.ts`:

1. Import `writeBody` from `./frontmatter-write`.
2. Add `body_md, body_edited_at, title` to the cards select.
3. After `const after = writeManaged(before, managed);` compute the file to write:

```ts
  const rewritten =
    c.body_edited_at != null
      ? writeBody(after, c.external_id, c.title, c.body_md ?? "")
      : after;
```

4. Compare `rewritten === before` for the unchanged counter (replace uses of `after` for write/compare with `rewritten`). Dry-run log can stay as-is (frontmatter-focused) or mention `body` when `c.body_edited_at` is set — if you add a log, keep it one line.

- [ ] **Step 4: Re-run unit tests**

Run: `bun test etl/etl.test.ts etl/export.test.ts src/lib/issue-body.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260828200000_body_edited_at.sql etl/import.ts etl/export.ts
git commit -m "feat: stamp body_edited_at and round-trip body in ETL"
```

---

### Task 4: Server actions

**Files:**
- Modify: `src/app/p/[project]/b/[board]/actions.ts`

**Interfaces:**
- Consumes: `splitIssueBody`, `joinIssueBody`, `formatCommentAt` from `src/lib/issue-body.ts`; existing `ctx`, `UUID`, `Result`
- Produces: `updateCardBody(cardId: string, bodyMarkdown: string): Promise<Result>`; `addCardComment(cardId: string, text: string): Promise<Result>`

- [ ] **Step 1: Add the two actions after `updateCard`**

Do **not** extend `updateCard` with `body_md`. Append:

```ts
/**
 * Replace the issue body, keeping the comments suffix currently in the database.
 *
 * @param cardId - Card uuid.
 * @param bodyMarkdown - New issue markdown from the WYSIWYG (no comments fence).
 */
export async function updateCardBody(
  cardId: string,
  bodyMarkdown: string,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  const { data: card } = await c.db
    .from("cards")
    .select("body_md")
    .eq("id", cardId)
    .single();
  if (!card) return { ok: false, error: "Card not found." };
  const { comments, leftover } = splitIssueBody(card.body_md ?? "");
  const body_md = joinIssueBody(bodyMarkdown, comments, leftover);
  const { error } = await c.db
    .from("cards")
    .update({ body_md, body_edited_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "edited",
    payload: { body: true },
  });
  return { ok: true };
}

/**
 * Append one comment block to `body_md`.
 *
 * @param cardId - Card uuid.
 * @param text - Composer value; whitespace-only is rejected.
 */
export async function addCardComment(
  cardId: string,
  text: string,
): Promise<Result> {
  const c = await ctx();
  if (!c) return { ok: false, error: "Not signed in." };
  if (!UUID.test(cardId)) return { ok: false, error: "Invalid card." };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Write a comment first." };
  const { data: card } = await c.db
    .from("cards")
    .select("body_md")
    .eq("id", cardId)
    .single();
  if (!card) return { ok: false, error: "Card not found." };
  const { body, comments, leftover } = splitIssueBody(card.body_md ?? "");
  const comment = {
    at: formatCommentAt(),
    author: c.me.email,
    text: trimmed,
  };
  const body_md = joinIssueBody(body, [...comments, comment], leftover);
  const { error } = await c.db
    .from("cards")
    .update({ body_md, body_edited_at: new Date().toISOString() })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  await c.db.from("card_events").insert({
    card_id: cardId,
    actor: c.me.email,
    kind: "commented",
    payload: {
      author: comment.author,
      at: comment.at,
      preview: comment.text.slice(0, 80),
    },
  });
  return { ok: true };
}
```

Add the import at the top of `actions.ts`:

```ts
import {
  formatCommentAt,
  joinIssueBody,
  splitIssueBody,
} from "@/lib/issue-body";
```

- [ ] **Step 2: Typecheck**

Run: `bun run check`

Expected: PASS (or only pre-existing issues). Fix any unused-import / type errors you introduced.

- [ ] **Step 3: Commit**

```bash
git add src/app/p/[project]/b/[board]/actions.ts
git commit -m "feat: save issue body and append comments"
```

---

### Task 5: Comments thread and composer

**Files:**
- Create: `src/app/p/[project]/b/[board]/c/[externalId]/issue-comments.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx`

**Interfaces:**
- Consumes: `splitIssueBody` on the server; `addCardComment`; `IssueComment`
- Produces: visible Comments heading, rendered comments, leftover chunk, composer with `data-testid="comment-composer"` and Post `data-testid="post-comment"`

- [ ] **Step 1: Add `issue-comments.tsx`**

```tsx
"use client";
import { marked } from "marked";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCardComment } from "@/app/p/[project]/b/[board]/actions";
import { Button } from "@/components/ui/button";
import type { IssueComment } from "@/lib/issue-body";

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Render comment markdown (already unquoted) to HTML.
 *
 * @param text - Comment body without `>` prefixes.
 */
function commentHtml(text: string): string {
  return marked.parse(
    text.replace(WIKILINK, (_m: string, t: string, l?: string) => `**${l ?? t}**`),
    { async: false, gfm: true },
  ) as string;
}

/**
 * Append-only comments thread and composer for one card.
 *
 * @param props.cardId - Card uuid.
 * @param props.comments - Parsed comments.
 * @param props.leftover - Unparsed tail of the comments section.
 */
export function IssueComments({
  cardId,
  comments,
  leftover,
}: {
  cardId: string;
  comments: IssueComment[];
  leftover: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  /**
   * Post the composer value. Empty input stays on the client.
   */
  function post() {
    if (!text.trim()) {
      setMsg("Write a comment first.");
      return;
    }
    start(async () => {
      const r = await addCardComment(cardId, text);
      if (r.ok) {
        setText("");
        setMsg(null);
        router.refresh();
      } else setMsg(r.error);
    });
  }

  return (
    <section className="mt-8 border-t border-[var(--border-hairline)] pt-5">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
        Comments
      </h2>
      <ol className="space-y-4" data-testid="comment-thread">
        {comments.map((c) => (
          <li key={`${c.at}-${c.author}-${c.text.slice(0, 24)}`}>
            <p className="text-xs text-[var(--color-grey)]">
              <time className="font-mono">{c.at}</time>
              {" · "}
              {c.author}
            </p>
            <div
              className="prose prose-sm mt-1 max-w-none"
              dangerouslySetInnerHTML={{ __html: commentHtml(c.text) }}
            />
          </li>
        ))}
      </ol>
      {leftover ? (
        <div
          className="prose prose-sm mt-4 max-w-none"
          data-testid="comment-leftover"
          dangerouslySetInnerHTML={{
            __html: commentHtml(leftover),
          }}
        />
      ) : null}
      <div className="mt-4 space-y-2">
        <textarea
          id="comment-composer"
          data-testid="comment-composer"
          className="min-h-20 w-full rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] p-3 text-sm text-[var(--color-ink)]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            data-testid="post-comment"
            onClick={post}
          >
            Post
          </Button>
          {msg && (
            <output className="text-xs text-[var(--color-grey)]">{msg}</output>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Split the body on the page and render the thread**

In `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx`:

1. Import `splitIssueBody` from `@/lib/issue-body` and `IssueComments` from `./issue-comments`.
2. After loading `card`, compute:

```ts
  const issue = splitIssueBody(card.body_md);
  const html = marked.parse(
    issue.body.replace(
      WIKILINK,
      (_m: string, t: string, l?: string) => `**${l ?? t}**`,
    ),
    { async: false, gfm: true },
  ) as string;
```

(Replace the existing `html` that parsed `card.body_md` so comments are not in the article.)

3. After the `<article>…</article>`, before History, render:

```tsx
      <IssueComments
        cardId={card.id}
        comments={issue.comments}
        leftover={issue.leftover}
      />
```

Leave the article as-is for this task (read-only). Edit lands in Task 6.

- [ ] **Step 3: Check**

Run: `bun run check`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/p/[project]/b/[board]/c/[externalId]/issue-comments.tsx src/app/p/[project]/b/[board]/c/[externalId]/page.tsx
git commit -m "feat: issue comments thread"
```

---

### Task 6: WYSIWYG body editor

**Files:**
- Create: `src/app/p/[project]/b/[board]/c/[externalId]/issue-body-editor.tsx`
- Create: `src/app/p/[project]/b/[board]/c/[externalId]/issue-body-panel.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx`
- Modify: `src/styles/components/paper.css`
- Modify: `next.config.ts`
- Modify: `package.json` / `bun.lock` via `bun add`

**Interfaces:**
- Consumes: `updateCardBody`; `issue.body` and `html` from the page
- Produces: Edit / Save / Cancel; `data-testid="edit-issue-body"` / `data-testid="save-issue-body"` / `data-testid="issue-body-editor"`

- [ ] **Step 1: Install MDXEditor and transpile it**

Run: `bun add @mdxeditor/editor`

Set `next.config.ts` to:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mdxeditor/editor"],
};

export default nextConfig;
```

- [ ] **Step 2: Initialized editor (default export, plugins local)**

Create `issue-body-editor.tsx`. Default export is required so `next/dynamic` can load it. Do not import this file from a server component.

```tsx
"use client";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  CodeToggle,
  CreateLink,
  headingsPlugin,
  InsertCodeBlock,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  toolbarPlugin,
  UndoRedo,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

/**
 * Browser-only MDXEditor. Plugins are constructed here so they never run on the server.
 *
 * @param props.markdown - Issue body (no comments suffix).
 * @param props.onChange - Called with markdown as the user types.
 */
export default function IssueBodyEditor({
  markdown,
  onChange,
}: {
  markdown: string;
  onChange: (md: string) => void;
}) {
  return (
    <div className="issue-editor" data-testid="issue-body-editor">
      <MDXEditor
        markdown={markdown}
        onChange={onChange}
        contentEditableClassName="prose prose-sm max-w-none"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <ListsToggle />
                <CreateLink />
                <InsertCodeBlock />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Read / Edit panel**

Create `issue-body-panel.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCardBody } from "@/app/p/[project]/b/[board]/actions";
import { Button } from "@/components/ui/button";

const Editor = dynamic(() => import("./issue-body-editor"), { ssr: false });

/**
 * Issue article: read by default, MDXEditor after Edit.
 *
 * @param props.cardId - Card uuid.
 * @param props.bodyMarkdown - Issue body without comments.
 * @param props.bodyHtml - Rendered read view.
 */
export function IssueBodyPanel({
  cardId,
  bodyMarkdown,
  bodyHtml,
}: {
  cardId: string;
  bodyMarkdown: string;
  bodyHtml: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bodyMarkdown);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  /**
   * Persist the draft and return to read mode.
   */
  function save() {
    start(async () => {
      const r = await updateCardBody(cardId, draft);
      setMsg(r.ok ? null : r.error);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  /**
   * Preload the editor chunk; stay in read mode if it cannot load.
   */
  function startEdit() {
    import("./issue-body-editor")
      .then(() => {
        setDraft(bodyMarkdown);
        setEditing(true);
      })
      .catch(() => setFailed(true));
  }

  if (failed) {
    return (
      <div className="mt-6">
        <article
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        <p className="mt-2 text-xs text-[var(--color-grey)]">
          Couldn’t open the editor.
        </p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="mt-6">
        <article
          className="prose prose-sm max-w-none"
          data-testid="issue-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
        <button
          type="button"
          className="paper-link mt-2 text-xs"
          data-testid="edit-issue-body"
          onClick={startEdit}
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Editor
        markdown={draft}
        onChange={setDraft}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          data-testid="save-issue-body"
          onClick={save}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setDraft(bodyMarkdown);
            setEditing(false);
            setMsg(null);
          }}
        >
          Cancel
        </Button>
        {msg && (
          <output className="text-xs text-[var(--color-grey)]">{msg}</output>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Skin MDXEditor**

Append to `src/styles/components/paper.css`:

```css
/* MDXEditor on the issue page — paper stock, not the library's default chrome. */
.issue-editor .mdxeditor {
  --baseBg: var(--surface-input);
  --baseBorder: var(--border-input);
  --baseText: var(--color-ink);
  --baseBorderRadius: var(--radius-input);
  font-family: inherit;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-input);
  background: var(--surface-input);
  color: var(--color-ink);
}
.issue-editor .mdxeditor-toolbar {
  border-bottom: 1px solid var(--border-hairline);
  background: var(--surface-card);
  border-radius: var(--radius-input) var(--radius-input) 0 0;
}
.issue-editor .mdxeditor-root-contenteditable {
  padding: 0.75rem;
}
```

Override any library radius on this subtree so theme-discipline's 2px cap still holds:

```css
.issue-editor .mdxeditor,
.issue-editor .mdxeditor-toolbar,
.issue-editor .mdxeditor-popup-container {
  border-radius: var(--radius-input);
}
```

- [ ] **Step 5: Swap the page article for the panel**

In `page.tsx`, import `IssueBodyPanel`. Replace the standalone `<article className="prose …">` with:

```tsx
      <IssueBodyPanel
        cardId={card.id}
        bodyMarkdown={issue.body}
        bodyHtml={html}
      />
```

Keep `IssueComments` below it. History stays last.

- [ ] **Step 6: Check**

Run: `bun run check`

Expected: PASS. If `@mdxeditor/editor` types complain under `skipLibCheck`, fix imports (named vs default) rather than disabling the check.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock next.config.ts src/app/p/[project]/b/[board]/c/[externalId]/issue-body-editor.tsx src/app/p/[project]/b/[board]/c/[externalId]/issue-body-panel.tsx src/app/p/[project]/b/[board]/c/[externalId]/page.tsx src/styles/components/paper.css
git commit -m "feat: edit issue body in MDXEditor"
```

---

### Task 7: Playwright and docs

**Files:**
- Create: `e2e/issue-body.spec.ts`
- Modify: `docs/card-detail.md`
- Modify: `docs/specs/2026-08-26-cardstock-design.md`
- Modify: `docs/testing.md` (one line listing the new spec)

**Interfaces:**
- Consumes: `data-testid` values from Tasks 5–6; demo card `/p/demo/b/backlog/c/1`
- Produces: e2e coverage matching the spec's three cases

- [ ] **Step 1: Write the e2e spec**

Create `e2e/issue-body.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const ISSUE = "/p/demo/b/backlog/c/1";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto(ISSUE);
  await expect(page.getByTestId("issue-body")).toBeVisible();
});

test("editing the body survives reload", async ({ page }) => {
  const marker = `Ask edited in e2e ${Date.now()}`;
  await page.getByTestId("edit-issue-body").click();
  const editable = page
    .getByTestId("issue-body-editor")
    .locator("[contenteditable='true']");
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type(`## Ask\n\n${marker}`);
  await page.getByTestId("save-issue-body").click();
  await expect(page.getByTestId("issue-body")).toContainText(marker);
  await page.reload();
  await expect(page.getByTestId("issue-body")).toContainText(marker);
});

test("posting a comment survives reload", async ({ page }) => {
  const marker = `comment ${Date.now()}`;
  await page.getByTestId("comment-composer").fill(marker);
  await page.getByTestId("post-comment").click();
  await expect(page.getByTestId("comment-thread")).toContainText(marker);
  await page.reload();
  await expect(page.getByTestId("comment-thread")).toContainText(marker);
});

test("saving the body keeps existing comments", async ({ page }) => {
  const comment = `keep me ${Date.now()}`;
  await page.getByTestId("comment-composer").fill(comment);
  await page.getByTestId("post-comment").click();
  await expect(page.getByTestId("comment-thread")).toContainText(comment);

  await page.getByTestId("edit-issue-body").click();
  const editable = page
    .getByTestId("issue-body-editor")
    .locator("[contenteditable='true']");
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type("## Ask\n\nBody after comment.");
  await page.getByTestId("save-issue-body").click();
  await expect(page.getByTestId("comment-thread")).toContainText(comment);
});
```

The editable surface is `.mdxeditor-root-contenteditable` (also `[contenteditable='true']`). If the first locator times out, switch the three tests to:

```ts
page.getByTestId("issue-body-editor").locator(".mdxeditor-root-contenteditable")
```

Do not skip the test.

- [ ] **Step 2: Run e2e**

Run: `bun run test:e2e e2e/issue-body.spec.ts`

Expected: PASS. If the editor types markdown as literal `##` instead of a heading, that is still fine — the saved markdown should contain the marker either as a heading or as text; assert the marker, not the heading tag.

- [ ] **Step 3: Docs**

Append to `docs/card-detail.md`:

```md
## Body

Read by default (`.prose`, wiki-links as bold). **Edit** opens MDXEditor; **Save** writes `body_md` and stamps `body_edited_at`. **Cancel** discards the draft. Comments are not in the editor.

## Comments

Below the article. Each block is `### YYYY-MM-DD HH:mm · email` plus a blockquote in the file. The page shows timestamp, email, and rendered markdown. Append-only: textarea + **Post**. Empty Post shows “Write a comment first.” The first comment creates the `## Comments` fence; there is no empty-fence placeholder.
```

In `docs/specs/2026-08-26-cardstock-design.md`:

- Card detail bullet: change to `… rendered body (editable via MDXEditor), comments stored at the bottom of body_md after ## Comments, …`
- ETL import bullet: add `body_md` is markdown-owned until `body_edited_at` is set, then the app owns it.
- ETL export bullet: add that a stamped body is written back with the tracker H1 restored.

In `docs/testing.md`, add `e2e/issue-body.spec.ts` to the Playwright sentence.

- [ ] **Step 4: Commit**

```bash
git add e2e/issue-body.spec.ts docs/card-detail.md docs/specs/2026-08-26-cardstock-design.md docs/testing.md
git commit -m "test: issue body edit and comments"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| `## Comments` suffix, last fence wins, leftover tail | 1 |
| UTC `### date time · email` + blockquote | 1, 4 |
| `body_edited_at`, board wins | 2, 3 |
| Export writes body only when stamped, restores H1 | 2, 3 |
| `updateCardBody` / `addCardComment`, payload `{ body: true }` | 4 |
| Read default, Edit / Save / Cancel, comments stay mounted | 5, 6 |
| MDXEditor, ssr: false, paper chrome | 6 |
| Empty Post message | 5 |
| Editor load failure copy | 6 |
| Unit tests split/join, bodyOnImport, export | 1, 2 |
| Playwright three cases | 7 |
| docs/card-detail + cardstock-design | 7 |
| Wiki-links stay `[[…]]` in markdown | 6 (no plugin that rewrites them); read view still uses existing WIKILINK replace |
| Out of scope (title edit, threading, delete, Vercel writing files) | not planned |
