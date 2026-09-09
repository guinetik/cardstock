import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const BOARD = "/p/demo/b/backlog";

test("a title edited on the card page persists in the heading and board", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${BOARD}/c/1`);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const renamed = `Corrected card title ${Date.now()}`;

  await title.fill(`  ${renamed}  `);
  await title.blur();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `#1 ${renamed}`,
  );
  await expect(title).toHaveValue(renamed);
  await expect(page.getByText(/renamed it$/).first()).toBeVisible();

  await page.reload();
  await expect(title).toHaveValue(renamed);
  await page.getByRole("button", { name: "Back to board" }).click();
  await expect(page.locator('[data-id="1"]')).toContainText(renamed);
});

test("a title can be saved with Enter in the board dialog", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(BOARD);
  await page.locator('[data-id="1"]').getByRole("link").first().click();
  const dialog = page.getByRole("dialog");
  const title = dialog.getByRole("textbox", { name: "Title", exact: true });
  const renamed = `Dialog title correction ${Date.now()}`;
  await title.fill(renamed);
  await title.press("Enter");
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText(
    `#1 ${renamed}`,
  );

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-id="1"]')).toContainText(renamed);
  await page.reload();
  await expect(page.locator('[data-id="1"]')).toContainText(renamed);
});

test("invalid titles are rejected by the server without replacing the saved title", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${BOARD}/c/1`);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const original = await title.inputValue();

  // Bypass the input limit to exercise validation at the Server Action boundary.
  await title.evaluate((input) => input.removeAttribute("maxlength"));
  for (const invalid of ["", "   ", "x".repeat(241)]) {
    await title.fill(invalid);
    await title.blur();
    await expect(page.locator("#card-title-error")).toHaveText(
      "Title must be between 1 and 240 characters.",
    );
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      `#1 ${original}`,
    );
  }

  await page.reload();
  await expect(title).toHaveValue(original);
  const longest = "x".repeat(240);
  await title.fill(longest);
  await title.blur();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `#1 ${longest}`,
  );
  await expect(page.locator("#card-title-error")).toHaveCount(0);
  await title.fill(original);
  await title.blur();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `#1 ${original}`,
  );
});
