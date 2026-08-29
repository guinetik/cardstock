import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

/**
 * Two people looking at the same board. One moves a card; the other sees it
 * land in the new lane without touching their page.
 */
test("a card moved in one browser shows up in the new lane in another", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  try {
    await signIn(a);
    await signIn(b);
    await a.goto(BOARD);
    await b.goto(BOARD);
    await expect(a.locator("[data-lane]").first()).toBeVisible();
    await expect(b.locator("[data-lane]").first()).toBeVisible();

    const card = a.locator('[data-lane="unsorted"] [data-id]').first();
    const id = await card.getAttribute("data-id");
    await expect(
      b.locator(`[data-lane="unsorted"] [data-id="${id}"]`),
    ).toBeVisible();

    const target = a.locator('[data-lane="later"]');
    const from = (await card.boundingBox())!;
    const to = (await target.boundingBox())!;
    await a.mouse.move(from.x + 60, from.y + 20);
    await a.mouse.down();
    await a.mouse.move(from.x + 70, from.y + 30, { steps: 4 });
    await a.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
    await expect(
      a.locator(`[data-lane="later"] [data-id="${id}"]`),
    ).toBeVisible();
    await a.mouse.up();

    // B never reloads. It should still see the card move.
    await expect(
      b.locator(`[data-lane="later"] [data-id="${id}"]`),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      b.locator(`[data-lane="unsorted"] [data-id="${id}"]`),
    ).toHaveCount(0);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
