/**
 * Seed the member allowlist and attach everyone to the given project.
 *
 * OWNER_EMAIL is promoted to `role = 'owner'` — that is how a fresh deploy
 * bootstraps its owner from infrastructure config. From then on the row is the
 * source of truth: further members can be added by SQL, or by a UI later.
 * MEMBER_EMAILS are seeded as ordinary admins.
 *
 *   bun run db:seed-members --project <slug>
 */
import { arg, serviceClient } from "./db";

const projectSlug = arg("project");
const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
const emails = (process.env.MEMBER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const e2eEmail = process.env.E2E_MEMBER_EMAIL?.toLowerCase();
const isLocal =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("127.0.0.1") ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("localhost");

if (!ownerEmail && !emails.length)
  throw new Error("set OWNER_EMAIL (and optionally MEMBER_EMAILS)");
const db = serviceClient();
const { data: project } = await db
  .from("projects")
  .select("id")
  .eq("slug", projectSlug)
  .single();
if (!project)
  throw new Error(`project '${projectSlug}' not found — run db:reset first`);

// Owner first, so the allowlist is never briefly ownerless on a fresh database.
const roster = new Map<string, "owner" | "admin">();
if (ownerEmail) roster.set(ownerEmail, "owner");
for (const email of emails) if (!roster.has(email)) roster.set(email, "admin");
if (e2eEmail && isLocal && !roster.has(e2eEmail)) roster.set(e2eEmail, "admin");

for (const [email, role] of roster) {
  const { data: m, error } = await db
    .from("members")
    .upsert(
      { email, display_name: email.split("@")[0], role },
      { onConflict: "email" },
    )
    .select("id")
    .single();
  if (error || !m) throw new Error(`${email}: ${error?.message}`);
  await db
    .from("project_members")
    .upsert(
      { project_id: project.id, member_id: m.id },
      { onConflict: "project_id,member_id" },
    );
  console.log(`${role} ${email} → ${projectSlug}`);
}

// Playwright signs in through the dev button, so the test member needs an auth
// user but no password.
if (e2eEmail) {
  if (!isLocal)
    console.warn(
      "E2E member requested but Supabase URL is not local — skipping the auth user",
    );
  else {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === e2eEmail);
    if (!found)
      await db.auth.admin.createUser({
        email: e2eEmail,
        email_confirm: true,
      });
    console.log(`e2e auth user ${e2eEmail} ready (local only)`);
  }
}
