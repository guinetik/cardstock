# cardstock — design

**Date:** 2026-08-26
**Status:** approved in conversation; implementation follows this document.
**Origin:** the single-file backlog board it grew out of — a Vue app built from tracker markdown. Its rules and JSON contract carry over; the rendering and persistence are replaced.

---

## The problem

The board lived on one laptop. The product owner's first question on seeing it was *"if I wanted to look at it, and I want to reprioritize it, am I able to access this?"* and his fallback was *"can Claude just export this into an Excel? And I will sort it myself"*. A file generated per week cannot be edited by him, cannot carry his priorities back, and cannot be opened at two in the morning. The tracker itself — one markdown file per item, edited by people and agents — is the right source for the narrative and must stay.

## What we're building

An open-source, hosted kanban over markdown trackers: **cardstock**. One deployment, many **projects** (a team or a product — one today, whatever comes next tomorrow, other consumers of the app entirely); each project has members and boards; each board has configurable lanes and tag groups; cards are imported from a markdown tracker by an ETL and edited in the app; the app's decisions (lane, rank, priority, effort, date, archive) are exported back into the markdown later.

The first board is a real product backlog, and its lanes, tag groups and vocabulary are **seed data**, not code. The product owner's words are used verbatim where he gave them.

### Stack

bun 1.4 · Next.js 16.3 (App Router, Turbopack, `proxy.ts`) · React 19.2 · TypeScript 7 · Tailwind 4.3 + shadcn 4 · Biome 2.5 · Supabase (Postgres, Auth magic link, Storage) via `@supabase/ssr` · dnd-kit · `bun test` + Playwright · Vercel.

### Users and access

Sign-in is a magic link. `members` is the global allowlist: an email not in it gets a signed-out page even after a valid link. Access to data is **per project**: `project_members` says who belongs to which project and with what role — every member of a project is `admin` for now, and the column exists so that changes later without a migration. Row-level security on every table resolves to `is_project_member(project_id)` (the JWT email is a member of that project); boards, lanes, cards, tags and events inherit the project through their board.

## Data model

All tables in `public`, RLS enabled. `members` and `projects` are readable by any member; everything else uses `for all using (is_project_member(<project_id via joins>))`, implemented as one SQL function per table so the policies stay readable.

| Table | Columns (beyond `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`) |
|---|---|
| `members` | `email citext unique`, `display_name`, `role text default 'admin'`, `prefs jsonb default '{}'` (per-user sort etc.) |
| `projects` | `slug text unique`, `name`, `description`, `settings jsonb` |
| `project_members` | `project_id fk`, `member_id fk`, `role text default 'admin'`; pk both |
| `boards` | `project_id fk`, `slug text`, `name`, `settings jsonb` (`status_to_lane`, `lane_aliases`, `needs_lane`, `recent_days`); unique `(project_id, slug)` |
| `lanes` | `board_id fk`, `key text`, `name`, `position int`, `kind text check in ('inbox','work','waiting','built','done','archive')`, `sla_days int null`, `wip_limit int null`; unique `(board_id, key)` |
| `cards` | `board_id fk`, `external_id text` (tracker `id`), `title`, `summary text`, `body_md text`, `status text` (tracker vocabulary), `epic`, `area`, `raised_by`, `raised_on date`, `shipped_on date`, `needs text`, `lane_id fk`, `rank double precision`, `priority smallint check 1..3 null`, `effort text check in ('L','M','H') null`, `target_date date null`, `target_label text`, `audience text default 'all' check in ('all','internal')`, `archived_at timestamptz`, `archived_by text`, `source_path`, `source_hash`, `frontmatter_extra jsonb default '{}'`; unique `(board_id, external_id)` |
| `tag_groups` | `board_id fk`, `key`, `name`, `position`, `color`; unique `(board_id, key)` |
| `tags` | `group_id fk`, `key`, `name`, `color`; unique `(group_id, key)` |
| `card_tags` | `card_id fk`, `tag_id fk`; pk both |
| `card_links` | `from_card fk`, `to_card fk`, `kind text check in ('relates','blocked_by')`; pk all three |
| `attachments` | `card_id fk`, `storage_path`, `name`, `mime`, `size`, `created_by` — schema now, UI in v1.1 |
| `card_events` | `card_id fk`, `actor text`, `kind text` (`moved`, `edited`, `archived`, `restored`, `imported`), `payload jsonb`, `at timestamptz` |

