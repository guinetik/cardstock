import { expect, test } from "@playwright/test";

/**
 * The invite-only gate. `members` is the allowlist and nothing else grants
 * access, so both entry points are checked here: the dev sign-in button and
 * the password form.
 */

const MEMBER = process.env.E2E_MEMBER_EMAIL ?? "e2e@example.com";
const STRANGER = "not-invited@example.test";

test("a stranger is refused at both entry points", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(STRANGER);

  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await expect(page.getByText(/isn't on the list/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // No auth user is created for an uninvited address.
  await page.getByTestId("toggle-onboarding").click();
  await page.getByLabel("Email").fill(STRANGER);
  await page.getByLabel("New password").fill("correct horse battery");
  await page.getByLabel("Confirm password").fill("correct horse battery");
  await page.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(page.getByText(/isn't on the list/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("an allowlisted member signs in with no password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(MEMBER);
  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await page.waitForURL(/\/(p\/|$)/);
  await expect(page).not.toHaveURL(/\/login/);
});

test("the login screen says it is an invite-only beta", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("beta", { exact: true })).toBeVisible();
  await expect(page.getByText(/invite-only while in beta/i)).toBeVisible();
  // Password sign-in is the default; onboarding is one click away.
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByTestId("toggle-onboarding")).toBeVisible();
});
