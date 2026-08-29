# cardstock

Turn markdown files into a Kanban experience with Grooming, Planning Poker and Dynamic Lanes.

A hosted board over a markdown tracker. Your team keeps writing one `.md` per item — by hand or with agents — and the product owner gets a board they can open at two in the morning, drag around, prioritise, date, and export. The ETL brings the markdown in; the app owns the board decisions; a later ETL writes those decisions back into the files.

- **Projects → boards → lanes.** A project is a team or a product; members belong to projects; each board has its own lanes and tag groups. Lane *kinds* (`inbox`, `work`, `waiting`, `built`, `done`, `archive`) drive behaviour; names are yours.
- **Work lanes are editable on the board.** Add, rename, move, or remove ordinary work lanes inline. A lane's generated key is permanent because that key is what card frontmatter stores; removing a lane transactionally moves its cards to a destination you choose.
- **Cards carry the review's decisions**: lane and rank, **priority P1–P3**, **difficulty L/M/H**, a real **target date** plus a rough-date label, tags across your groups, an audience flag, archive-with-attribution, and a full event history.
- **Markdown owns the narrative**, the app owns the board. Unknown frontmatter keys round-trip untouched.

## Stack

bun · Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19 · TypeScript · Tailwind 4 + shadcn · Biome · Supabase (Postgres, Auth email + password) via `@supabase/ssr` · dnd-kit · `bun test` + Playwright · Vercel.

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

cardstock is **invite-only**: `members` is the allowlist, and an email that is not on it never gets a session — onboarding is refused before any account is created, sign-in signs the user straight back out, and row-level security shows them nothing.

The **Owner** is whoever deploys the app and owns its infrastructure — one person, bootstrapped from `OWNER_EMAIL`. From then on `members.role = 'owner'` is the source of truth and the unique index refuses a second owner. Owners create projects from the projects page and manage the allowlist at `/users`. A project admin can invite **members** to that project, create boards, and export them; ordinary members use the boards and edit cards. Inviting records the address but sends no email; share the app URL and the person chooses a password on their first visit.

Sign in with an email and a password. Someone who has just been invited picks their password on the login screen the first time — that is the whole onboarding, and no mail is involved. `signUp` cannot replace a password that already exists, so the form can create a first one but never take over an account.

This needs **email confirmation switched off** on the Supabase project (Authentication → Sign In / Providers → Email); the local `supabase/config.toml` already has it off. When it is on, setting a password returns no session and the screen says so.

A fresh local database has an allowlist but no passwords, so give yourself one:

```sh
bun run db:seed-members --project <slug>   # OWNER_EMAIL onto the allowlist
bun run db:dev-password                    # OWNER_EMAIL, password admin123
```

`db:dev-password` refuses to run against anything but a Supabase on this machine. The e2e suite signs in the same way a person does, with that account.

Resetting a forgotten password is not built yet — it needs mail. Until then, clear the account in the Supabase dashboard and let the person onboard again.

## ETL

| Command | What it does |
|---|---|
| `bun run etl:import --project <p> --board <b> --source <dir>` | Same planner as the projects page; a file only moves an existing card when its `lane:` changed since the last sync. |
| `bun run etl:import-board-state --project <p> --board <b> --file <export.json>` | Apply a `designer-board/1` export (lane, rank, target, effort, value→priority) on top of imported cards. |
| `bun run etl:schema` | Emit `docs/frontmatter.schema.json` from the zod schema. |
| `bun run db:seed-members --project <slug>` | `OWNER_EMAIL` → site owner, `MEMBER_EMAILS` → project admins, both into `members` + `project_members`. |
| `bun run db:pull-prod` | Copy production into the local stack: dumps the hosted database (`PROD_DB_URL`) to `backups/`, resets local without the seed, replays public rows and auth users. `--restore <stamp>` replays a saved backup; `--dump-only` just writes it. Refuses to write anywhere but a local Supabase. |
| `bun run db:test` | Access-control checks against the local database (owner, allowlist, RLS). |

### Importing a project from the command line

The projects page can do this from a zip. The command line is for trackers over 4 MB or for scripted seeds:

1. Write a seed next to the tracker — project, board, lanes in order with kinds, tag groups — and apply it: `bun run db:apply --file path/to/seed.sql`.
2. `bun run etl:import --project <slug> --board <slug> --source path/to/tracker`.
3. `bun run db:seed-members --project <slug>` to let people in.

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

- `docs/fichario.md` — **the fichário**: why it is called cardstock, and what the name decides
- `docs/paper.md` — **Paper**, the design system: stock, pen and highlighter, type, lanes
- `docs/realtime.md` — live board: how two people see each other's moves
- `docs/specs/2026-08-26-cardstock-design.md` — design and decisions
- `docs/plans/2026-08-26-implementation-plan.md` — phases
- `docs/frontmatter.schema.json` — the tracker contract

MIT.
