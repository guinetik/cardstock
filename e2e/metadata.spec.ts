import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";
const BRAND = "cardstock: project zen, on paper";

test("titles carry project and board context through nested pages", async ({
  page,
}) => {
  await signIn(page);

  await page.goto("/p/demo");
  const projectName = (
    await page.getByRole("heading", { level: 1 }).innerText()
  ).trim();
  await expect(page).toHaveTitle(`${projectName} - ${BRAND}`);

  await page.goto(BOARD);
  const boardName = (
    await page.getByRole("heading", { level: 1 }).innerText()
  ).trim();
  const boardTitle = `${boardName} | ${projectName} - ${BRAND}`;
  await expect(page).toHaveTitle(boardTitle);

  const cardId = await page
    .locator("[data-id]")
    .first()
    .getAttribute("data-id");
  if (!cardId) throw new Error("The seeded board has no card id");
  await page.goto(`${BOARD}/c/${cardId}`);
  await expect(page).toHaveTitle(`Card #${cardId} | ${boardTitle}`);

  await page.goto(`${BOARD}/timeline`);
  await expect(page).toHaveTitle(`Timeline | ${boardTitle}`);

  await page.goto(`${BOARD}/cockpit`);
  await expect(page).toHaveTitle(`Cockpit | ${boardTitle}`);

  await page.goto(`${BOARD}/manage`);
  await expect(page).toHaveTitle(`Manage | ${boardTitle}`);
});
