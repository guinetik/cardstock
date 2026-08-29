import { expect, test } from "@playwright/test";
import {
  createMember,
  dropMember,
  OWNER,
  signIn,
  signInAs,
} from "./support/sign-in";

/** A throwaway non-owner, so this file does not depend on the seed's shape. */
const NON_OWNER = "e2e-shell-admin@example.test";
const NON_OWNER_PASSWORD = "correct horse battery";

test("the account menu lives in the topbar and signs out", async ({ page }) => {
  await signIn(page);
  await page.goto("/p/demo/b/backlog");
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  // Sign out is reachable from the board *and* the projects page now.
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  // The trigger is server-rendered, so it is clickable a beat before React
  // hydrates it and that first click is dropped. Retry the open, the way a
  // person would, rather than racing hydration.
  await expect(async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByText(OWNER)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
});

test("the login screen has no account menu", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(
    0,
  );
});

test("the owner can open the import-project dialog", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Import project" }).click();
  await expect(
    page.getByRole("heading", { name: "Import a project" }),
  ).toBeVisible();
  await expect(page.getByText("First board", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Zip of sheets")).toBeVisible();
});

test("a non-owner does not see the import button", async ({ page }) => {
  await createMember(NON_OWNER, NON_OWNER_PASSWORD);
  try {
    await signInAs(page, NON_OWNER, NON_OWNER_PASSWORD);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Import project" }),
    ).toHaveCount(0);
  } finally {
    await dropMember(NON_OWNER);
  }
});