**Lane `kind` drives behaviour**, so the seed decides the board and the code stays generic:

- `inbox` — new cards land here; per-user sort (newest first by default, **oldest first** is a preference the product owner asked for: *"the oldest stuff is the hardest for me to prioritize"*).
- `work` — plain priority lanes; drag order is the rank.
- `waiting` — cards show days-in-lane; past `sla_days` the badge turns red (*"I can't have it there more than 5 days"*).
- `built` / `done` — status-pinned: the ETL moves cards here from the tracker's status and the UI keeps them draggable but re-pins on the next import.
- `archive` — hidden by default; *"if I say get rid of it, just get rid of it"* becomes archive-with-attribution, never a delete.

**Rank** is fractional: inserting between `a` and `b` writes `(a+b)/2`; a lane is renormalised to integers when any gap drops below `1e-6`.

## Frontmatter schema

`etl/schema.ts` (zod) is the contract with the tracker; `docs/frontmatter.schema.json` is generated from it for humans and other tools.

- **Required** (exactly what the tracker's validator enforces today): `id` int, `title`, `status` ∈ backlog | blocked | wip | held | built | handed | shipped | done, `epic`, `area`, `tags` (must include `tracker-item`).
- **Known optional, typed:** `value`, `effort` (L/M/H), `raised_by`, `raised`, `reconfirmed`, `shipped`, `merged` (ISO dates), `target`, `branch`, `spec`, `plan`, `relates` (int[]), `needs`, and the app's own round-trip keys `lane`, `rank`, `priority`.
- **Anything else** is preserved in `cards.frontmatter_extra` and written back verbatim on export. The schema is permissive on unknown keys and strict on the required set; a failing file aborts the import with its name and the missing keys.

Body sections (`## Ask`, `## Status`, …) are stored whole in `body_md`; `summary` is seeded from the first paragraph of `## Ask` (plain text, wiki-links reduced) and is editable in the app.

## ETL

`etl/` is a bun workspace of plain TypeScript run with the **service-role key from `.env.local`, never from the browser or Vercel**.

- `bun run etl:import --project <slug> --board <slug> --source <dir>` — parse every `*.md`, validate, upsert by `(board, external_id)`.
  **Markdown owns:** title, status, body (until `body_edited_at` is set), epic, area, raised_by/raised/shipped/needs, relates, tags (mapped through `etl/mappings/<slug>.json` into the board's tag groups), `frontmatter_extra`.
  **DB owns:** lane, rank, priority, effort, target_date/label, audience, summary (once edited), body_md (once `body_edited_at` is set), archive.
  **Exceptions:** a *new* card takes its lane from `settings.status_to_lane` (then `needs` → the waiting lane); on every import a card whose status is built/handed/held or shipped/done is re-pinned to the built/done lane; `effort`/`value` in frontmatter seed the DB fields only when those are null (`value` H/M/L → priority 1/2/3). Unchanged files (same `source_hash`) are skipped. Every change writes a `card_events` row with `kind: 'imported'`.
- `bun run etl:import-board-state <file.json>` — applies a `designer-board/1` export (lanes, rank, target, effort, value) on top of imported cards; lane names go through `settings.lane_aliases` (`Needs input` → the waiting lane key). Used once to seed the hosted board from the last file-based review.
- `bun run etl:export --project <slug> --board <slug> --source <dir>` — writes `lane`, `rank`, `priority`, `effort`, `target`, and `archived` into each card's frontmatter. When `body_edited_at` is set, also writes `body_md` back with the tracker H1 (`# #n — title`) restored. Files nobody has edited in the app stay byte-identical aside from managed keys.

## App

- `/login` — email → magic link; a non-member sees *"This board is invite-only."*
- `/` — the projects the signed-in member belongs to, each with its boards (one project, one board today).
- `/p/[project]` — project home: boards, members (add by email — creates the `members` allowlist row and the `project_members` row).
- `/p/[project]/b/[board]` — the kanban. Filter bar: search, one dropdown per tag group, priority, effort, audience (the product owner's default hides `internal`: *"get that out of my list"*), "show archived". Lanes in `position` order with counts, min/max per lane, per-lane sort; cards drag with dnd-kit (pointer + keyboard sensors), optimistic update, server action persists and writes the event. Card face: `#external_id`, status badge, `needs` badge, title, summary, epic + raised date, target, priority P1–P3, effort L/M/H, tag chips. CSV export of the current filter (*"as long as I can slice it and dice it"*).
- `/p/[project]/b/[board]/timeline` — cards with a `target_date`, grouped by month, then unscheduled; the "September, October, November, December in front of me" view.
- `/p/[project]/b/[board]/c/[external_id]` — card detail: editable summary, fields, tags, links (`blocked_by` chips), rendered body (editable via MDXEditor), comments stored at the bottom of `body_md` after `## Comments`, attachments (v1.1), event history, Archive / Restore.
- `/p/[project]/b/[board]/settings` — lanes (name, kind, SLA, order) and tag groups/tags. Minimal, admin only (everyone).
- Server components read through the SSR Supabase client; mutations are server actions; `proxy.ts` redirects signed-out requests to `/login`.

## Seed (`supabase/seed.sql`)

Project `demo` (*Demo*) with board `backlog` (*Product backlog*) — lanes: Unsorted (inbox) · Now · Next · Later · Nice-to-have · Parked (work) · **Needs input** (waiting, SLA 5) · Built (built) · **Gate 1** · **Gate 2** (work) · Done (done) · Archive (archive). Tag groups: **Area**, **Step**, **Kind**, **Objective**. `status_to_lane`, `lane_aliases`, `needs_lane` in `settings`. A real project keeps its own seed next to its tracker and applies it with `bun run db:apply` — the lane kinds are the only thing the code knows. Members come from `MEMBER_EMAILS` in the environment (each becomes a `members` row and a `project_members` row on the project) so no addresses are committed.

## Testing

- `bun test` — frontmatter schema and parser, tag mapping, rank maths, lane-kind rules, board-state import mapping.
- Playwright — against `next dev` + local Supabase with a password-enabled test member (local only): sign-in gate, drag between/within lanes, priority/effort/date edits, filters, archive/restore, timeline grouping, CSV export, ETL import idempotence (run twice, second run is a no-op).
- Biome and `tsc --noEmit` in `bun run check`.

## Deployment

Vercel builds with bun (`bun.lock` present, `packageManager` pinned). Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel; `SUPABASE_SERVICE_ROLE_KEY` only in local `.env.local` for the ETL. Hosted Supabase project + Vercel project are created by the owner after this pass; `docs/deploy.md` lists the exact steps and the Auth redirect URLs to register.

## Decisions taken (flag at review if wrong)

1. **Priority is 1–3, not L/M/H.** The product owner said *"I'll categorize them 1, 2, or 3"*; the old board's `value` H/M/L maps to P1/P2/P3 on import.
2. **`target_date` is a real date; `target_label` keeps the words.** He wants to sort and see months; he also says "after new hire". Both survive.
3. **Archive, not delete.** Attribution answers his *"not without my say-so"*, and nothing is lost for the wiki round-trip.
4. **Audience is a card flag, not a separate board.** His *"get that out of my list"* is a filter default, and the engineers still see everything in one place.
5. **Gate 1 / Gate 2 are plain `work` lanes** placed after Built. Nothing special in code; the seed puts them there because he asked to see things before they reach Done.
6. **Lane behaviour comes from `kind`, names from the seed.** That is what keeps the tool open-source and the first board a configuration.
8. **Projects are the tenancy boundary.** A project is a team or a product; membership and RLS hang off it, boards belong to it, and a second project (another initiative from the same team, or another company using the app) needs no schema change. Added at the owner's request during design.
7. **Service-role key never reaches the browser or Vercel.** The ETL is a local tool run by the engineer.
