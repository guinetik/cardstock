import { expect, test } from "@playwright/test";
import { resetDemoBoard } from "./support/reset";
import {
  attachToProject,
  createMember,
  dropMember,
  signIn,
} from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";
const TEAMMATE = "e2e-assignee@example.test";

// `createMember` sets `display_name` to "E2E user", so that is how
// `personLabel` writes them everywhere a person is shown.
const TEAMMATE_LABEL = "E2E user";

test.beforeAll(async () => {
  resetDemoBoard();
  await createMember(TEAMMATE, "admin123");
  await attachToProject(TEAMMATE, "demo", "member");
});

test.afterAll(async () => {
  await dropMember(TEAMMATE);
});

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("a card is handed to somebody and the choice sticks", async ({ page }) => {
  await page.goto(BOARD);
  const card = page.locator('[data-lane="now"] [data-id]').first();
  const id = await card.getAttribute("data-id");

  await page.goto(`${BOARD}/c/${id}`);
  const select = page.getByLabel("Assignee");
  await select.selectOption({ label: TEAMMATE_LABEL });
  await expect(page.locator("output")).toHaveText("Saved");
  const value = await select.inputValue();

  await page.reload();
  await expect(page.getByLabel("Assignee")).toHaveValue(value);
});

test("the history records who it went to", async ({ page }) => {
  await page.goto(BOARD);
  const card = page.locator('[data-lane="now"] [data-id]').first();
  const id = await card.getAttribute("data-id");

  await page.goto(`${BOARD}/c/${id}`);
  await page.getByLabel("Assignee").selectOption({ label: TEAMMATE_LABEL });
  await expect(page.locator("output")).toHaveText("Saved");

  await page.reload();
  const history = page.locator("section", {
    has: page.getByRole("heading", { name: /^History$/i }),
  });
  await expect(history.getByText(/assigned this to/i).first()).toBeVisible();
});

test("filtering by a person narrows the board", async ({ page }) => {
  await page.goto(BOARD);
  const card = page.locator('[data-lane="now"] [data-id]').first();
  const id = await card.getAttribute("data-id");

  await page.goto(`${BOARD}/c/${id}`);
  await page.getByLabel("Assignee").selectOption({ label: TEAMMATE_LABEL });
  await expect(page.locator("output")).toHaveText("Saved");

  await page.goto(BOARD);
  const total = await page.locator("article:visible").count();
  expect(total).toBeGreaterThan(1);

  const assignee = page
    .locator("#filters")
    .getByRole("group", { name: "Assignee" });
  await assignee.locator("summary").click();
  await assignee
    .getByRole("button", { name: TEAMMATE_LABEL, exact: true })
    .click();

  await expect(page.locator("article:visible")).toHaveCount(1);
  await expect(page.locator(`[data-id="${id}"] article`)).toBeVisible();
});
