/**
 * Set a local sign-in password for an allowlisted member.
 *
 * There is no dev sign-in button any more, so a fresh local database needs one
 * account with a password before anyone — or the e2e suite — can get in.
 * Refuses to run against anything but a Supabase on this machine, so it cannot
 * set a password on a deployed instance by accident.
 *
 *   bun run db:dev-password                       # OWNER_EMAIL, password admin123
 *   bun run db:dev-password --email a@b.c --password s3cret
 */
import { arg, serviceClient } from "./db";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let host = "";
try {
  host = new URL(url).hostname.toLowerCase();
} catch {
  throw new Error(`NEXT_PUBLIC_SUPABASE_URL is not a URL: ${url}`);
}
if (!LOCAL_HOSTS.has(host))
  throw new Error(
    `refusing to set a password on ${host} — this is for local development only`,
  );

const email = (arg("email", "") || process.env.OWNER_EMAIL || "")
  .trim()
  .toLowerCase();
const password = arg("password", "") || process.env.E2E_PASSWORD || "admin123";
if (!email) throw new Error("set OWNER_EMAIL or pass --email");

const db = serviceClient();
const { data: member } = await db
  .from("members")
  .select("email")
  .eq("email", email)
  .maybeSingle();
if (!member)
  throw new Error(
    `${email} is not on the allowlist — run db:seed-members first`,
  );

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
if (existing) {
  const { error } = await db.auth.admin.updateUserById(existing.id, {
    password,
  });
  if (error) throw error;
  console.log(`password updated for ${email}`);
} else {
  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`created ${email} with a password`);
}
