import { expect, test } from "@playwright/test";

const MEMBER = process.env.E2E_MEMBER_EMAIL ?? "e2e@example.com";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(MEMBER);
  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await page.waitForURL(/\/(p\/|$)/);
}

test("the account menu lives in the topbar and signs out", async ({ page }) => {
  await signIn(page);
  await page.goto("/p/demo/b/backlog");
  // Sign out is reachable from the board *and* the projects page now.
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText(MEMBER)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
});

test("the login screen has no account menu", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(
    0,
  );
});

test("the owner can open the import-project explainer", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.OWNER_EMAIL ?? "");
  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await page.waitForURL(/\/(p\/|$)/);
  await page.goto("/");
  await page.getByRole("button", { name: "Import project" }).click();
  await expect(
    page.getByRole("heading", { name: "Import a project" }),
  ).toBeVisible();
  await expect(page.getByText(/db:apply --file/)).toBeVisible();
  await expect(
    page.getByText(/drop a zip of the markdown repo/i),
  ).toBeVisible();
});

test("a non-owner does not see the import button", async ({ page }) => {
  await signIn(page); // e2e member is an admin, not the owner
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Import project" }),
  ).toHaveCount(0);
});
