import { expect, test } from "@playwright/test";
import { authUserExists, OWNER, signIn, submitSignIn } from "./support/sign-in";

/**
 * The invite-only gate. `members` is the allowlist and nothing else grants
 * access, so both ways in are checked here: signing in and onboarding.
 */

const STRANGER = "not-invited@example.test";
const PASSWORD = "correct horse battery";

test("a stranger cannot sign in and cannot onboard", async ({ page }) => {
  await submitSignIn(page, STRANGER, PASSWORD);
  await expect(page.getByText(/don't match/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId("toggle-onboarding").click();
  await page.getByLabel("Email").fill(STRANGER);
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(page.getByText(/isn't on the list/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  // Neither path may create an auth user for an uninvited address.
  expect(await authUserExists(STRANGER)).toBe(false);
});

test("an allowlisted member signs in with their password", async ({ page }) => {
  await signIn(page);
  await expect(page).not.toHaveURL(/\/login/);
});

test("the login screen says it is an invite-only beta", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("beta", { exact: true })).toBeVisible();
  await expect(page.getByText(/invite-only while in beta/i)).toBeVisible();
  // Password sign-in is the default; onboarding is one click away.
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByTestId("toggle-onboarding")).toBeVisible();
  // The dev sign-in button is gone: this form is the only way in.
  await expect(page.getByRole("button", { name: /local dev/i })).toHaveCount(0);
});

test("the owner is the seeded member the suite signs in as", async ({
  page,
}) => {
  await signIn(page);
  await expect(async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByText(OWNER)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
});
