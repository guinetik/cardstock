import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

/**
 * The blocker note is the one thing that can hold a card blocked without a
 * status or a lane saying so. Before it was editable, an imported value like
 * "needs hap" was stuck on the card forever. This walks the round trip: write
 * a note, see the chip, clear it, see the chip go.
 */
test("a blocker note can be written and cleared on the card sheet", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo/b/backlog/c/1");

  const box = page.getByLabel("Waiting on");
  const chip = page.getByText(/^needs /);

  const typed = `legal review ${Date.now()}`;
  await box.fill(typed);
  await box.blur();
  await expect(chip).toHaveText(`needs ${typed}`);

  // A note of nothing but spaces is no blocker: it must not survive the save.
  await box.fill("   ");
  await box.blur();
  await expect(chip).toHaveCount(0);
  await expect(box).toHaveValue("");
});
