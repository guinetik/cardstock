import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

test("board hydrates without React/Next hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await signIn(page);
  await page.goto(process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog");
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
});
