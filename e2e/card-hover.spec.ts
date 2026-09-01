import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

/**
 * The peek must open without the card ever getting shorter. If it does, a
 * pointer near the bottom edge falls off the card and the hover flickers.
 */
for (const [where, up] of [
  ["over the resting summary", 10],
  ["on the last pixel", 0.5],
] as const) {
  test(`hovering ${where} of a card does not flicker`, async ({ page }) => {
    await signIn(page);
    await page.goto(BOARD);
    const card = page.locator('[data-lane="now"] [data-id] article').first();
    await card.waitFor();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y - 40);
    await page.waitForTimeout(400);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - up);
    const result = await card.evaluate(async (el) => {
      let last = el.matches(":hover");
      let flips = 0;
      let minBottom = Number.POSITIVE_INFINITY;
      const start = el.getBoundingClientRect().bottom;
      const t0 = performance.now();
      while (performance.now() - t0 < 1200) {
        await new Promise((r) => requestAnimationFrame(r));
        const now = el.matches(":hover");
        if (now !== last) {
          flips++;
          last = now;
        }
        minBottom = Math.min(minBottom, el.getBoundingClientRect().bottom);
      }
      return { flips, dip: start - minBottom, hovered: last };
    });
    expect(result.flips).toBe(0);
    expect(result.hovered).toBe(true);
    // The rise moves the whole card up 2px; anything more is the peek dip.
    expect(result.dip).toBeLessThan(4);
  });
}

/**
 * An open card is mostly its form. It has to be a handle too, or the card
 * can only be picked up by its title.
 */
test("an open card can be picked up by its form, not only its title", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(BOARD);
  const card = page.locator('[data-lane="now"] [data-id] article').first();
  await card.hover();
  await expect(card.locator(".card-form")).toBeVisible();
  // Let the peek finish opening, or the boxes below are measured mid-motion
  // and the pointer lands on whatever has since moved into that spot.
  await expect
    .poll(async () => (await card.boundingBox())?.height, { timeout: 3000 })
    .toBeGreaterThan(200);
  await page.waitForTimeout(400);
  for (const sel of [".card-form .field-label", ".card-form .mark"]) {
    const b = (await card.locator(sel).first().boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 12, y + 12, { steps: 6 });
    await expect(page.locator(".paper-card--overlay"), sel).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(".paper-card--overlay")).toHaveCount(0);
  }
  // Text fields still select text instead of lifting the card. A cancelled
  // drag leaves the browser's :hover stale until the pointer moves (the drag
  // overlay was under it), so re-hover and wait for the peek to reopen, then
  // check the press really lands on the field.
  await page.mouse.move(5, 300);
  await card.hover();
  await expect
    .poll(async () => (await card.boundingBox())?.height, { timeout: 3000 })
    .toBeGreaterThan(200);
  await page.waitForTimeout(400);
  // The rough date and the blocker note are both text fields; either proves
  // the rule, so take the first.
  const field = card.locator(".card-form input[type=text]").first();
  const input = (await field.boundingBox())!;
  const ix = input.x + 20;
  const iy = input.y + input.height / 2;
  await page.mouse.move(ix, iy);
  await expect
    .poll(() =>
      page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.tagName,
        [ix, iy],
      ),
    )
    .toBe("INPUT");
  await page.mouse.down();
  await page.mouse.move(ix + 40, iy, { steps: 6 });
  await expect(page.locator(".paper-card--overlay")).toHaveCount(0);
  await page.mouse.up();
});
