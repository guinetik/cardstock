/**
 * Seed the member allowlist from MEMBER_EMAILS and attach everyone to the given project.
 * Locally, also creates a password-enabled auth user for Playwright (E2E_MEMBER_EMAIL/PASSWORD).
 *
 *   bun run db:seed-members --project <slug>
 */
import { arg, serviceClient } from "./db";

const projectSlug = arg("project");
const emails = (process.env.MEMBER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const e2eEmail = process.env.E2E_MEMBER_EMAIL?.toLowerCase();
const e2ePassword = process.env.E2E_MEMBER_PASSWORD;
const isLocal =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("127.0.0.1") ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("localhost");

if (!emails.length) throw new Error("MEMBER_EMAILS is empty");
const db = serviceClient();
const { data: project } = await db
  .from("projects")
  .select("id")
  .eq("slug", projectSlug)
  .single();
if (!project)
  throw new Error(`project '${projectSlug}' not found — run db:reset first`);

const all = [...emails];
if (e2eEmail && e2ePassword && isLocal) all.push(e2eEmail);

for (const email of all) {
  const { data: m, error } = await db
    .from("members")
    .upsert(
      { email, display_name: email.split("@")[0] },
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
  console.log(`member ${email} → ${projectSlug}`);
}

if (e2eEmail && e2ePassword) {
  if (!isLocal)
    console.warn(
      "E2E member requested but Supabase URL is not local — skipping the password user",
    );
  else {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === e2eEmail);
    if (found)
      await db.auth.admin.updateUserById(found.id, {
        password: e2ePassword,
        email_confirm: true,
      });
    else
      await db.auth.admin.createUser({
        email: e2eEmail,
        password: e2ePassword,
        email_confirm: true,
      });
    console.log(`e2e auth user ${e2eEmail} ready (local only)`);
  }
}
