# Authenticated Board API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the CLI a versioned, token-authenticated HTTP API on the Next.js app for discovering boards, snapshotting them as markdown sheets, and writing sheets back with per-card revision checks.

**Architecture:** Personal access tokens (`cst_<id8>_<secret43>`) live in a new `cli_tokens` table, hashed with SHA-256. A single `withToken()` wrapper verifies the token, resolves project and board, computes the member's role with the existing `canManageProject`, and hands handlers a service-role client — handlers never build their own, so authorization lives in exactly one file. The four routes under `/api/v1/` reuse the existing round-trip engine (`loadBoardState` → `planImport` → `applyPlan`) rather than reimplementing it.

**Tech Stack:** bun 1.4 · Next.js 16.3 App Router route handlers (Node runtime) · TypeScript · Supabase (`@supabase/supabase-js` service-role client) · `node:crypto` · `bun test` · Playwright · Biome.

**Spec:** [`docs/specs/2026-09-06-authenticated-board-api-design.md`](../specs/2026-09-06-authenticated-board-api-design.md)

> Plan location note: the writing-plans skill defaults to `docs/superpowers/plans/`. This repo's own convention is `docs/plans/` (see `2026-08-26-implementation-plan.md`), and the spec went to `docs/specs/` for the same reason.

## Global Constraints

- **Server only.** No CLI commands consume this API in this item. `packages/cli` and `packages/core` are not touched. CLI-side consumption belongs to #15 and #17.
- **Handlers never construct a Supabase client.** The only client on this path comes from `withToken`. Any new `/api/v1/` route must go through the wrapper.
- **Never leak database messages.** A Supabase error is logged server-side and reported as a generic 500. `details` carries only structure the CLI can act on.
- **Never distinguish "no such token" from "wrong secret."** Both are `unauthenticated`.
- **Board-scoped routes 404, not 403,** on a project the member cannot see — the API must not confirm the existence of boards to outsiders.
- **The plaintext token is returned once and never stored.** Only its SHA-256 hash goes to the database.
- **Existing behaviour must not change.** The zip export routes, the website import flow, and `applyPlan`'s current callers behave exactly as before; the revision map is optional and absent for them.
- **Style:** Biome formatting (`bun run lint`). Comments explain *why*, not *what*, matching the surrounding files. Two-space indent, double quotes.
- **Migration filename:** `supabase/migrations/20260911000000_cli_tokens.sql` — the next in sequence after `20260910000000_lane_reorder.sql`.
- **Tracker discipline:** #16 is already claimed (`status: wip`, `lane: now`, commit `8459116`). Do not move it to `building` until every task here is done and verified; never set `shipped` or `done`.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260911000000_cli_tokens.sql` | The `cli_tokens` table, its index and its RLS policies |
| `src/lib/api/errors.ts` | The one error shape and its status mapping |
| `src/lib/api/token.ts` | Mint, parse and verify a personal access token |
| `src/lib/api/token.test.ts` | Unit tests for the above |
| `src/lib/api/route.ts` | `withToken` — the single authorization gate |
| `src/lib/api/route.test.ts` | Unit tests for the gate |
| `src/lib/api/board.ts` | Board etag and the JSON shapes the routes return |
| `src/app/api/v1/boards/route.ts` | Discovery |
| `src/app/api/v1/boards/[project]/[board]/route.ts` | Vocabulary |
| `src/app/api/v1/boards/[project]/[board]/sheets/route.ts` | Snapshot |
| `src/app/api/v1/boards/[project]/[board]/sync/route.ts` | Plan and apply |
| `src/lib/api/routes.integration.test.ts` | All four routes against the local database |
| `src/app/profile/cli-tokens.tsx` | The minting and revoking UI |
| `e2e/cli-token.spec.ts` | Mint and revoke through the browser |

**Modified:**

| Path | Change |
|---|---|
| `src/lib/import/types.ts` | `ExistingCard` gains `updated_at: string` |
| `src/lib/import/board-state.ts` | Select `updated_at` |
| `src/lib/import/export-board.ts` | Split into `boardSheets` (pure) + `rebaseSources` (writes) |
| `src/lib/import/apply.ts` | Optional expected-revision map; conflicts reported, not thrown |
| `src/app/profile/actions.ts` | `createCliToken` and `revokeCliToken` server actions |
| `src/app/profile/page.tsx` | Render the CLI tokens section |

---

### Task 1: The `cli_tokens` table

**Files:**
- Create: `supabase/migrations/20260911000000_cli_tokens.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: table `public.cli_tokens(id text pk, member_id uuid, name text, token_hash text, created_at timestamptz, last_used_at timestamptz, expires_at timestamptz, revoked_at timestamptz)`.

- [ ] **Step 1: Write the migration**

```sql
-- cardstock — personal access tokens for the CLI.
-- Spec: docs/specs/2026-09-06-authenticated-board-api-design.md
--
-- A token acts as its member and carries exactly that member's permissions.
-- Only the SHA-256 of the secret is stored; the plaintext is shown once, at
-- mint time, and is unrecoverable after that.
create table public.cli_tokens (
  -- The public half of the token, parsed straight out of the header. Text,
  -- not uuid: it is 8 base64url characters, and the lookup is by equality.
  id text primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  name text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  -- Revoked rather than deleted: a revoked token stays auditable, and
  -- verification keeps rejecting the id instead of forgetting it existed.
  revoked_at timestamptz
);

create index cli_tokens_member on public.cli_tokens (member_id);

alter table public.cli_tokens enable row level security;

-- The owning member manages their own tokens through the cookie client on the
-- profile page. The API reads this table through the service client, which
-- bypasses RLS, so these policies only govern the website.
create policy cli_tokens_own on public.cli_tokens for all
  using (
    member_id in (
      select m.id from public.members m where m.email = public.current_email()
    )
  )
  with check (
    member_id in (
      select m.id from public.members m where m.email = public.current_email()
    )
  );
