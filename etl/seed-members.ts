/**
 * Seed the member allowlist and attach everyone to the given project.
 *
 * OWNER_EMAIL is promoted to `members.role = 'owner'` — that is how a fresh
 * deploy bootstraps its owner from infrastructure config. From then on the
 * row is the source of truth; there is exactly one owner.
 * MEMBER_EMAILS are seeded as project admins (site role `member`).
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
const projectId = project.id;

async function attach(
  email: string,
  siteRole: "owner" | "member",
  projectRole: "admin" | "member",
) {
  const { data: m, error } = await db
    .from("members")
    .upsert({ email, role: siteRole }, { onConflict: "email" })
    .select("id")
    .single();
  if (error || !m) throw new Error(`${email}: ${error?.message}`);
  const { error: membershipError } = await db
    .from("project_members")
    .upsert(
      { project_id: projectId, member_id: m.id, role: projectRole },
      { onConflict: "project_id,member_id" },
    );
  if (membershipError) throw new Error(`${email}: ${membershipError.message}`);
  console.log(`${siteRole}/${projectRole} ${email} → ${projectSlug}`);
}

// Owner first, so the allowlist is never briefly ownerless on a fresh database.
if (ownerEmail) await attach(ownerEmail, "owner", "admin");
for (const email of emails) {
  if (email === ownerEmail) continue;
  await attach(email, "member", "admin");
}
