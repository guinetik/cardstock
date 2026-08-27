# Implementation plan — cardstock v1

Spec: `docs/specs/2026-08-26-cardstock-design.md`. Each phase ends green (`bun run check`, `bun test`, Playwright where it applies) and committed.

1. **Foundation** — Next 16 scaffold (bun, Biome, Tailwind, shadcn), local Supabase, migration `0001_init` (members, projects, project_members, boards, lanes, cards, tags, links, attachments, events, RLS by project), seed (demo project, backlog board, lanes, tag groups), `.env.local`, `bun run db:*` scripts.
2. **ETL** — `etl/schema.ts` (zod + JSON Schema emit), `etl/parse.ts` (lenient frontmatter, body, ask summary), `etl/mappings/default.json`, `etl/import.ts` (upsert, ownership rules, pins, tags, links, events, hash skip), `etl/import-board-state.ts` (designer-board/1 → lane/rank/priority/effort/target), `etl/seed-members.ts`. `bun test` over parse/schema/mapping/rank. Import the real tracker + the 08-26 export into local.
3. **Auth + shell** — `@supabase/ssr` clients, `proxy.ts` gate, `/login` magic link (Mailpit locally), `/auth/callback`, member check, `/` projects list, `/p/[project]` boards + members.
4. **Board** — `/p/[project]/b/[board]`: server load (lanes, cards, tags), client kanban with dnd-kit (pointer + keyboard), optimistic moves, server actions `moveCard`, `updateCard` (priority/effort/target/summary/audience), `archiveCard`; filter bar (search, tag groups, priority, effort, audience, archived); lane min/max; inbox sort preference; waiting-lane SLA badge; CSV export route.
5. **Card detail + timeline** — `/c/[external_id]` (summary, fields, tags, links, body via marked, events, archive/restore), `/timeline` grouped by month.
6. **Settings** — lanes and tag groups CRUD (minimal).
7. **Tests + docs** — Playwright suite against local stack with the password test member; `docs/deploy.md` for Vercel + hosted Supabase; README rewrite.