```

- [ ] **Step 2: Apply it and verify the table exists**

Run: `bun run db:reset`
Then: `docker exec -i supabase_db_cardstock psql -U postgres -c "\d public.cli_tokens"`
Expected: the eight columns above, with `cli_tokens_pkey` and `cli_tokens_member`.

- [ ] **Step 3: Verify RLS is on**

Run: `docker exec -i supabase_db_cardstock psql -U postgres -c "select relrowsecurity from pg_class where relname = 'cli_tokens'"`
Expected: `t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260911000000_cli_tokens.sql
git commit -m "feat(api): cli_tokens table for CLI personal access tokens"
```

---

### Task 2: Mint and verify a token

**Files:**
- Create: `src/lib/api/token.ts`
- Test: `src/lib/api/token.test.ts`

**Interfaces:**
- Consumes: the `cli_tokens` table from Task 1.
- Produces:
  - `TOKEN_PREFIX = "cst_"`
  - `newToken(): { id: string; secret: string; plaintext: string; hash: string }`
  - `hashSecret(secret: string): string`
  - `parseToken(header: string | null): { id: string; secret: string } | null`
  - `verifyToken(db: SupabaseClient, header: string | null): Promise<VerifyResult>` where `VerifyResult = { ok: true; member: TokenMember } | { ok: false }` and `TokenMember = { id: string; email: string; role: string }`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/api/token.test.ts
import { describe, expect, test } from "bun:test";
import { hashSecret, newToken, parseToken, TOKEN_PREFIX } from "./token";

describe("newToken", () => {
  test("mints a cst_-prefixed token whose parts round-trip", () => {
    const t = newToken();
    expect(t.plaintext.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.id).toHaveLength(8);
    expect(t.secret).toHaveLength(43);
    expect(t.hash).toBe(hashSecret(t.secret));
    expect(parseToken(`Bearer ${t.plaintext}`)).toEqual({
      id: t.id,
      secret: t.secret,
    });
  });

  test("never repeats itself", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newToken().plaintext));
    expect(seen.size).toBe(200);
  });
});

describe("parseToken", () => {
  test.each([
    ["null header", null],
    ["empty", ""],
    ["no scheme", "cst_abcdefgh_secret"],
    ["wrong scheme", "Basic cst_abcdefgh_secret"],
    ["wrong prefix", "Bearer ghp_abcdefgh_secret"],
    ["no secret", "Bearer cst_abcdefgh"],
    ["short id", "Bearer cst_abc_secret"],
    ["illegal characters in id", "Bearer cst_abcdef!!_secret"],
  ])("rejects %s", (_label, header) => {
    expect(parseToken(header)).toBeNull();
  });

  test("tolerates surrounding whitespace", () => {
    const t = newToken();
    expect(parseToken(`  Bearer   ${t.plaintext}  `)).toEqual({
      id: t.id,
      secret: t.secret,
    });
  });
});

describe("hashSecret", () => {
  test("is stable and 64 hex characters", () => {
    expect(hashSecret("abc")).toBe(hashSecret("abc"));
    expect(hashSecret("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecret("abc")).not.toBe(hashSecret("abd"));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/lib/api/token.test.ts`
Expected: FAIL — cannot resolve `./token`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/api/token.ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Personal access tokens for the CLI.
 *
 * Shape: `cst_<id8>_<secret43>`. The id is public and is what the row is
 * looked up by; the secret is 32 bytes of CSPRNG output and only its SHA-256
 * is ever stored. The `cst_` prefix exists so a leaked token is greppable in
 * a log or a CI transcript.
 */

export const TOKEN_PREFIX = "cst_";

/** 8 base64url characters, then an underscore, then 43 more (32 bytes). */
const TOKEN_RE = /^cst_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/;

export interface TokenMember {
  id: string;
  email: string;
  role: string;
}

export type VerifyResult = { ok: true; member: TokenMember } | { ok: false };

/**
 * SHA-256, not bcrypt: the secret is 256 bits of randomness, so there is no
 * entropy to brute-force. Work factors defend low-entropy human passwords,
 * and this path runs on every single API request.
 */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function newToken(): {
  id: string;
  secret: string;
  plaintext: string;
  hash: string;
} {
  const id = randomBytes(6).toString("base64url").slice(0, 8);
  const secret = randomBytes(32).toString("base64url");
  return {
    id,
    secret,
    plaintext: `${TOKEN_PREFIX}${id}_${secret}`,
    hash: hashSecret(secret),
  };
}

/** The two halves of a well-formed bearer token, or null. No database work. */
export function parseToken(
  header: string | null,
): { id: string; secret: string } | null {
  const match = /^\s*Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!match) return null;
  const parts = TOKEN_RE.exec(match[1]);
  return parts ? { id: parts[1], secret: parts[2] } : null;
}

/** Constant-time compare of two hex digests of equal length. */
function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * The member a token stands for, or a flat refusal.
 *
 * Never says *why* it refused: "no such token" and "wrong secret" are the same
 * answer, so a caller cannot probe for which ids exist.
 */
export async function verifyToken(
  db: SupabaseClient,
  header: string | null,
): Promise<VerifyResult> {
  const parsed = parseToken(header);
  if (!parsed) return { ok: false };

  const { data: row } = await db
    .from("cli_tokens")
    .select("id, member_id, token_hash, expires_at, revoked_at")
    .eq("id", parsed.id)
    .maybeSingle();
  if (!row) return { ok: false };
  if (!sameHash(row.token_hash as string, hashSecret(parsed.secret)))
    return { ok: false };
  if (row.revoked_at) return { ok: false };
  if (row.expires_at && new Date(row.expires_at as string) <= new Date())
    return { ok: false };

  const { data: member } = await db
    .from("members")
    .select("id, email, role")
    .eq("id", row.member_id as string)
    .maybeSingle();
  if (!member) return { ok: false };

  // Best effort: a token that works must not stop working because the
  // bookkeeping write failed.
  void db
    .from("cli_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .then(undefined, () => {});

  return {
    ok: true,
    member: {
      id: member.id as string,
      email: member.email as string,
      role: member.role as string,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/api/token.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/token.ts src/lib/api/token.test.ts
git commit -m "feat(api): mint, parse and verify CLI access tokens"
```

---

### Task 3: The error shape and the authorization gate

**Files:**
- Create: `src/lib/api/errors.ts`, `src/lib/api/route.ts`
- Test: `src/lib/api/route.test.ts`

**Interfaces:**
- Consumes: `verifyToken` from Task 2; `canManageProject` from `src/lib/access.ts`.
- Produces:
  - `ApiCode = "unauthenticated" | "forbidden" | "not_found" | "invalid_request" | "conflict" | "rate_limited" | "internal"`
  - `apiError(code: ApiCode, message: string, details?: unknown): Response`
  - `apiJson(body: unknown, init?: ResponseInit): Response`
  - `ApiContext = { member: TokenMember; project: { id: string; slug: string }; board: { id: string; slug: string; settings: Record<string, unknown> }; canManage: boolean; db: SupabaseClient }`
  - `withToken<T>(handler: (ctx: ApiContext, request: Request) => Promise<Response>): (request: Request, ctx: { params: Promise<{ project: string; board: string }> }) => Promise<Response>`
  - `withTokenNoBoard(handler: (ctx: RootContext, request: Request) => Promise<Response>)` where `RootContext = { member: TokenMember; db: SupabaseClient }`

- [ ] **Step 1: Write `src/lib/api/errors.ts`**

```ts
// src/lib/api/errors.ts

/** Every failure the API admits to. One code, one status, no exceptions. */
export type ApiCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "conflict"
  | "rate_limited"
  | "internal";

const STATUS: Record<ApiCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 422,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

/**
 * `details` is for structure the CLI can act on — the conflicting cards, the
 * offending sheet names. Never a stack trace, never a database message.
 */
export function apiError(
  code: ApiCode,
  message: string,
  details?: unknown,
): Response {
  return Response.json(
    { error: details === undefined ? { code, message } : { code, message, details } },
    { status: STATUS[code] },
  );
}

export function apiJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}
```

- [ ] **Step 2: Write the failing tests for the gate**

```ts
// src/lib/api/route.test.ts
import { describe, expect, test } from "bun:test";
import { resolveAccess } from "./route";

/** The shape of the queries `resolveAccess` makes, faked in memory. */
function fakeDb(rows: {
  project?: { id: string; slug: string } | null;
  board?: { id: string; slug: string; settings: Record<string, unknown> } | null;
  role?: string | null;
}) {
  return {
    from(table: string) {
      const result =
        table === "projects"
          ? rows.project ?? null
          : table === "boards"
            ? rows.board ?? null
            : rows.role === null || rows.role === undefined
              ? null
              : { role: rows.role };
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: result }),
      };
      return chain;
    },
  } as never;
}

