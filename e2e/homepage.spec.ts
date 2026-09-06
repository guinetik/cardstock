import { expect, test } from "@playwright/test";
import { OWNER, OWNER_PASSWORD, signIn } from "./support/sign-in";

/**
 * The landing page: the one route a person can reach without a session. It
 * carries the pitch, the honest list and the sign-in form, so the two things
 * worth testing are that a stranger can read it and that a member is not made
 * to read it.
 */

test.describe("signed out", () => {
  test("a stranger reads the whole page without signing in", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /Keep writing markdown/i }),
    ).toBeVisible();
    // The honest list is the part most likely to be quietly dropped.
    await expect(
      page.getByRole("heading", { name: "Not built yet" }),
    ).toBeVisible();
    await expect(page.getByTestId("invite-form-full")).toBeVisible();
    // The app's topbar belongs to the app, not to the pitch.
    await expect(page.locator("header.paper-topbar")).toHaveCount(0);
  });

  test("the rail signs a member in and takes them to their projects", async ({
    page,
  }) => {
    await page.goto("/");
    // Three fields on this page take an email address, so the rail's form is
    // addressed by name rather than by label.
    const form = page.getByTestId("sign-in-form");
    await form.getByLabel("Email").fill(OWNER);
    await form.getByLabel("Password").fill(OWNER_PASSWORD);
    await form.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/projects$/);
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
  });

  test("a gated route still sends a stranger to the login page", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });
});

test("a signed-in member never sees the pitch", async ({ page }) => {
  await signIn(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/projects$/);
});
