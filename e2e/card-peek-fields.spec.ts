import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

/** Open the first card in the Now lane and wait for its peek to settle. */
async function openPeek(page: import("@playwright/test").Page) {
  await page.goto(BOARD);
  const card = page.locator('[data-lane="now"] [data-id] article').first();
  await card.hover();
  await expect(card.locator(".card-form")).toBeVisible();
  await expect
    .poll(async () => (await card.boundingBox())?.height, { timeout: 3000 })
    .toBeGreaterThan(200);
  return card;
}

/**
 * The tint moved off the form and into the rail, where pin and maximize are:
 * the palette costs a row it does not earn. Picking a colour there must still
 * paint the card.
 */
test("the rail's colour menu tints the card", async ({ page }) => {
  await signIn(page);
  const card = await openPeek(page);

  await card
    .getByLabel(/^Color for card #/)
    .first()
    .click();
  const palette = page.getByRole("group", { name: /^Color for card #/ });
  await expect(palette).toBeVisible();
  await palette.getByRole("button", { name: "Green" }).click();

  await expect(card).toHaveClass(/card-color--green/);

  // The palette stays open after a pick, so the next choice is one click away.
  // Back to the neutral stock: the menu must not be a one-way door.
  await palette.getByRole("button", { name: "No color" }).click();
  await expect(card).not.toHaveClass(/card-color--green/);
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
});

/**
 * The row the palette vacated now carries the blocker note, and the dates row
 * carries both days the timeline draws a bar between.
 */
test("the peek edits planned start and the blocker note", async ({ page }) => {
  await signIn(page);
  const card = await openPeek(page);

  await card.getByLabel("Planned start").fill("2026-09-02");
  await expect(card.getByLabel("Planned start")).toHaveValue("2026-09-02");

  const needs = card.getByLabel("Waiting on");
  await needs.fill("legal review");
  await expect(needs).toHaveValue("legal review");

  // Reload rather than trust the optimistic paint: the point is that it saved.
  await page.reload();
  const again = await openPeek(page);
  await expect(again.getByLabel("Planned start")).toHaveValue("2026-09-02");
  await expect(again.getByLabel("Waiting on")).toHaveValue("legal review");

  await again.getByLabel("Waiting on").fill("");
  await expect(again.getByLabel("Waiting on")).toHaveValue("");
});
