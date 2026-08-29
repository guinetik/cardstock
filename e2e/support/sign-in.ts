import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Signing in for the e2e suite.
 *
 * There is no dev sign-in button any more: the suite uses the same email and
 * password form a real person does, so the only entry point in the app is also
 * the only entry point under test.
 */

/** The seeded owner. `bun run db:seed-members` puts them on the allowlist. */
export const OWNER = (process.env.OWNER_EMAIL ?? "").toLowerCase();
/** Their local password — set once, by `bun run db:dev-password`. */
export const OWNER_PASSWORD = process.env.E2E_PASSWORD ?? "admin123";

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/**
 * Fill the sign-in form and submit it, without assuming it works.
 *
 * Separate from `signInAs` so a test that expects a refusal does not wait for a
 * navigation that is never going to happen.
 */
export async function submitSignIn(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Sign in through the login form and wait for the app to take over. */
export async function signInAs(page: Page, email: string, password: string) {
  await submitSignIn(page, email, password);
  await page.waitForURL(/\/(p\/|$)/);
}

/** Sign in as the owner, who can see everything. */
export async function signIn(page: Page) {
  await signInAs(page, OWNER, OWNER_PASSWORD);
}

/**
 * Create a throwaway member with a password and return their address.
 *
 * Provisioned per test rather than seeded, so the local database does not carry
 * a permanent test account around, and so a test that needs a *non*-owner says
 * so itself instead of depending on how the seed happens to be shaped.
 */
export async function createMember(email: string, password: string) {
  await dropMember(email);
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`could not create ${email}: ${error.message}`);
  const { error: e2 } = await admin
    .from("members")
    .upsert(
      { email, display_name: "E2E user", role: "member" },
      { onConflict: "email" },
    );
  if (e2) throw new Error(`could not invite ${email}: ${e2.message}`);
  return email;
}

export async function projectId(slug: string) {
  const { data, error } = await admin
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error || !data)
    throw new Error(`project ${slug} not found: ${error?.message}`);
  return data.id as string;
}

/** Attach an allowlisted member to a project with a project role. */
export async function attachToProject(
  email: string,
  slug: string,
  role: "admin" | "member",
) {
  const { data: member, error } = await admin
    .from("members")
    .select("id")
    .eq("email", email)
    .single();
  if (error || !member)
    throw new Error(`member ${email} not found: ${error?.message}`);
  const id = await projectId(slug);
  const { error: e2 } = await admin
    .from("project_members")
    .upsert(
      { project_id: id, member_id: member.id, role },
      { onConflict: "project_id,member_id" },
    );
  if (e2) throw new Error(`could not attach ${email}: ${e2.message}`);
}

/** Remove a throwaway member and any auth user for them. */
export async function dropMember(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
  await admin.from("members").delete().eq("email", email);
}

/** True when an auth user exists for this address. */
export async function authUserExists(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.some((u) => u.email?.toLowerCase() === email) ?? false;
}
