import { expect, test } from "@playwright/test";

/**
 * The invite-only gate. `members` is the allowlist and nothing else grants
 * access, so both entry points are checked here: the dev sign-in button and
 * the magic-link request.
 */

const MEMBER = process.env.E2E_MEMBER_EMAIL ?? "e2e@example.com";
const STRANGER = "not-invited@example.test";

test("a stranger is refused at both entry points", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(STRANGER);

  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await expect(
    page.getByText(/invite-only while in beta/i).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // No mail is sent and no auth user is created for an uninvited address.
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(
    page.getByText(/invite-only while in beta/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/check your inbox/i)).toHaveCount(0);
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
  await expect(
    page.getByText(/invite-only while in beta/i).first(),
  ).toBeVisible();
  // The password form is gone for good.
  await expect(page.getByLabel("Password")).toHaveCount(0);
});
