/**
 * Seed the member allowlist and attach everyone to the given project.
 *
 * OWNER_EMAIL is promoted to `role = 'owner'` — that is how a fresh deploy
 * bootstraps its owner from infrastructure config. From then on the row is the
 * source of truth: further members can be added by SQL, or by a UI later.
 * MEMBER_EMAILS are seeded as ordinary admins.
 *
 * This only fills the allowlist. Signing in needs a password too, which is what
 * `bun run db:dev-password` gives a local account.
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
