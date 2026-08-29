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
4. **Authentication → Sign In / Providers → Email**: keep *Enable email provider* on and switch *Confirm email* **off**. Sign-in is email + password and an invited person sets theirs on first use; with confirmation on, that returns no session and nobody can onboard. The invite itself is the confirmation — the allowlist is what decides who gets in.
5. **Authentication → SMTP Settings**: not needed for sign-in — nothing in the flow sends mail. Wire Resend when password reset arrives, and note the built-in sender is capped at **2 emails per hour** for the whole project (visible locally as `email_sent` under `[auth.rate_limit]` in `supabase/config.toml`).
   - Resend → **Domains** → add a domain you control, add the SPF/DKIM records it prints to your DNS, wait for *Verified*. The shared `onboarding@resend.dev` sender only delivers to the address that owns the Resend account, so it cannot serve an allowlist.
   - Resend → **API Keys** → create one with *Sending access*.
   - Back in Supabase, enable custom SMTP: host `smtp.resend.com`, port `587`, username `resend`, password = the Resend API key, sender address `something@<your verified domain>`.
   - Then check **Authentication → Rate Limits**: the 2/hour cap only applies to the built-in sender, but confirm the custom-SMTP limit is above your expected sign-in rate. Resend's free tier allows 3,000 emails/month and 100/day.

   Local dev is unaffected — `bunx supabase start` keeps routing mail to Mailpit at http://127.0.0.1:54324.
6. **Project Settings → API**: copy the Project URL and the anon/publishable key (for Vercel) and the service-role key (for your `.env.local` only).

## 2. Members

On your machine, with `.env.local` pointing at the hosted project (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), `OWNER_EMAIL=you@…` and optionally `MEMBER_EMAILS=teammate@…`:

```sh
bun run db:seed-members --project <slug>
bun run etl:import --project <slug> --board <slug> --source <your tracker dir> --mapping <your mapping.json>
bun run etl:import-board-state --project <slug> --board <slug> --file <export>.json   # optional: carry over a file-based board
```

Seeding only fills the allowlist. Each person sets their own password the first time they sign in, so there is nothing else to provision — but the project must have **Confirm email** switched off (Authentication → Sign In / Providers → Email), or `signUp` returns no session and nobody can onboard.

## 3. Vercel

1. https://vercel.com/new → import `guinetik/cardstock`. Framework is detected as Next.js; the presence of `bun.lock` + `"packageManager": "bun@1.4.0"` makes Vercel install and build with bun.
2. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/publishable key
   - do **not** add `SUPABASE_SERVICE_ROLE_KEY` — the app never needs it, and it bypasses every row-level policy
3. Deploy. The owner onboards like anyone else: *First time here? Set your password* on `/login`, using `OWNER_EMAIL`. Anyone not on the allowlist is told the beta is invite-only, and no account is created for them.

## 4. Day to day

- New tracker items: run `etl:import` from your machine (it is a local tool by design), the board updates on the next page load.
- Adding a person: the **owner** (any project, including as a project admin) or a **project admin** (members of that project only). Open the project page (`/p/<slug>`) or, as owner, `/users`. No email is sent; share the app URL so they can set a password on first use. Only the owner can invite another project admin. `MEMBER_EMAILS` + `db:seed-members` remains available for bootstrap and automation.
- Schema changes: add a migration under `supabase/migrations/`, `bunx supabase db push`.
