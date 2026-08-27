import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Onboarding and sign-in with a password, against local Supabase.
 *
 * The rest of the suite signs in with the dev button, which skips passwords
 * entirely — so without this file the real entry point has no coverage.
 *
 * Each run works on a throwaway invitee that it creates and removes itself,
 * so it never disturbs the seeded member the other specs sign in as.
 */

const INVITEE = "e2e-onboard@example.test";
const STRANGER = "e2e-stranger@example.test";
const PASSWORD = "correct horse battery";
const OTHER_PASSWORD = "a different password";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Remove the auth user for an address, if one was created. */
async function dropAuthUser(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

async function authUserExists(email: string) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data?.users.some((u) => u.email?.toLowerCase() === email) ?? false;
}

test.beforeEach(async () => {
  await dropAuthUser(INVITEE);
  await dropAuthUser(STRANGER);
  await admin.from("members").delete().eq("email", STRANGER);
  // The invite: a row on the allowlist, and nothing else.
  await admin
    .from("members")
    .upsert(
      { email: INVITEE, display_name: "E2E onboard" },
      { onConflict: "email" },
    );
});

test.afterAll(async () => {
  await dropAuthUser(INVITEE);
  await dropAuthUser(STRANGER);
  await admin.from("members").delete().eq("email", INVITEE);
});

/** Fill the set-password form and submit it. */
async function setPassword(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByTestId("toggle-onboarding").click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Set password and sign in" }).click();
}

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("an invited person sets a password and is signed in", async ({ page }) => {
  await setPassword(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("that password then signs them in on a later visit", async ({ page }) => {
  await setPassword(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);

  await page.context().clearCookies();
  await signIn(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("the wrong password is refused", async ({ page }) => {
  await setPassword(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);

  await page.context().clearCookies();
  await signIn(page, INVITEE, OTHER_PASSWORD);
  await expect(page.getByText(/don't match/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a second attempt cannot overwrite an existing password", async ({
  page,
}) => {
  await setPassword(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);
  await page.context().clearCookies();

  // Someone who knows the address tries to claim the account.
  await setPassword(page, INVITEE, OTHER_PASSWORD);
  await expect(page.getByText(/already been set up/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // The original password still works, so nothing was taken over.
  await page.context().clearCookies();
  await signIn(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("someone not on the allowlist cannot onboard", async ({ page }) => {
  await setPassword(page, STRANGER, PASSWORD);
  await expect(page.getByText(/isn't on the list/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  // No auth user is created for a stranger, so the form cannot be used to
  // populate auth.users.
  expect(await authUserExists(STRANGER)).toBe(false);
});

test("a mismatched confirmation is rejected before anything is created", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByTestId("toggle-onboarding").click();
  await page.getByLabel("Email").fill(INVITEE);
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(OTHER_PASSWORD);
  await page.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(page.getByText(/do not match/i)).toBeVisible();
  expect(await authUserExists(INVITEE)).toBe(false);
});
