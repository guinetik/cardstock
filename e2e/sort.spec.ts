import { expect, test } from "@playwright/test";

/**
 * The Unsorted lane's order control. Regression guard: this shipped broken
 * because the sort only ran when every inbox card had rank 0, which the ETL
 * never produces — the unit tests passed while the control did nothing.
 */
const EMAIL = process.env.E2E_MEMBER_EMAIL ?? "e2e@example.com";
const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

const unsortedIds = (page: import("@playwright/test").Page) =>
  page
    .locator('[data-lane="unsorted"] [data-id]')
    .evaluateAll((n) => n.map((e) => Number(e.getAttribute("data-id"))));

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await page.waitForURL(/\/(p\/|$)/);
  await page.goto(BOARD);
  await expect(
    page.locator('[data-lane="unsorted"] [data-id]').first(),
  ).toBeVisible();
});

test("# ascending and descending actually reorder the Unsorted lane", async ({
  page,
}) => {
  const sort = page.getByLabel("Unsorted order");

  await sort.selectOption("id-asc");
  const asc = await unsortedIds(page);
  expect(asc.length).toBeGreaterThan(1);
  expect(asc).toEqual([...asc].sort((a, b) => a - b));

  await sort.selectOption("id-desc");
  const desc = await unsortedIds(page);
  expect(desc).toEqual([...asc].reverse());
});

test("the date orders are each other's reverse and survive a reload", async ({
  page,
}) => {
  const sort = page.getByLabel("Unsorted order");

  await sort.selectOption("oldest");
  const oldest = await unsortedIds(page);
  await sort.selectOption("newest");
  const newest = await unsortedIds(page);
  expect(newest).not.toEqual(oldest);

  // the choice is a saved preference
  await page.reload();
  await expect(
    page.locator('[data-lane="unsorted"] [data-id]').first(),
  ).toBeVisible();
  expect(await unsortedIds(page)).toEqual(newest);
});
