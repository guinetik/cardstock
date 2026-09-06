# Authenticated board API — design

**Date:** 2026-09-06
**Tracker:** [#16](../../backlog/tracker/16.md) — *Let the CLI access boards through the website*
**Status:** approved in conversation; implementation follows this document.
**Neighbours:** [#15](../../backlog/tracker/15.md) (browser sign-in for the CLI), [#17](../../backlog/tracker/17.md) (preview/dry-run), [#18](../../backlog/tracker/18.md) (bidirectional sync), [#19](../../backlog/tracker/19.md) (retire the Python shims).

---

## The problem

The CLI can read markdown and nothing else. Every path that actually reaches a board today goes through `backlog/sync.py`, which shells into the app's ETL, which opens Postgres with the service-role key — and even in `--hosted` mode it needs Docker running locally, because the sync engine borrows `psql` out of the `supabase_db_cardstock` container. That means anyone who wants to sync a tracker needs an app checkout, a container runtime, and a credential that can read and write every project on the deployment.

That is the wrong shape for a published npm package. `@guinetik/cardstock-cli` is installable by anyone (#13), and #19 wants Designer and Website moved onto it too. None of those users should be handed the database.

## What we're building

A versioned HTTP API on the Next.js app, authenticated by a personal access token, that lets a CLI discover the boards its holder can reach, take a snapshot of one as markdown sheets, and write sheets back with per-card revision checks. Plus the token infrastructure itself and a place in the website to mint one.

**This item ships the server only.** No CLI commands consume it yet; that lands with #15 and #17. The deliverable is the surface plus the tests and UI that prove it works.

### Not in scope

Browser-based CLI authorization (#15), a local credential store, sync planning on the client (#17), conflict-aware merge (#18), and any migration of the other two boards (#19). Database restore and bulk backup stay outside everyday client operations, as #16's residuals ask.

## Authentication

RLS in this schema resolves identity from `auth.jwt() ->> 'email'` (`current_email()` → `is_member()` → `is_project_member()`). A personal access token is not a Supabase JWT, so a token-authenticated request has no identity the database can see. Three ways out were considered:

- **Mint a short-lived Supabase JWT from the token.** Sign HS256 with `SUPABASE_JWT_SECRET` and every existing policy applies unchanged. Rejected: it couples the CLI to Supabase's legacy shared-secret signing, which is being replaced by asymmetric JWKS keys, and it puts the JWT secret in the Vercel environment.
- **Teach RLS about tokens.** Pass a token hash as a request setting and give `current_email()` a fallback. Rejected: it edits the one function every policy on the deployment depends on, so a mistake is a site-wide auth bug rather than a CLI bug.
- **Service-role client, enforcement in application code.** Chosen.

The route resolves the token to a `members` row and then does its work through a service-role client, with membership and role checked in TypeScript using the rules already in `src/lib/access.ts`. This is the posture the ETL has always run under. RLS is bypassed on this path, so the design's job is to make sure there is exactly one place a check can be forgotten — see **The wrapper**, below.

### Token format

```
cst_<id8>_<secret43>
```

A public 8-character lookup id and a 32-byte base64url secret. The `cst_` prefix makes a leaked token greppable in logs and CI output; the public id lets the UI show `cst_a1b2c3d4…` without storing anything sensitive.

### Table

New migration `supabase/migrations/20260911000000_cli_tokens.sql`:

| Column | Notes |
|---|---|
| `id text primary key` | the public `id8` |
| `member_id uuid not null references public.members(id) on delete cascade` | the token acts as this member |
| `name text not null` | human label — "laptop", "ci" |
| `token_hash text not null` | SHA-256 of the secret, hex |
| `created_at timestamptz not null default now()` | |
| `last_used_at timestamptz` | stamped on use, best-effort |
| `expires_at timestamptz` | null means no expiry |
| `revoked_at timestamptz` | set instead of deleting, so a revoked token stays auditable |

Index on `member_id` for the profile listing; the primary key serves verification.

SHA-256 rather than bcrypt or argon2: the secret is 256 bits of CSPRNG output, so there is no entropy to brute-force and no reason to pay a work factor on a path every single request hits. Work factors defend low-entropy human passwords; this is not one.

RLS on `cli_tokens` restricts select and update to the owning member's rows (`member_id` resolved through `current_email()`), so the profile page can list and revoke through the normal cookie client. The API reads the table through the service client regardless.

### Scope

A token acts as its member and carries exactly that member's permissions — no narrower grants. #15's residual asks to "scope access to the user's permissions", and per-project or read-only token scoping is a feature nobody has asked for.

### Verification

`src/lib/api/token.ts`:

- `mintToken(name, expiresAt)` → `{ plaintext, row }`. The plaintext is returned once and never stored.
- `verifyToken(header)` → `{ ok: true, member } | { ok: false, code }`. Parses the header, rejects a malformed prefix without a database round-trip, looks the row up by public id, compares hashes in constant time, then rejects `revoked_at` or a past `expires_at`. `last_used_at` is stamped fire-and-forget: a failed stamp must never fail the request.

Codes are the API's own (`unauthenticated`), never a message that distinguishes "no such token" from "wrong secret".

## The surface

Everything lives under `/api/v1/`. The version prefix is what lets #19 move Designer and Website onto the CLI without a flag day later.

### The wrapper

`src/lib/api/route.ts` exports `withToken(handler)`. It verifies the token, resolves the project and board slugs, computes the member's role with `canManageProject`, and calls the handler with a ready context:

```ts
type ApiContext = {
  member: Member;
  project: { id: string; slug: string };
  board: { id: string; slug: string; settings: Record<string, unknown> };
  canManage: boolean;
  db: SupabaseClient; // service role
};
```

**Handlers never construct a client.** That rule is what keeps the service-role bypass honest: the only code that decides whether a request is allowed is the wrapper, and it is one file with its own tests. A handler that wants to write asserts `canManage` and returns `forbidden` otherwise.

Board-scoped routes 404 rather than 403 on a project the member cannot see, so the API does not confirm the existence of boards to people who are not on them.

### Routes

| Route | Purpose |
|---|---|
| `GET /api/v1/boards` | Discovery. Every project and board the member can reach, with their role on each. |
| `GET /api/v1/boards/:project/:board` | Vocabulary. Lanes, tag groups and their tags, epics, the project roster, board settings, and the board etag. |
| `GET /api/v1/boards/:project/:board/sheets` | Snapshot. Every card as a markdown sheet, with its `external_id` and revision, plus the board etag. |
| `POST /api/v1/boards/:project/:board/sync` | Plan a set of sheets and, if asked, apply them. |

JSON rather than the existing zip export: #17 needs to diff sheets, and unzipping to do that is a step with no purpose.

### Errors

Every failure is `{ "error": { "code", "message", "details"? } }` with a matching status:

| Code | Status |
|---|---|
| `unauthenticated` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `invalid_request` | 422 |
| `conflict` | 409 |

`details` carries structure the CLI can act on — the conflicting cards, the offending sheet names — never a stack trace or a database message. A Supabase error is logged server-side and reported as a generic 500.

## Revisions and conflicts

A card's revision is its `updated_at`, returned with every sheet in the snapshot. The sync request:

```json
POST /api/v1/boards/cardstock/cardstock-dev/sync
{ "apply": true,
  "sheets": [
    { "name": "16.md",
      "text": "---\nid: 16\n…",
      "revision": "2026-09-06T12:04:11.882Z" }
  ] }
```

The server loads fresh board state and runs `planImport`. With `apply: false` it returns the plan and stops — which is #17's dry-run, obtained off the same code path that does the real write, so preview cannot drift from apply.

With `apply: true`, every row the planner classifies as `changed` must carry a `revision`. A missing one is `409 revision_required`, not a silent overwrite: the API is safe by default, and a client that has not read the board cannot clobber it.

The check goes **into** the write, not in front of it. `applyPlan` gains an optional expected-revision map and adds `.eq("updated_at", expected)` to each card update; a lost update then surfaces as zero rows affected rather than as a race between a check and a write that happen milliseconds apart.

`applyPlan` is not transactional, so a conflict discovered part-way leaves earlier cards written. Rather than pretend otherwise, the response says so:

```json
{ "applied": ["14", "15"], "conflicted": ["16"], "skipped": ["17"], "plan": { … } }
```

That is the shape #18's recovery journal needs anyway. A partial apply is reported, never hidden.

### The board etag

Both GET routes return an `etag` — a hash over the maximum `updated_at` across cards, lanes, tag groups and tags. It lets a client ask "has anything at all changed?" without pulling every sheet, and gives #17 a cheap no-op check.

## One change to existing code

`exportBoardEntries` rebases `source_text` and `lane_from_source` as a side effect of reading, which is right for a download and wrong for a GET that any client may call on a loop. It splits into:

- `boardSheets(db, boardId, prefix?)` — pure. Returns the sheets and the rebase rows it *would* write.
- `rebaseSources(db, rows)` — the write half, unchanged in behaviour.

`exportBoardEntries` keeps its signature and calls both, so the zip routes are untouched. The API calls only `boardSheets`. This is the only refactor in scope; nothing else in `src/lib/import/` moves.

## Minting

The profile page gains a **CLI tokens** section: a name, an optional expiry, and a create button. The plaintext is shown exactly once, with an explicit "this will not be shown again". Below it, the member's tokens — prefix, name, created, last used, expiry — each with a revoke button.

Server actions go in `src/app/profile/actions.ts` alongside the existing profile actions, cookie-authenticated like everything else there. #15 later replaces the copy-and-paste step with a browser approval flow; it does not replace this table or this page.

## Testing

- `src/lib/api/token.test.ts` — format parsing, hashing, constant-time compare, expiry, revocation, and that a malformed header short-circuits before any query.
- `src/lib/api/route.test.ts` — the wrapper: unauthenticated, revoked, expired, non-member, member without manage rights on a write, unknown project, unknown board.
- `src/lib/api/routes.integration.test.ts` — real `Request` objects against each handler on the local Supabase, guarded by the `describe.skipIf(!local)` pattern from `src/lib/import/apply.integration.test.ts`. Covers each route's happy path, and a conflict test that mutates a card between snapshot and sync to prove both the 409 and that the card was not written.
- `e2e/cli-token.spec.ts` — mint and revoke through the profile UI, including that the plaintext appears once and not on reload.
- `bun run check` and a production `next build` before the item moves to Building.

## Risks

**The service-role bypass.** Every authorization decision on this path is TypeScript, not Postgres. Mitigated by funnelling all of it through `withToken`, giving that file its own test file, and forbidding handlers from constructing clients — but it is the thing to watch in review, and any future route added under `/api/v1/` must go through the wrapper.

**Partial applies.** Documented above and reported in the response rather than smoothed over. #18 owns the journal that makes recovery automatic.

**Token leakage.** Tokens are bearer credentials with the member's full permissions. The `cst_` prefix aids secret scanning, expiry is offered at mint time, and revocation is immediate because verification reads the row on every request.
