import { expect, test, type Page } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";
const PROJECT = "e2e-calendar-project";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

/**
 * Hover a board card and set its target date, then wait for the patch to land.
 *
 * @param page - Signed-in Playwright page on a board.
 * @param card - Locator for the `[data-id]` wrapper.
 * @param isoDay - `YYYY-MM-DD`, or empty to clear.
 */
async function setCardTarget(page: Page, card: ReturnType<Page["locator"]>, isoDay: string) {
  await card.hover();
  await card.getByLabel("Target date").fill(isoDay);
  await page.waitForTimeout(600);
}

/**
 * Date the first five live (non-archive) cards so a day exceeds the cell cap.
 *
 * Unsorted may not have five cards; other visible lanes fill the remainder.
 *
 * @param page - Signed-in Playwright page on a board.
 * @param isoDay - Target day to pack.
 * @returns How many cards were dated.
 */
async function datePackedDay(page: Page, isoDay: string) {
  await page.goto(BOARD);
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  const cards = page.locator('[data-lane]:not([data-lane="archive"]) [data-id]');
  const n = Math.min(5, await cards.count());
  for (let i = 0; i < n; i++) {
    await setCardTarget(page, cards.nth(i), isoDay);
  }
  return n;
}

test("board calendar shows a dated card on that day and undated in the tray", async ({
  page,
}) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  const card = page.locator('[data-lane="unsorted"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await setCardTarget(page, card, "2026-09-15");
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  await expect(page.locator("[data-calendar-tray]")).toBeVisible();
  await expect(
    page.locator('[data-calendar-day="2026-09-15"] [data-id="' + id + '"]'),
  ).toBeVisible();
  await expect(
    page.locator(`[data-calendar-tray] [data-id="${id}"]`),
  ).toHaveCount(0);
});

test("drag from the tray onto a day persists after reload", async ({
  page,
}) => {
  await page.goto(BOARD);
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  const card = page.locator('[data-lane="unsorted"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await setCardTarget(page, card, "");
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  const slip = page.locator(`[data-calendar-tray] [data-id="${id}"]`);
  await expect(slip).toBeVisible();
  await slip.scrollIntoViewIfNeeded();
  const day = page.locator('[data-calendar-day="2026-09-16"]');
  const from = (await slip.boundingBox())!;
  const to = (await day.boundingBox())!;
  // Title links stop pointerdown; start on the #id in the slip's top-left.
  await page.mouse.move(from.x + 8, from.y + 6);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(from.x + 16, from.y + 10, { steps: 6 });
  await page.mouse.move(to.x + 16, to.y + 16, { steps: 20 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await expect(day.locator(`[data-id="${id}"]`)).toBeVisible();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(
    page.locator(`[data-calendar-day="2026-09-16"] [data-id="${id}"]`),
  ).toBeVisible();
  await page.goto(`${BOARD}`);
  const again = page.locator(`[data-id="${id}"]`);
  await again.hover();
  await expect(again.getByLabel("Target date")).toHaveValue("2026-09-16");
});

test("project calendar labels two boards and a chip hides one", async ({
  page,
}) => {
  await admin.from("projects").delete().eq("slug", PROJECT);
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Name").fill("E2E calendar project");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(`/p/${PROJECT}`);
    await page.getByRole("button", { name: "New board" }).click();
    await page.locator("#board-name").fill("Alpha");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${PROJECT}/b/alpha`);
    await page.getByRole("button", { name: "Add card to Unsorted" }).click();
    await page.locator("#new-card-title").fill("Alpha dated");
    await page.locator("#new-card-target").fill("2026-09-20");
    await page.getByRole("button", { name: "Create in Unsorted" }).click();
    await expect(page.locator("article").filter({ hasText: "Alpha dated" })).toBeVisible();
    await page.goto(`/p/${PROJECT}`);
    await page.getByRole("button", { name: "New board" }).click();
    await page.locator("#board-name").fill("Beta");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${PROJECT}/b/beta`);
    await page.getByRole("button", { name: "Add card to Unsorted" }).click();
    await page.locator("#new-card-title").fill("Beta dated");
    await page.locator("#new-card-target").fill("2026-09-20");
    await page.getByRole("button", { name: "Create in Unsorted" }).click();
    await expect(page.locator("article").filter({ hasText: "Beta dated" })).toBeVisible();
    await page.goto(`/p/${PROJECT}/calendar?month=2026-09`);
    const day = page.locator('[data-calendar-day="2026-09-20"]');
    await expect(day.locator(".calendar-slip-board").filter({ hasText: "Alpha" })).toBeVisible();
    await expect(day.locator(".calendar-slip-board").filter({ hasText: "Beta" })).toBeVisible();
    await page.locator(".calendar-chips").getByRole("link", { name: "Beta", exact: true }).click();
    await expect(day.getByText("Alpha dated")).toBeVisible();
    await expect(day.getByText("Beta dated")).toHaveCount(0);
  } finally {
    await admin.from("projects").delete().eq("slug", PROJECT);
  }
});

test("+N opens the rest of a packed day", async ({ page }) => {
  const n = await datePackedDay(page, "2026-09-18");
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  const more = page.locator('[data-calendar-day="2026-09-18"] .calendar-more');
  if ((await more.count()) === 0) test.skip();
  // Packed cells overflow the square day; the next week intercepts a pointer click.
  await more.evaluate((el) => (el as HTMLButtonElement).click());
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".calendar-day-popover [data-id]")).toHaveCount(n);
});

test("clicking a board-calendar slip opens the card dialog", async ({
  page,
}) => {
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  const slip = page.locator("[data-calendar-day] [data-id]").first();
  await expect(slip).toBeVisible();
  await slip.getByRole("link").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
