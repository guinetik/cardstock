import { expect, test } from "@playwright/test";
import {
  admin,
  authUserExists,
  dropMember,
  signInAs,
  submitSignIn,
} from "./support/sign-in";

/**
 * Onboarding and sign-in with a password, against local Supabase.
 *
 * Each run works on a throwaway invitee that it creates and removes itself,
 * so it never disturbs the seeded owner the rest of the suite signs in as.
 */

const INVITEE = "e2e-onboard@example.test";
const STRANGER = "e2e-stranger@example.test";
const PASSWORD = "correct horse battery";
const OTHER_PASSWORD = "a different password";

test.beforeEach(async () => {
  await dropMember(INVITEE);
  await dropMember(STRANGER);
  // The invite: a row on the allowlist, and nothing else.
  await admin
    .from("members")
    .upsert(
      { email: INVITEE, display_name: "E2E onboard" },
      { onConflict: "email" },
    );
});

test.afterAll(async () => {
  await dropMember(INVITEE);
  await dropMember(STRANGER);
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

test("an invited person sets a password and is signed in", async ({ page }) => {
  await setPassword(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("that password then signs them in on a later visit", async ({ page }) => {
  await setPassword(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);

  await page.context().clearCookies();
  await signInAs(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("the wrong password is refused", async ({ page }) => {
  await setPassword(page, INVITEE, PASSWORD);
  await page.waitForURL(/\/(p\/|$)/);

  await page.context().clearCookies();
  await submitSignIn(page, INVITEE, OTHER_PASSWORD);
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
  await signInAs(page, INVITEE, PASSWORD);
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
