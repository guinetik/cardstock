/**
 * Pull the hosted database into the local stack, so a wiped local Supabase is
 * one command away from looking like production again.
 *
 *   bun run db:pull-prod                    # dump prod → backups/, reset local, restore
 *   bun run db:pull-prod --dump-only        # just write the backup files
 *   bun run db:pull-prod --restore <stamp>  # replay backups/prod-<stamp>-*.sql, no prod access
 *
 * Needs PROD_DB_URL in .env.local: the hosted Postgres connection string from
 * Project Settings → Database (password percent-encoded). It is read here and
 * nowhere else. The local side is SUPABASE_DB_URL, and this refuses to restore
 * into anything that is not on this machine, so the direction can never flip.
 *
 * What comes across: every row in `public`, and the `auth` rows that make a
 * sign-in work (users, identities). Sessions, tokens and audit rows stay
 * behind. Auth is applied separately and is allowed to fail — a hosted auth
 * schema newer than the local one is not worth a broken restore; run
 * `bun run db:dev-password` in that case and carry on.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { arg } from "./db";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const BACKUPS = join(process.cwd(), "backups");

/** Everything in `auth` that is state rather than identity. */
const AUTH_EXCLUDED = [
  "auth.audit_log_entries",
  "auth.flow_state",
  "auth.mfa_amr_claims",
  "auth.mfa_challenges",
  "auth.mfa_factors",
  "auth.one_time_tokens",
  "auth.refresh_tokens",
  "auth.saml_providers",
  "auth.saml_relay_states",
  "auth.sessions",
  "auth.sso_domains",
  "auth.sso_providers",
  "auth.schema_migrations",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error(`not a URL: ${url}`);
  }
}

function requireLocal(name: string, url: string | undefined): string {
  if (!url) throw new Error(`${name} is required (see .env.example)`);
  const host = hostOf(url);
  if (!LOCAL_HOSTS.has(host))
    throw new Error(
      `refusing: ${name} points at ${host}, and this only ever writes to a Supabase on this machine`,
    );
  return url;
}

/** Run a CLI command in the foreground; throw on a non-zero exit. */
function run(cmd: string, args: string[]) {
  const exe = process.platform === "win32" ? `${cmd}.exe` : cmd;
  const r = spawnSync(exe, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0)
    throw new Error(`${cmd} ${args.join(" ")} exited with ${r.status}`);
}

function dump(dbUrl: string, file: string, schema: string, exclude: string[]) {
  const args = [
    "x",
    "supabase",
    "db",
    "dump",
    "--db-url",
    dbUrl,
    "--data-only",
    "--schema",
    schema,
    "--file",
    file,
  ];
  for (const table of exclude) args.push("--exclude", table);
  run("bun", args);
}

/**
 * Replay a data-only dump in one transaction with triggers and FK checks
 * relaxed, so row order in the file does not matter.
 */
async function restore(localUrl: string, file: string) {
  const text = readFileSync(file, "utf8");
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("set session_replication_role = replica");
      await tx.unsafe(text);
      await tx.unsafe("set session_replication_role = default");
    });
  } finally {
    await sql.end();
  }
}

async function report(localUrl: string) {
  const sql = postgres(localUrl, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql<
      { members: number; users: number; projects: number; cards: number }[]
    >`
      select
        (select count(*) from public.members)::int as members,
        (select count(*) from auth.users)::int as users,
        (select count(*) from public.projects)::int as projects,
        (select count(*) from public.cards)::int as cards
    `;
    console.log(
      `local now has ${row.projects} projects, ${row.cards} cards, ${row.members} members, ${row.users} auth users`,
    );
    if (row.members > 0 && row.users === 0)
      console.log(
        "no auth users came across — run `bun run db:dev-password` to sign in",
      );
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------- main

const dumpOnly = process.argv.includes("--dump-only");
const restoreStamp = arg("restore", "");

mkdirSync(BACKUPS, { recursive: true });
let stamp = restoreStamp;

if (!restoreStamp) {
  const prod = process.env.PROD_DB_URL;
  if (!prod) throw new Error("PROD_DB_URL is required (see .env.example)");
  if (LOCAL_HOSTS.has(hostOf(prod)))
    throw new Error("PROD_DB_URL points at this machine; nothing to pull");

  stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  console.log(`dumping ${hostOf(prod)} → backups/prod-${stamp}-*.sql`);
  dump(prod, join(BACKUPS, `prod-${stamp}-public.sql`), "public", []);
  dump(prod, join(BACKUPS, `prod-${stamp}-auth.sql`), "auth", AUTH_EXCLUDED);
  if (dumpOnly) {
    console.log("dump only — local database untouched");
    process.exit(0);
  }
}

const publicFile = join(BACKUPS, `prod-${stamp}-public.sql`);
const authFile = join(BACKUPS, `prod-${stamp}-auth.sql`);
if (!existsSync(publicFile)) throw new Error(`no such backup: ${publicFile}`);

const local = requireLocal("SUPABASE_DB_URL", process.env.SUPABASE_DB_URL);
requireLocal("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

console.log("resetting the local database (migrations, no seed)…");
run("bun", ["x", "supabase", "db", "reset", "--local", "--no-seed", "--yes"]);

console.log(`restoring ${publicFile}`);
await restore(local, publicFile);

if (existsSync(authFile)) {
  console.log(`restoring ${authFile}`);
  try {
    await restore(local, authFile);
  } catch (e) {
    console.warn(
      `auth rows did not apply (${(e as Error).message.split("\n")[0]}); public data is in — run \`bun run db:dev-password\` to sign in`,
    );
  }
}

await report(local);
