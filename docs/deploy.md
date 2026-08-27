# Deploying — hosted Supabase + Vercel

Two projects to create, then a handful of values to wire. Nothing secret goes to Vercel except the anon key, which is public by design.

## 1. Supabase (hosted)

1. https://supabase.com/dashboard → **New project** (pick the region nearest the reviewers; note the database password).
2. Link and push the schema from this repo:
   ```sh
   bunx supabase login
   bunx supabase link --project-ref <ref>        # ref is in the project URL
   bunx supabase db push                          # applies supabase/migrations/*
   bun run db:apply --file supabase/seed.sql              # demo project (SUPABASE_DB_URL = the hosted connection string); your project's seed the same way
   ```
3. **Authentication → URL Configuration**: Site URL `https://<your-vercel-domain>`; add `https://<your-vercel-domain>/auth/callback` (and any preview domains) to Redirect URLs.
4. **Authentication → Providers → Email**: keep *Enable email provider* on; *Confirm email* can stay on — magic links confirm anyway.
5. **Authentication → SMTP Settings**: wire Resend *before* inviting anyone. Supabase's built-in sender is capped at **2 emails per hour** for the whole project (the same default is visible locally as `email_sent` under `[auth.rate_limit]` in `supabase/config.toml`) — two sign-ins in an hour and the third person's magic link silently never arrives.
   - Resend → **Domains** → add a domain you control, add the SPF/DKIM records it prints to your DNS, wait for *Verified*. The shared `onboarding@resend.dev` sender only delivers to the address that owns the Resend account, so it cannot serve an allowlist.
   - Resend → **API Keys** → create one with *Sending access*.
   - Back in Supabase, enable custom SMTP: host `smtp.resend.com`, port `587`, username `resend`, password = the Resend API key, sender address `something@<your verified domain>`.
   - Then check **Authentication → Rate Limits**: the 2/hour cap only applies to the built-in sender, but confirm the custom-SMTP limit is above your expected sign-in rate. Resend's free tier allows 3,000 emails/month and 100/day.

   Local dev is unaffected — `bunx supabase start` keeps routing mail to Mailpit at http://127.0.0.1:54324.
6. **Project Settings → API**: copy the Project URL and the anon/publishable key (for Vercel) and the service-role key (for your `.env.local` only).

## 2. Members

On your machine, with `.env.local` pointing at the hosted project (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and `MEMBER_EMAILS=you@…,owner@…,teammate@…`:

```sh
bun run db:seed-members --project <slug>
bun run etl:import --project <slug> --board <slug> --source <your tracker dir> --mapping <your mapping.json>
bun run etl:import-board-state --project <slug> --board <slug> --file <export>.json   # optional: carry over a file-based board
```

Leave `E2E_MEMBER_*` unset against a hosted project; the script refuses to create the password user there anyway.

## 3. Vercel

1. https://vercel.com/new → import `guinetik/cardstock`. Framework is detected as Next.js; the presence of `bun.lock` + `"packageManager": "bun@1.4.0"` makes Vercel install and build with bun.
2. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/publishable key
   - do **not** add `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_ALLOW_PASSWORD_LOGIN`
3. Deploy. The first sign-in is a magic link to an allowlisted email; anyone else sees *"This board is invite-only."*

## 4. Day to day

- New tracker items: run `etl:import` from your machine (it is a local tool by design), the board updates on the next page load.
- Adding a person: project page → *Add member* (or `MEMBER_EMAILS` + `db:seed-members`).
- Schema changes: add a migration under `supabase/migrations/`, `bunx supabase db push`.
