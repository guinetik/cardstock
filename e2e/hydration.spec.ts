import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_MEMBER_EMAIL ?? "e2e@example.com";

test("board hydrates without React/Next hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await page.waitForURL(/\/(p\/|$)/);
  await page.goto(process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog");
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
});
