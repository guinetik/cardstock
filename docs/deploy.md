# Deploying — hosted Supabase + Vercel

Two projects to create, then a handful of values to wire. The CLI API requires a server-only Supabase service-role key; never expose it through a NEXT_PUBLIC variable.

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
6. **Project Settings → API**: copy the Project URL and the anon/publishable key, plus the service-role key for server-only Vercel configuration and local administration.

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
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only; required by CLI sign-in and the authorization-guarded board API. Never prefix it with `NEXT_PUBLIC` or store it in tracker configuration.
3. Deploy. The owner onboards like anyone else: *First time here? Set your password* on `/login`, using `OWNER_EMAIL`. Anyone not on the allowlist is told the beta is invite-only, and no account is created for them.

## 4. Day to day

- New tracker items: run `etl:import` from your machine (it is a local tool by design), the board updates on the next page load.
- Adding a person: the **owner** (any project, including as a project admin) or a **project admin** (members of that project only). Open the project page (`/p/<slug>`) or, as owner, `/users`. No email is sent; share the app URL so they can set a password on first use. Only the owner can invite another project admin. `MEMBER_EMAILS` + `db:seed-members` remains available for bootstrap and automation.
- Schema changes: add a migration under `supabase/migrations/`, `bunx supabase db push`.

## Card watching and email delivery

Apply `20260917000000_card_watches.sql` and
`20260918000000_watch_notifications.sql` before deploying the matching app.
Set `GUINETIK_MAIL_KEY`, `CARDSTOCK_APP_URL` (the canonical HTTPS app URL), and
`CRON_SECRET` (a random secret of at least 32 characters) in Vercel. The service-role
key is also required by the delivery worker. Watch emails are disabled in local
development unless `CARDSTOCK_NOTIFICATION_EMAILS=true`.

After the app is deployed, run `bun run etl/configure-watch-mail.ts` with
`SUPABASE_DB_URL` pointing at the deployment database and the same `CARDSTOCK_APP_URL`
and `CRON_SECRET`. This stores the worker URL and secret in Supabase Vault and
configures Supabase Cron to call the worker every minute. The setup is repeatable
and updates the existing named job. It follows Supabase's
[scheduled HTTP requests with Vault](https://supabase.com/docs/guides/functions/schedule-functions).
It does not require a Vercel Cron plan. Check the `cardstock-watch-mail` job in
Supabase Cron and confirm successful HTTP responses after deployment.

App mutations also start delivery after the response. The scheduled worker drains
larger batches and retries failures while no browser is open. It sends one recipient
per message, with a shared seven-second send interval. Opt-outs, unwatching, and
lost project access are checked again before delivery. Failed mail uses exponential
backoff (up to an hour), and pending mail expires after seven days. A provider
timeout after accepting a message can cause a duplicate on retry; this is
at-least-once delivery, not an exactly-once provider contract.

Watch-start announcements go to project members and the site owner, including the
person starting the watch. Lane movement goes to watchers other than the actor.
Both email categories default on; browser notifications still require permission.
Watch-start popups suppress the actor's own action. No emails are sent by applying
the migration itself. Repeated watch/unwatch toggles are limited to one announcement
per actor, card, and recipient every five minutes.

## CLI sync protocol 3 rollout

1. Back up production and confirm the linked Supabase project before reviewing
   `bunx supabase db push --dry-run`. Apply the reviewed migrations, including
   `20260914000000_cli_sync_apply.sql` and
   `20260915000000_explicit_card_audience.sql`, to that project.
2. Deploy the matching application code. The migration adds transactional sync,
   retry receipts, source projections and revision tracking for tag/link edits.
   Protocol 3 adds explicit audience classification and optional epic assignments.
   The new migration preserves existing audience values and does not change access
   policies. New clients require protocol 3; older clients refuse the new server.
   Finish or archive pending journals before upgrading and keep their backups.
3. Use the repository CLI until a release containing this implementation is
   published. Sign in normally, run `status`/`sync --dry-run`, and reconcile any
   differences before `sync`. Old baselines can be refreshed with `baseline` when
   both sides agree, or explicitly upgraded with `sync --adopt-identities` after
   confirming the current card identities.
4. Smoke-test a controlled card change in each direction, an explicit conflict
   choice, and a clean second preview. Do not retire the legacy tracker clients
   until their generic Cardstock round-trip checks pass. Reproducing Designer's
   project-specific validator is not an acceptance requirement.

See `packages/cli/README.md` for resume/abort, stale-lock recovery, and retained
original files. Receipt rows must not be pruned while clients may still resume the
associated journals. No hosted migration or deployment is performed by CLI sync.
