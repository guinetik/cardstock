import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto(BOARD);
  await expect(page.locator("[data-lane]").first()).toBeVisible();
});

test("pin keeps the card open after the mouse leaves; unpin closes it", async ({
  page,
}) => {
  const card = page.locator('[data-lane="now"] [data-id]').first();
  // The resting summary hides whenever the peek is open, so it is the
  // reliable signal (the peek itself is clipped, not sized to zero).
  const rest = card.locator(".card-rest");
  const pin = card.getByRole("button", { name: "Pin card" });

  await expect(rest).toBeVisible();
  await card.hover();
  await expect(rest).not.toBeVisible();
  await pin.click();

  // Park the pointer somewhere neutral: the board title.
  await page.locator("h1").hover();
  await expect(rest).not.toBeVisible();
  await expect(card.locator("article")).toHaveAttribute("data-pinned", "true");

  await card.getByRole("button", { name: "Unpin card" }).click();
  await page.locator("h1").hover();
  await expect(rest).toBeVisible();
});

test("maximize opens the issue page over the board; Esc closes it", async ({
  page,
}) => {
  const card = page.locator('[data-lane="now"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await card.hover();
  await card.getByRole("link", { name: "Open in place" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 1 })).toContainText(
    `#${id}`,
  );
  await expect(page).toHaveURL(new RegExp(`/c/${id}$`));
  // The board is still there underneath.
  await expect(page.locator("[data-lane]").first()).toBeAttached();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${BOARD}$`));
});

test("a direct visit to the issue URL is the full page, not a dialog", async ({
  page,
}) => {
  const card = page.locator('[data-lane="now"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await page.goto(`${BOARD}/c/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`#${id}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-lane]")).toHaveCount(0);
});