const member = { id: "m1", email: "a@b.c", role: "member" };

describe("resolveAccess", () => {
  test("a project member gets the board and no manage rights", async () => {
    const got = await resolveAccess(
      fakeDb({
        project: { id: "p1", slug: "proj" },
        board: { id: "b1", slug: "board", settings: {} },
        role: "member",
      }),
      member,
      "proj",
      "board",
    );
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(got.project.id).toBe("p1");
      expect(got.board.id).toBe("b1");
      expect(got.canManage).toBe(false);
    }
  });

  test("a project admin can manage", async () => {
    const got = await resolveAccess(
      fakeDb({
        project: { id: "p1", slug: "proj" },
        board: { id: "b1", slug: "board", settings: {} },
        role: "admin",
      }),
      member,
      "proj",
      "board",
    );
    expect(got.ok && got.canManage).toBe(true);
  });

  test("the site owner can manage without a membership row", async () => {
    const got = await resolveAccess(
      fakeDb({
        project: { id: "p1", slug: "proj" },
        board: { id: "b1", slug: "board", settings: {} },
        role: null,
      }),
      { ...member, role: "owner" },
      "proj",
      "board",
    );
    expect(got.ok && got.canManage).toBe(true);
  });

  test("a non-member gets not_found, not forbidden", async () => {
    const got = await resolveAccess(
      fakeDb({
        project: { id: "p1", slug: "proj" },
        board: { id: "b1", slug: "board", settings: {} },
        role: null,
      }),
      member,
      "proj",
      "board",
    );
    expect(got).toEqual({ ok: false, code: "not_found" });
  });

  test("an unknown project is not_found", async () => {
    const got = await resolveAccess(fakeDb({ project: null }), member, "nope", "board");
    expect(got).toEqual({ ok: false, code: "not_found" });
  });

  test("an unknown board is not_found", async () => {
    const got = await resolveAccess(
      fakeDb({ project: { id: "p1", slug: "proj" }, board: null, role: "admin" }),
      member,
      "proj",
      "nope",
    );
    expect(got).toEqual({ ok: false, code: "not_found" });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun test src/lib/api/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 4: Write `src/lib/api/route.ts`**

```ts
// src/lib/api/route.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canManageProject } from "@/lib/access";
import { apiError } from "./errors";
import { type TokenMember, verifyToken } from "./token";

/**
 * The one gate on `/api/v1`.
 *
 * Token-authenticated requests carry no Supabase JWT, so row-level security
 * cannot see who is asking: every query below runs as service role. That makes
 * this file the only thing standing between a token and the whole deployment,
 * which is exactly why handlers are handed a ready context and never build a
 * client of their own. A new route that skips `withToken` is a security bug.
 */

export interface ApiContext {
  member: TokenMember;
  project: { id: string; slug: string };
  board: { id: string; slug: string; settings: Record<string, unknown> };
  canManage: boolean;
  db: SupabaseClient;
}

export interface RootContext {
  member: TokenMember;
  db: SupabaseClient;
}

function serviceDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Resolved =
  | { ok: true; project: ApiContext["project"]; board: ApiContext["board"]; canManage: boolean }
  | { ok: false; code: "not_found" };

/**
 * Project, board and role for this member — or `not_found`.
 *
 * A member who cannot see the project gets the same answer as one asking for a
 * project that does not exist: the API must not confirm which boards are out
 * there to people who are not on them.
 */
export async function resolveAccess(
  db: SupabaseClient,
  member: TokenMember,
  projectSlug: string,
  boardSlug: string,
): Promise<Resolved> {
  const { data: project } = await db
    .from("projects")
    .select("id, slug")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) return { ok: false, code: "not_found" };

  const { data: membership } = await db
    .from("project_members")
    .select("role")
    .eq("project_id", project.id as string)
    .eq("member_id", member.id)
    .maybeSingle();
  const projectRole = (membership?.role ?? null) as string | null;
  const actor = { siteRole: member.role, projectRole };
  if (!projectRole && member.role !== "owner")
    return { ok: false, code: "not_found" };

  const { data: board } = await db
    .from("boards")
    .select("id, slug, settings")
    .eq("project_id", project.id as string)
    .eq("slug", boardSlug)
    .maybeSingle();
  if (!board) return { ok: false, code: "not_found" };

  return {
    ok: true,
    project: { id: project.id as string, slug: project.slug as string },
    board: {
      id: board.id as string,
      slug: board.slug as string,
      settings: (board.settings ?? {}) as Record<string, unknown>,
    },
    canManage: canManageProject(actor),
  };
}

/** Turn an unexpected throw into a 500 that says nothing. */
async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    console.error("api/v1:", e);
    return apiError("internal", "Something went wrong.");
  }
}

/** For `/api/v1/boards/[project]/[board]/...`. */
export function withToken(
  handler: (ctx: ApiContext, request: Request) => Promise<Response>,
) {
  return async (
    request: Request,
    ctx: { params: Promise<{ project: string; board: string }> },
  ): Promise<Response> =>
    guarded(async () => {
      const db = serviceDb();
      const auth = await verifyToken(db, request.headers.get("authorization"));
      if (!auth.ok)
        return apiError("unauthenticated", "Provide a valid CLI token.");
      const { project, board } = await ctx.params;
      const access = await resolveAccess(db, auth.member, project, board);
      if (!access.ok) return apiError("not_found", "No such board.");
      return handler(
        {
          member: auth.member,
          project: access.project,
          board: access.board,
          canManage: access.canManage,
          db,
        },
        request,
      );
    });
}

/** For `/api/v1/boards` itself, which resolves no board. */
export function withTokenNoBoard(
  handler: (ctx: RootContext, request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> =>
    guarded(async () => {
      const db = serviceDb();
      const auth = await verifyToken(db, request.headers.get("authorization"));
      if (!auth.ok)
        return apiError("unauthenticated", "Provide a valid CLI token.");
      return handler({ member: auth.member, db }, request);
    });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun test src/lib/api/route.test.ts`
Expected: PASS, all six cases.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/errors.ts src/lib/api/route.ts src/lib/api/route.test.ts
git commit -m "feat(api): one authorization gate for /api/v1"
```

---

### Task 4: Card revisions in board state, and a pure sheet reader

**Files:**
- Modify: `src/lib/import/types.ts`, `src/lib/import/board-state.ts`, `src/lib/import/export-board.ts`
- Test: existing `src/lib/import/apply.integration.test.ts` must still pass

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ExistingCard.updated_at: string`
  - `boardSheets(db, boardId, prefix?): Promise<{ entries: Record<string, Uint8Array>; rebase: RebaseRow[] }>`
  - `rebaseSources(db, rows: RebaseRow[]): Promise<void>`
  - `RebaseRow = { id: string; external_id: string; source_text: string; lane_from_source: string | null }`
  - `exportBoardEntries` keeps its existing signature and behaviour.

- [ ] **Step 1: Add `updated_at` to the card type**

In `src/lib/import/types.ts`, inside `interface ExistingCard`, immediately after `source_hash: string | null;`:

```ts
  /** The card's revision. Conditional writes compare against this. */
  updated_at: string;
```

- [ ] **Step 2: Select it**

In `src/lib/import/board-state.ts`, in the `.from("cards").select(...)` string, change the trailing `source_hash, source_text,` to `source_hash, source_text, updated_at,` — leaving the rest of the column list untouched.

- [ ] **Step 3: Split the exporter**

Replace the body of `src/lib/import/export-board.ts` so the read half no longer writes, keeping the doc comment's intent:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVocabulary, tagRef } from "@/lib/frontmatter/mapping";
import { cardToMarkdown, writeSheet } from "@/lib/frontmatter/write";
import { loadBoardState } from "@/lib/import/board-state";
import { sheetFromCard } from "@/lib/import/plan";

export interface RebaseRow {
  id: string;
  external_id: string;
  source_text: string;
  lane_from_source: string | null;
}

/**
 * One board's sheets, and the rebase they imply — but no writes.
 *
 * Split out of `exportBoardEntries` because the API serves this on a GET that
 * a client may poll: reading a board must not quietly rewrite every row's
 * `source_text`. Callers that want the rebase call `rebaseSources` after.
 */
export async function boardSheets(
  db: SupabaseClient,
  boardId: string,
  prefix = "",
): Promise<{ entries: Record<string, Uint8Array>; rebase: RebaseRow[] }> {
  const state = await loadBoardState(db, boardId);
  const { data: sources, error: sourcesError } = await db
    .from("cards")
    .select("id, source_text")
    .eq("board_id", boardId);
  // A failed read would look like "no card has a stored sheet", and the rebase
  // would then write that loss into every row. Never.
  if (sourcesError)
    throw new Error(`export: source_text: ${sourcesError.message}`);
  const sourceOf = new Map(
    (sources ?? []).map((s) => [s.id as string, s.source_text as string | null]),
  );
  const vocab = buildVocabulary(
    state.groups.flatMap((g) => g.tags.map((t) => `${g.key}:${t.key}`)),
  );
  const resolve = (t: string) => {
    const r = tagRef(t, vocab);
    return r && "ref" in r ? r.ref : null;
  };

  const entries: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  const rebase: RebaseRow[] = [];
  for (const card of state.cards.values()) {
    const sheet = sheetFromCard(card, state);
    const src = sourceOf.get(card.id);
    const text = src
      ? writeSheet(src, sheet, { tagRef: resolve })
      : cardToMarkdown(sheet);
    entries[`${prefix}${card.external_id}.md`] = enc.encode(text);
    if (text !== src)
      rebase.push({
        id: card.id,
        external_id: card.external_id,
        source_text: text,
        lane_from_source: sheet.lane,
      });
  }
  return { entries, rebase };
}

/**
 * Store the sheets that were just handed out, so the next diff shows only what
 * changed after this. A failure is logged, never thrown — the sheet is already
 * in the caller's hands and the download must not die for it.
 */
export async function rebaseSources(
  db: SupabaseClient,
  rows: RebaseRow[],
): Promise<void> {
  for (const r of rows) {
    const { error } = await db
      .from("cards")
      .update({
        source_text: r.source_text,
        lane_from_source: r.lane_from_source,
      })
      .eq("id", r.id);
    if (error)
      console.error(`export rebase #${r.external_id}: ${error.message}`);
  }
}

/**
 * One board's sheets, ready for a zip — read and rebase, as before.
 *
 * `prefix` is prepended to every entry name, so a project export can put each
 * board in its own folder (`"<board-slug>/"`).
 */
export async function exportBoardEntries(
  db: SupabaseClient,
  boardId: string,
  prefix = "",
): Promise<Record<string, Uint8Array>> {
  const { entries, rebase } = await boardSheets(db, boardId, prefix);
  await rebaseSources(db, rebase);
  return entries;
}
```

- [ ] **Step 4: Verify nothing regressed**

Run: `bun test src/lib/import`
Expected: PASS. The integration tests need the local stack; if they skip, run `bun run db:start` first and re-run.

Run: `bun run check`
Expected: clean — no type errors from the new `updated_at` field.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/types.ts src/lib/import/board-state.ts src/lib/import/export-board.ts
git commit -m "refactor(import): read sheets without rebasing, and carry card revisions"
```

---

### Task 5: Board etag and the read routes

**Files:**
- Create: `src/lib/api/board.ts`, `src/app/api/v1/boards/route.ts`, `src/app/api/v1/boards/[project]/[board]/route.ts`, `src/app/api/v1/boards/[project]/[board]/sheets/route.ts`

**Interfaces:**
- Consumes: `withToken`, `withTokenNoBoard`, `apiJson`, `apiError` (Task 3); `boardSheets` (Task 4); `loadBoardState`.
- Produces:
  - `boardEtag(state: BoardState): string`
  - Route responses documented below.

- [ ] **Step 1: Write `src/lib/api/board.ts`**

```ts
// src/lib/api/board.ts
import { createHash } from "node:crypto";
import type { BoardState } from "@/lib/import/types";

/**
 * A cheap "has anything changed?" token for a whole board.
 *
 * The newest `updated_at` across the board's cards, plus its shape (lane, tag
 * and card counts) so that a deletion moves it too — a delete lowers the count
 * without advancing any timestamp.
 */
export function boardEtag(state: BoardState): string {
  let newest = "";
  for (const card of state.cards.values())
    if (card.updated_at > newest) newest = card.updated_at;
  const shape = `${state.lanes.length}:${state.groups.length}:${state.cards.size}`;
  return createHash("sha256").update(`${newest}|${shape}`).digest("hex").slice(0, 32);
}

/** The vocabulary a client needs to write sheets this board will accept. */
export function boardVocabulary(state: BoardState) {
  return {
    lanes: state.lanes.map((l) => ({
      key: l.key,
      name: l.name,
      kind: l.kind,
      position: l.position,
    })),
    tagGroups: state.groups.map((g) => ({
      key: g.key,
      name: g.name,
      position: g.position,
      tags: g.tags.map((t) => ({ key: t.key, name: t.name })),
    })),
    epics: [...state.epics.keys()].sort(),
    members: state.members.map((m) => ({ email: m.email, name: m.display_name })),
  };
}
```

> If `Person` in `src/lib/assignee.ts` names its fields differently, use its actual field names here — check it before writing this file, and keep the JSON keys `email` and `name`.

- [ ] **Step 2: Write the discovery route**

```ts
// src/app/api/v1/boards/route.ts
import { canManageProject } from "@/lib/access";
import { apiJson } from "@/lib/api/errors";
import { withTokenNoBoard } from "@/lib/api/route";

/** Every project and board this token's member can reach, with their role. */
export const GET = withTokenNoBoard(async ({ member, db }) => {
  const { data: memberships } = await db
    .from("project_members")
    .select("project_id, role")
    .eq("member_id", member.id);
  const roleByProject = new Map(
    (memberships ?? []).map((m) => [m.project_id as string, m.role as string]),
  );

  const owner = member.role === "owner";
  const query = db
    .from("projects")
    .select("id, slug, name, boards(slug, name)")
    .order("name");
  // The owner is a project admin everywhere, membership row or not; everyone
  // else sees only the projects they are on.
  const { data: projects } = owner
    ? await query
    : await query.in("id", [...roleByProject.keys()]);

  return apiJson({
    projects: (projects ?? []).map((p) => {
      const projectRole = roleByProject.get(p.id as string) ?? null;
      return {
        slug: p.slug,
        name: p.name,
        role: projectRole,
        canManage: canManageProject({ siteRole: member.role, projectRole }),
        boards: ((p.boards ?? []) as { slug: string; name: string }[]).map((b) => ({
          slug: b.slug,
          name: b.name,
        })),
      };
    }),
  });
});
```

> `.in("id", [])` with an empty list returns no rows in PostgREST, which is the correct answer for a member on no projects. Confirm this in the integration test rather than assuming.

- [ ] **Step 3: Write the vocabulary route**

```ts
// src/app/api/v1/boards/[project]/[board]/route.ts
import { boardEtag, boardVocabulary } from "@/lib/api/board";
import { apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { loadBoardState } from "@/lib/import/board-state";

/** Lanes, tag groups, epics, roster and settings — what a client needs to write valid sheets. */
export const GET = withToken(async ({ db, project, board, canManage }) => {
  const state = await loadBoardState(db, board.id);
  return apiJson({
    project: project.slug,
    board: board.slug,
    canManage,
    settings: board.settings,
    etag: boardEtag(state),
    ...boardVocabulary(state),
  });
});
```

- [ ] **Step 4: Write the snapshot route**

```ts
// src/app/api/v1/boards/[project]/[board]/sheets/route.ts
import { boardEtag } from "@/lib/api/board";
import { apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { loadBoardState } from "@/lib/import/board-state";
import { boardSheets } from "@/lib/import/export-board";

/**
 * Every card as a markdown sheet, with the revision a later write must quote.
 *
 * `boardSheets`, not `exportBoardEntries`: a GET that clients may poll must not
 * rewrite every row's stored sheet as a side effect of being read.
 */
export const GET = withToken(async ({ db, board }) => {
  const [state, { entries }] = await Promise.all([
    loadBoardState(db, board.id),
    boardSheets(db, board.id),
  ]);
  const dec = new TextDecoder();
  const sheets = [...state.cards.values()]
    .sort((a, b) => Number(a.external_id) - Number(b.external_id))
    .map((card) => ({
      name: `${card.external_id}.md`,
      externalId: card.external_id,
      revision: card.updated_at,
      text: dec.decode(entries[`${card.external_id}.md`]),
    }));
  return apiJson({ etag: boardEtag(state), sheets });
});
```

- [ ] **Step 5: Verify the app still builds and types check**

Run: `bun run check`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/board.ts "src/app/api/v1"
git commit -m "feat(api): board discovery, vocabulary and sheet snapshot"
```

---

### Task 6: Conditional card writes in `applyPlan`

**Files:**
- Modify: `src/lib/import/apply.ts`
- Test: `src/lib/import/apply.integration.test.ts`

**Interfaces:**
- Consumes: `ExistingCard.updated_at` (Task 4).
- Produces:
  - `ApplyCounts` gains `conflicted: string[]` (external ids that failed their revision check)
  - `applyPlan(db, state, plan, actor, expected?: Map<string, string>)` — `expected` maps external id → the `updated_at` the caller last saw. Absent means unconditional, exactly as today.

- [ ] **Step 1: Write the failing test**

Append to the existing `describe.skipIf(!local)` block in `src/lib/import/apply.integration.test.ts`:

```ts
  test("a stale revision is reported, not written", async () => {
    const boardId = await demoBoard();
    const first = await loadBoardState(db, boardId);
    const target = [...first.cards.values()][0];
    const stale = target.updated_at;

    // Somebody else edits the card after our snapshot was taken.
    await db
      .from("cards")
      .update({ title: `Moved on ${Date.now()}` })
      .eq("id", target.id);

    const state = await loadBoardState(db, boardId);
    const plan = planImport(
      [sheet(Number(target.external_id), "lane: now", "## Ask\n\nChanged.")],
      state,
    );
    const counts = await applyPlan(
      db,
      state,
      plan,
      "test",
      new Map([[target.external_id, stale]]),
    );

    expect(counts.conflicted).toEqual([target.external_id]);
    expect(counts.updated).toBe(0);
    const after = await loadBoardState(db, boardId);
    expect(after.cards.get(target.external_id)?.body_md).not.toContain("Changed.");
  });

  test("a current revision writes normally", async () => {
    const boardId = await demoBoard();
    const state = await loadBoardState(db, boardId);
    const target = [...state.cards.values()][0];
    const plan = planImport(
      [sheet(Number(target.external_id), "lane: now", "## Ask\n\nFresh.")],
      state,
    );
    const counts = await applyPlan(
      db,
      state,
      plan,
      "test",
      new Map([[target.external_id, target.updated_at]]),
    );
    expect(counts.conflicted).toEqual([]);
    const after = await loadBoardState(db, boardId);
    expect(after.cards.get(target.external_id)?.body_md).toContain("Fresh.");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/lib/import/apply.integration.test.ts`
Expected: FAIL — `applyPlan` takes four arguments, and `counts.conflicted` is undefined.

- [ ] **Step 3: Thread the revision map through**

In `src/lib/import/apply.ts`:

Extend the counts interface:

```ts
export interface ApplyCounts {
  created: number;
  updated: number;
  /** Rows that only recorded the sheet — same content, different bytes. */
  recalibrated: number;
  /** External ids whose stored revision had moved on; nothing was written for them. */
  conflicted: string[];
}
```

Change `applyPlan` to accept and forward the map:

```ts
export async function applyPlan(
  db: SupabaseClient,
  state: BoardState,
  plan: Plan,
  actor: string,
  /**
   * external id → the `updated_at` the caller last saw. A card whose row has
   * moved past its entry is skipped and reported. Absent, or missing an entry,
   * means write unconditionally — which is what the website's own import does.
   */
  expected?: Map<string, string>,
): Promise<ApplyCounts> {
  if (!plan.ok)
    throw new Error("The plan has errors; fix the files and try again.");
  const counts: ApplyCounts = {
    created: 0,
    updated: 0,
    recalibrated: 0,
    conflicted: [],
  };
  try {
    await fileThePlan(db, state, plan, actor, counts, expected);
  } catch (e) {
    throw new ApplyError((e as Error).message, counts.created, counts.updated);
  }
  return counts;
}
```

Add the same parameter to `fileThePlan`'s signature (`expected?: Map<string, string>`) and replace the card-write block at `src/lib/import/apply.ts:174-187` with:

```ts
    // A partial patch only carries the changed columns, so an existing card
    // is updated by id rather than upserted: an insert-shaped upsert must
    // satisfy every NOT NULL column (e.g. title) before Postgres even looks
    // at the conflict, which a changed-priority-only patch would violate.
    //
    // When the caller quoted a revision, it goes into the WHERE clause rather
    // than into a check before it: a lost update then shows up as zero rows
    // affected instead of as a race between reading and writing.
    const revision = prev ? expected?.get(row.id) : undefined;
    const { data, error } = prev
      ? await (revision
          ? db
              .from("cards")
              .update(columns)
              .eq("id", prev.id)
              .eq("updated_at", revision)
              .select("id")
              .maybeSingle()
          : db
              .from("cards")
              .update(columns)
              .eq("id", prev.id)
              .select("id")
              .maybeSingle())
      : await db
          .from("cards")
          .upsert(columns, { onConflict: "board_id,external_id" })
          .select("id")
          .maybeSingle();
    if (error) fail(`#${row.id}`, error);
    if (!data) {
      // No error and no row: the revision no longer matches (or the card is
      // gone). Report it and leave the rest of the plan to land.
      if (revision) {
        counts.conflicted.push(row.id);
        continue;
      }
      fail(`#${row.id}`, null);
    }
    idByExternal.set(row.id, data.id);
```

> The block sits inside the loop over `plan.rows`; `continue` skips this card's tags and links too, which is the point. Check the surrounding `counts.updated` / `counts.created` increments and make sure a conflicted row increments neither.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/lib/import/apply.integration.test.ts`
Expected: PASS, including the two new cases and every pre-existing one.

- [ ] **Step 5: Fix the other callers**

Run: `bun run check`
Expected: type errors anywhere `ApplyCounts` is constructed or destructured. Add `conflicted: []` where a literal is built, and surface the count where the website reports import results. Re-run until clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/import/apply.ts src/lib/import/apply.integration.test.ts
git commit -m "feat(import): conditional card writes with revision conflicts reported"
```

---

### Task 7: The sync route

**Files:**
- Create: `src/app/api/v1/boards/[project]/[board]/sync/route.ts`

**Interfaces:**
- Consumes: `withToken`, `apiError`, `apiJson` (Task 3); `loadBoardState`; `planImport`; `applyPlan` with the revision map (Task 6); `boardEtag` (Task 5).
- Produces: `POST` handler. Request `{ apply?: boolean; sheets: { name: string; text: string; revision?: string }[] }`. Response `{ etag, plan: { counts, rows }, applied, conflicted, skipped }`.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/v1/boards/[project]/[board]/sync/route.ts
import { boardEtag } from "@/lib/api/board";
import { apiError, apiJson } from "@/lib/api/errors";
import { withToken } from "@/lib/api/route";
import { applyPlan } from "@/lib/import/apply";
import { loadBoardState } from "@/lib/import/board-state";
import { planImport } from "@/lib/import/plan";
import type { SheetFile } from "@/lib/import/types";

interface SyncSheet {
  name: string;
  text: string;
  revision?: string;
}

/** Reject a malformed body before it reaches the planner. */
function readBody(
  raw: unknown,
): { apply: boolean; sheets: SyncSheet[] } | string {
  if (!raw || typeof raw !== "object") return "Send a JSON object.";
  const body = raw as Record<string, unknown>;
  if (body.apply !== undefined && typeof body.apply !== "boolean")
    return "`apply` must be a boolean.";
  if (!Array.isArray(body.sheets)) return "`sheets` must be an array.";
  const sheets: SyncSheet[] = [];
  for (const [i, entry] of body.sheets.entries()) {
    const s = entry as Record<string, unknown>;
    if (!s || typeof s.name !== "string" || !/^\d+\.md$/.test(s.name))
      return `sheets[${i}].name must look like "16.md".`;
    if (typeof s.text !== "string") return `sheets[${i}].text must be a string.`;
    if (s.revision !== undefined && typeof s.revision !== "string")
      return `sheets[${i}].revision must be a string.`;
    sheets.push({ name: s.name, text: s.text, revision: s.revision });
  }
  return { apply: body.apply === true, sheets };
}

/**
 * Plan a set of sheets, and apply them if asked.
 *
 * `apply: false` is the dry run — same planner, same inputs, so a preview
 * cannot drift from what the write would do. `apply: true` requires a revision
 * for every card the planner calls `changed`: a client that has not read the
 * board is not allowed to overwrite it by omission.
 */
export const POST = withToken(async ({ db, board, canManage, member }, request) => {
  if (!canManage)
    return apiError("forbidden", "You need project admin rights to write to this board.");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError("invalid_request", "The body is not valid JSON.");
  }
  const body = readBody(raw);
  if (typeof body === "string") return apiError("invalid_request", body);

  const state = await loadBoardState(db, board.id);
  const files: SheetFile[] = body.sheets.map((s) => ({
    name: s.name,
    text: s.text,
  }));
  const plan = planImport(files, state);
  const etag = boardEtag(state);
  const rows = plan.rows.map((r) => ({
    id: r.id,
    verdict: r.verdict,
    ...(r.verdict === "error" ? { message: r.message } : {}),
  }));

  if (!body.apply)
    return apiJson({ etag, applied: [], conflicted: [], skipped: [], plan: { counts: plan.counts, rows } });

  if (!plan.ok)
    return apiError("invalid_request", "Some sheets could not be read.", { rows });

  const revisionOf = new Map(
    body.sheets
      .filter((s) => s.revision)
      .map((s) => [s.name.replace(/\.md$/, ""), s.revision as string]),
  );
  const missing = plan.rows
    .filter((r) => r.verdict === "changed" && !revisionOf.has(r.id))
    .map((r) => r.id);
  if (missing.length > 0)
    return apiError(
      "conflict",
      "Quote the revision you last saw for every card you are changing.",
      { code: "revision_required", cards: missing },
    );

  const counts = await applyPlan(db, state, plan, member.email, revisionOf);
  const conflicted = new Set(counts.conflicted);
  const applied = plan.rows
    .filter((r) => (r.verdict === "new" || r.verdict === "changed") && !conflicted.has(r.id))
    .map((r) => r.id);
  const skipped = plan.rows.filter((r) => r.verdict === "unchanged").map((r) => r.id);

  const after = await loadBoardState(db, board.id);
  return apiJson(
    {
      etag: boardEtag(after),
      applied,
      conflicted: counts.conflicted,
      skipped,
      plan: { counts: plan.counts, rows },
    },
    // A partial apply is still a conflict: the client must reconcile before
    // it trusts its baseline.
    { status: counts.conflicted.length > 0 ? 409 : 200 },
  );
});
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/v1/boards/[project]/[board]/sync"
git commit -m "feat(api): plan and apply sheets with revision checks"
```

---

### Task 8: Integration tests for all four routes

**Files:**
- Create: `src/lib/api/routes.integration.test.ts`

**Interfaces:**
- Consumes: every route from Tasks 5 and 7; `newToken` from Task 2.

- [ ] **Step 1: Write the tests**

```ts
// src/lib/api/routes.integration.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GET as getBoards } from "@/app/api/v1/boards/route";
import { GET as getBoard } from "@/app/api/v1/boards/[project]/[board]/route";
import { GET as getSheets } from "@/app/api/v1/boards/[project]/[board]/sheets/route";
import { POST as postSync } from "@/app/api/v1/boards/[project]/[board]/sync/route";
import { newToken } from "./token";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = !!url && !!key && /127\.0\.0\.1|localhost/.test(url);

describe.skipIf(!local)("the /api/v1 routes against the local database", () => {
  let db: SupabaseClient;
  let plaintext: string;
  let tokenId: string;
  const params = Promise.resolve({ project: "demo", board: "backlog" });

  beforeAll(async () => {
    db = createClient(url!, key!, { auth: { persistSession: false } });
    const { data: member } = await db
      .from("members")
      .select("id")
      .eq("role", "owner")
      .limit(1)
      .single();
    const t = newToken();
    plaintext = t.plaintext;
    tokenId = t.id;
    await db.from("cli_tokens").insert({
      id: t.id,
      member_id: member!.id,
      name: "integration test",
      token_hash: t.hash,
    });
  });

  afterAll(async () => {
    await db.from("cli_tokens").delete().eq("id", tokenId);
  });

  const req = (body?: unknown) =>
    new Request("http://localhost/api/v1", {
      method: body ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${plaintext}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const anon = () =>
    new Request("http://localhost/api/v1", { headers: { authorization: "Bearer nope" } });

  test("no token is 401 with the standard error shape", async () => {
    const res = await getBoards(anon());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  test("discovery lists the demo board", async () => {
    const res = await getBoards(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    const demo = body.projects.find((p: { slug: string }) => p.slug === "demo");
    expect(demo.boards.some((b: { slug: string }) => b.slug === "backlog")).toBe(true);
  });

  test("an unknown board is 404, not 403", async () => {
    const res = await getBoard(req(), {
      params: Promise.resolve({ project: "demo", board: "no-such-board" }),
    });
    expect(res.status).toBe(404);
  });

  test("vocabulary returns lanes, tag groups and an etag", async () => {
    const res = await getBoard(req(), { params });
    const body = await res.json();
    expect(body.lanes.length).toBeGreaterThan(0);
    expect(body.etag).toMatch(/^[0-9a-f]{32}$/);
  });

  test("the snapshot returns sheets with revisions", async () => {
    const res = await getSheets(req(), { params });
    const body = await res.json();
    expect(body.sheets.length).toBeGreaterThan(0);
    for (const s of body.sheets) {
      expect(s.name).toMatch(/^\d+\.md$/);
      expect(s.revision).toBeTruthy();
      expect(s.text).toContain("---");
    }
  });

  test("reading the snapshot does not rewrite stored sheets", async () => {
    const before = await db.from("cards").select("id, source_text").eq("external_id", "1");
    await getSheets(req(), { params });
    const after = await db.from("cards").select("id, source_text").eq("external_id", "1");
    expect(after.data).toEqual(before.data);
  });

  test("a dry run writes nothing", async () => {
    const snap = await (await getSheets(req(), { params })).json();
    const first = snap.sheets[0];
    const res = await postSync(
      req({ apply: false, sheets: [{ ...first, text: `${first.text}\nDry run.\n` }] }),
      { params },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.counts.changed).toBe(1);
    expect(body.applied).toEqual([]);
    const again = await (await getSheets(req(), { params })).json();
    expect(again.sheets[0].revision).toBe(first.revision);
  });

  test("changing a card without a revision is refused", async () => {
    const snap = await (await getSheets(req(), { params })).json();
    const first = snap.sheets[0];
    const res = await postSync(
      req({ apply: true, sheets: [{ name: first.name, text: `${first.text}\nNo revision.\n` }] }),
      { params },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.details.code).toBe("revision_required");
  });

  test("a stale revision conflicts and leaves the card alone", async () => {
    const snap = await (await getSheets(req(), { params })).json();
    const first = snap.sheets[0];
    await db
      .from("cards")
      .update({ title: `Moved on ${Date.now()}` })
      .eq("external_id", first.externalId);

    const res = await postSync(
      req({
        apply: true,
        sheets: [{ ...first, text: `${first.text}\nStale write.\n` }],
      }),
      { params },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.conflicted).toContain(first.externalId);
    const after = await (await getSheets(req(), { params })).json();
    expect(after.sheets[0].text).not.toContain("Stale write.");
  });

  test("a fresh revision applies", async () => {
    const snap = await (await getSheets(req(), { params })).json();
    const first = snap.sheets[0];
    const res = await postSync(
      req({ apply: true, sheets: [{ ...first, text: `${first.text}\nApplied.\n` }] }),
      { params },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).applied).toContain(first.externalId);
  });

  test("a malformed sheet name is 422", async () => {
    const res = await postSync(
      req({ apply: false, sheets: [{ name: "notanumber.md", text: "x" }] }),
      { params },
    );
    expect(res.status).toBe(422);
  });

  test("a revoked token is 401", async () => {
    await db.from("cli_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tokenId);
    const res = await getBoards(req());
    expect(res.status).toBe(401);
    await db.from("cli_tokens").update({ revoked_at: null }).eq("id", tokenId);
  });
});
```

- [ ] **Step 2: Reset the demo board and run**

Run: `bun run db:start` (if the stack is down), then `bun run etl/e2e-reset.ts`, then `bun test src/lib/api/routes.integration.test.ts`
Expected: PASS. These tests mutate the demo board, so reset before each full run.

- [ ] **Step 3: Fix what the tests catch**

Likely spots, in order of probability: the `.eq("updated_at", revision)` timestamp round-trip through PostgREST; `.in("id", [])` on an empty membership list; the `Person` field names in `boardVocabulary`. Fix the source, not the test.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/routes.integration.test.ts
git commit -m "test(api): the four /api/v1 routes end to end"
```

---

### Task 9: Minting tokens on the profile page

**Files:**
- Create: `src/app/profile/cli-tokens.tsx`, `e2e/cli-token.spec.ts`
- Modify: `src/app/profile/actions.ts`, `src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `newToken` (Task 2); `currentMember`, `supabaseServer` from `src/lib/supabase/server.ts`; the existing `ProfileResult` type in `actions.ts`.
- Produces:
  - `createCliToken(_previous, form): Promise<{ error?: string; plaintext?: string }>`
  - `revokeCliToken(_previous, form): Promise<ProfileResult>`
  - `<CliTokens tokens={CliTokenRow[]} />` where `CliTokenRow = { id: string; name: string; created_at: string; last_used_at: string | null; expires_at: string | null }`

- [ ] **Step 1: Add the server actions**

Append to `src/app/profile/actions.ts`:

```ts
/**
 * Mint a CLI token for the signed-in member.
 *
 * The plaintext is returned to the caller once and never stored — only its
 * SHA-256 reaches the database. A member who loses it mints another.
 */
export async function createCliToken(
  _previous: { error?: string; plaintext?: string } | null,
  form: FormData,
): Promise<{ error?: string; plaintext?: string }> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  const name = cleanName(String(form.get("name") ?? ""));
  if (!name) return { error: "Give the token a name." };
  const days = Number(form.get("days") ?? 0);
  if (!Number.isFinite(days) || days < 0 || days > 3650)
    return { error: "Expiry must be between 0 and 3650 days." };

  const token = newToken();
  const db = await supabaseServer();
  const { error } = await db.from("cli_tokens").insert({
    id: token.id,
    member_id: me.id,
    name,
    token_hash: token.hash,
    expires_at:
      days > 0
        ? new Date(Date.now() + days * 86_400_000).toISOString()
        : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { plaintext: token.plaintext };
}

/** Revoke rather than delete, so the row stays auditable. */
export async function revokeCliToken(
  _previous: ProfileResult,
  form: FormData,
): Promise<ProfileResult> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  const id = String(form.get("id") ?? "");
  if (!id) return { error: "Which token?" };
  const db = await supabaseServer();
  const { error } = await db
    .from("cli_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("member_id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { success: "Token revoked." };
}
```

Add `import { newToken } from "@/lib/api/token";` to the file's imports.

- [ ] **Step 2: Write the client component**

```tsx
// src/app/profile/cli-tokens.tsx
"use client";

import { useActionState } from "react";
import { createCliToken, revokeCliToken } from "./actions";

export interface CliTokenRow {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "—";

/**
 * Mint and revoke CLI tokens.
 *
 * The plaintext appears exactly once, in the result of the action that made
 * it. Nothing re-reads it, and a reload loses it — which is the point.
 */
export function CliTokens({ tokens }: { tokens: CliTokenRow[] }) {
  const [minted, mint, minting] = useActionState(createCliToken, null);
  const [revoked, revoke] = useActionState(revokeCliToken, null);

  return (
    <div>
      <form action={mint} className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Name</span>
          <input name="name" required placeholder="laptop" className="input" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Expires in (days, 0 = never)</span>
          <input name="days" type="number" min={0} max={3650} defaultValue={0} className="input" />
        </label>
        <button type="submit" disabled={minting}>
          {minting ? "Minting…" : "Mint token"}
        </button>
      </form>

      {minted?.error ? <p role="alert">{minted.error}</p> : null}
      {minted?.plaintext ? (
        <p className="mb-4" role="status">
          <strong>Copy this now — it will not be shown again.</strong>
          <code className="ml-2 font-mono text-[13px]">{minted.plaintext}</code>
        </p>
      ) : null}
      {revoked?.success ? <p role="status">{revoked.success}</p> : null}

      {tokens.length > 0 ? (
        <ul aria-label="CLI tokens">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-1">
              <code className="font-mono text-[13px]">cst_{t.id}…</code>
              <span>{t.name}</span>
              <span className="folder-blurb">
                created {when(t.created_at)} · last used {when(t.last_used_at)} · expires{" "}
                {when(t.expires_at)}
              </span>
              <form action={revoke}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" aria-label={`Revoke ${t.name}`}>
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="folder-blurb">No CLI tokens yet.</p>
      )}
    </div>
  );
}
```

> Match the surrounding markup's class conventions — check `notification-settings.tsx` for how inputs and buttons are styled in this app and use the same classes rather than the placeholder `input` above.

- [ ] **Step 3: Render it on the profile page**

In `src/app/profile/page.tsx`, add `import { CliTokens } from "./cli-tokens";`, fetch the rows alongside the existing `Promise.all`:

```ts
    db
      .from("cli_tokens")
      .select("id, name, created_at, last_used_at, expires_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
```

and insert a section between Notifications and "My cardstock":

```tsx
      <section aria-labelledby="profile-cli" className="mb-10">
        <h2 id="profile-cli" className="mb-4">
          CLI tokens
        </h2>
        <CliTokens tokens={(tokens ?? []) as CliTokenRow[]} />
      </section>
```

Destructure `{ data: tokens }` from the `Promise.all` result and import the `CliTokenRow` type.

- [ ] **Step 4: Write the e2e test**

```ts
// e2e/cli-token.spec.ts
import { expect, test } from "@playwright/test";
import { admin, OWNER, signIn } from "./support/sign-in";

test("a member mints a CLI token, sees it once, and revokes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/profile");

  const name = `e2e-${Date.now()}`;
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Mint token" }).click();

  const shown = page.getByText(/^cst_/);
  await expect(shown).toBeVisible();
  const plaintext = (await shown.textContent()) ?? "";
  expect(plaintext).toMatch(/^cst_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);

  // Only the hash is stored.
  const { data: rows } = await admin
    .from("cli_tokens")
    .select("id, token_hash, member_id, members(email)")
    .eq("name", name);
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain(plaintext.split("_")[2]);

  // A reload loses the plaintext for good.
  await page.reload();
  await expect(page.getByText(plaintext)).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();

  await page.getByRole("button", { name: `Revoke ${name}` }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);

  await admin.from("cli_tokens").delete().eq("name", name);
  expect(OWNER).toBeTruthy();
});
```

- [ ] **Step 5: Run it**

Run: `bun run test:e2e -- cli-token`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/profile/cli-tokens.tsx src/app/profile/actions.ts src/app/profile/page.tsx e2e/cli-token.spec.ts
git commit -m "feat(profile): mint and revoke CLI tokens"
```

---

### Task 10: Full verification and hand-back

**Files:**
- Modify: `backlog/tracker/16.md`, `docs/cli-development.md`

- [ ] **Step 1: Run everything**

```bash
bun run check
bun test
bun run build
```

Expected: all clean. Record the actual output — do not claim a pass you have not seen.

- [ ] **Step 2: Exercise it for real**

Start the app (`bun run dev`), mint a token through `/profile`, and run each route against it:

```bash
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/v1/boards
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/v1/boards/demo/backlog
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/v1/boards/demo/backlog/sheets
curl -s -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"apply":false,"sheets":[]}' localhost:3000/api/v1/boards/demo/backlog/sync
curl -s localhost:3000/api/v1/boards
```

Expected: four JSON bodies, then `{"error":{"code":"unauthenticated",...}}` with status 401 on the last.

- [ ] **Step 3: Document it**

Add a section to `docs/cli-development.md` covering the token format, how to mint one, the four routes with an example request and response each, the error codes table, and the revision rule. Point at the spec for rationale.

- [ ] **Step 4: Move #16 to Building**

Overwrite (never append to) the `## Status` section of `backlog/tracker/16.md` with what was built and what is still owed a human look, then set `status: built` and `lane: building`.

```bash
py -3 backlog/validate_tracker.py   # must report 0 problems
py -3 backlog/sync.py --hosted      # must print "converged"
```

First run `py -3 backlog/sync.py --hosted --check --item 16`. If it reports `body-owner=app`, someone edited the card on the site: write the Status update on the card page instead, or the next sync discards it. If the card is no longer in `now`, **stop** and report — a person moved it.

- [ ] **Step 5: Commit**

```bash
git add backlog/tracker docs/cli-development.md
git commit -m "tracker(#16): authenticated board API built"
```

- [ ] **Step 6: Stop**

Do **not** set `shipped` or `done`. Report to the operator: what was built, that tests and build are green, what is unverified, and that shipping needs their confirmation that it is live.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Service-role client, enforcement in app code | 3 |
| Token format `cst_<id8>_<secret43>` | 2 |
| `cli_tokens` table and RLS | 1 |
| SHA-256 rationale | 2 |
| Token scope = member's permissions | 3 (`resolveAccess`) |
| `mintToken` / `verifyToken`, `last_used_at` best-effort | 2, 9 |
| `/api/v1` prefix, `withToken`, handlers never build clients | 3 |
| Four routes | 5, 7 |
| 404-not-403 for invisible projects | 3, 8 |
| Uniform error shape and status table | 3 |
| Per-card `updated_at` revisions | 4 |
| `apply: false` dry run | 7, 8 |
| `409 revision_required` | 7, 8 |
| Check inside the write via `.eq("updated_at", …)` | 6 |
| `applied` / `conflicted` / `skipped` | 6, 7 |
| Board etag | 5 |
| `exportBoardEntries` split | 4 |
| Minting UI on the profile page | 9 |
| Every test named in the spec | 2, 3, 6, 8, 9 |
| `bun run check` + production build | 10 |

No gaps.

**Known soft spots, flagged rather than hidden:**

- **The `.eq("updated_at", revision)` round-trip.** PostgREST must parse the timestamp string it emitted back into the same value. Task 8 Step 3 names this as the first thing to check if the conflict tests misbehave.
- **`boardVocabulary`'s member fields** depend on `Person` in `src/lib/assignee.ts`, which Task 5 tells the implementer to read rather than guess.
- **`ApplyCounts.conflicted` is a breaking change to a shared type.** Task 6 Step 5 exists to catch every caller via `bun run check`.
- **The profile component's CSS classes** are placeholders; Task 9 Step 2 says to match `notification-settings.tsx` instead.
