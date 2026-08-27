# cardstock

Turn markdown files into a Kanban experience with Grooming, Planning Poker and Dynamic Lanes.

A hosted board over a markdown tracker. Your team keeps writing one `.md` per item — by hand or with agents — and the product owner gets a board they can open at two in the morning, drag around, prioritise, date, and export. The ETL brings the markdown in; the app owns the board decisions; a later ETL writes those decisions back into the files.

- **Projects → boards → lanes.** A project is a team or a product; members belong to projects; each board has its own lanes and tag groups. Lane *kinds* (`inbox`, `work`, `waiting`, `built`, `done`, `archive`) drive behaviour; names are yours.
- **Work lanes are editable on the board.** Add, rename, move, or remove ordinary work lanes inline. A lane's generated key is permanent because that key is what card frontmatter stores; removing a lane transactionally moves its cards to a destination you choose.
- **Cards carry the review's decisions**: lane and rank, **priority P1–P3**, **difficulty L/M/H**, a real **target date** plus a rough-date label, tags across your groups, an audience flag, archive-with-attribution, and a full event history.
- **Markdown owns the narrative**, the app owns the board. Unknown frontmatter keys round-trip untouched.

## Stack

bun · Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19 · TypeScript · Tailwind 4 + shadcn · Biome · Supabase (Postgres, Auth magic link) via `@supabase/ssr` · dnd-kit · `bun test` + Playwright · Vercel.

## Run it locally

```sh
bun install
bunx supabase start                       # Postgres + Auth + Mailpit in Docker
bun run db:reset                          # migrations + seed (demo project + board)
cp .env.example .env.local                # set OWNER_EMAIL
bun run db:seed-members --project demo    # owner + allowlist + project membership
bun run etl:import --project demo --board backlog --source examples/tracker
bun run dev                               # http://localhost:3000
```

cardstock is **invite-only**: `members` is the allowlist, and an email that is not on it never gets a session — the link request is refused, the magic-link callback signs the user back out, and row-level security shows them nothing.

The **Owner** is whoever deploys the app and owns its infrastructure. `OWNER_EMAIL` bootstraps that row on a fresh database; from then on `members.role = 'owner'` is the source of truth, and only an owner may add people (by SQL today, by UI later). There is no owner UI yet — this is the setup it will sit on.

Sign in with a magic link (locally the mail lands in Mailpit at http://127.0.0.1:54324). With `NEXT_PUBLIC_DEV_LOGIN=1` the login screen also offers a passwordless **Sign in (local dev)** button — it refuses to run unless `NODE_ENV` is not `production` *and* the Supabase URL points at this machine, and the allowlist still applies.

## ETL

| Command | What it does |
|---|---|
| `bun run etl:import --project <p> --board <b> --source <dir>` | Parse `<id>.md` files, validate against `etl/schema.ts`, upsert by `(board, external_id)`. Markdown owns title/status/body/epic/area/dates/needs/relates/tags; the DB owns lane/rank/priority/effort/target/audience/archive. Built/closed statuses re-pin to Built/Done; unchanged files are skipped by hash. |
| `bun run etl:import-board-state --project <p> --board <b> --file <export.json>` | Apply a `designer-board/1` export (lane, rank, target, effort, value→priority) on top of imported cards. |
| `bun run etl:schema` | Emit `docs/frontmatter.schema.json` from the zod schema. |
| `bun run db:seed-members --project <slug>` | `OWNER_EMAIL` → owner, `MEMBER_EMAILS` → admins, both into `members` + `project_members`. |
| `bun run db:test` | Access-control checks against the local database (owner, allowlist, RLS). |

Scheme tags map 1:1 onto a board's tag groups; per-project overrides go in a JSON passed with `--mapping` (default `etl/mappings/default.json`). Keep a real project's seed SQL and mapping next to its tracker, outside this repo.

Lane definitions remain database configuration rather than part of the markdown contract. The export writes every card's current lane key, and import resolves that key against the board's current lanes. Renaming a lane therefore leaves markdown references intact; removing one rewrites affected cards to the selected destination on the next export.

## Checks

```sh
bun run check      # biome + tsc
bun test           # ETL unit tests
bun run test:e2e   # Playwright against the local stack (uses the installed Chrome)
```

## Deploy

See `docs/deploy.md` — hosted Supabase (migrations pushed with the CLI, Auth redirect URLs) and Vercel (bun build, two public env vars; the service-role key never leaves your machine).

## Docs

- `docs/specs/2026-08-26-cardstock-design.md` — design and decisions
- `docs/plans/2026-08-26-implementation-plan.md` — phases
- `docs/frontmatter.schema.json` — the tracker contract

MIT.
