import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const EMAIL = process.env.E2E_MEMBER_EMAIL ?? "e2e@example.com";
const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByRole("button", { name: "Sign in (local dev)" }).click();
  await page.waitForURL(/\/(p\/|$)/);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto(BOARD);
  await expect(page.locator("[data-lane]").first()).toBeVisible();
});

test("gate: signed-out users land on /login", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BOARD);
  await expect(p).toHaveURL(/\/login/);
  await ctx.close();
});

test("board renders lanes in seed order with counts", async ({ page }) => {
  const names = await page.locator("[data-lane] h2").allTextContents();
  expect(names.slice(0, 8)).toEqual([
    "Unsorted",
    "Now",
    "Next",
    "Later",
    "Nice-to-have",
    "Parked",
    "Needs input",
    "Built",
  ]);
  await expect(page.locator('[data-lane="archive"]')).toHaveCount(0); // hidden by default
  const n = await page.locator("article").count();
  expect(n).toBeGreaterThanOrEqual(5);
});

test("priority, difficulty and target persist", async ({ page }) => {
  const card = page.locator('[data-lane="unsorted"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await card.hover();
  await card.locator('[data-priority="1"]').click();
  await card.locator('[data-effort="M"]').click();
  await card.locator('input[type="date"]').fill("2026-10-15");
  await page.waitForTimeout(600);
  await page.reload();
  const again = page.locator(`[data-id="${id}"]`);
  await expect(again.locator('[data-priority="1"]')).toHaveClass(/bg-violet/);
  await expect(again.locator('[data-effort="M"]')).toHaveClass(/bg-amber/);
  await expect(again.locator('input[type="date"]')).toHaveValue("2026-10-15");
  // and the timeline shows it under October 2026
  await page.goto(`${BOARD}/timeline`);
  await expect(
    page.getByRole("heading", { name: /October 2026/ }),
  ).toBeVisible();
  await expect(page.locator(`a[href$="/c/${id}"]`)).toBeVisible();
});

test("drag a card from Unsorted to Next and it survives reload", async ({
  page,
}) => {
  const card = page.locator('[data-lane="unsorted"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  const target = page.locator('[data-lane="next"]');
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 60, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + 70, from.y + 30, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
  await page.mouse.up();
  await expect(
    page.locator(`[data-lane="next"] [data-id="${id}"]`),
  ).toBeVisible();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(
    page.locator(`[data-lane="next"] [data-id="${id}"]`),
  ).toBeVisible();
});

test("filters: search narrows, P1 chip filters, clear restores", async ({
  page,
}) => {
  const total = await page.locator("article:visible").count();
  await page.locator("#search").fill("zzzz-no-such-card");
  await expect(page.locator("article:visible")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear" }).click();
  expect(await page.locator("article:visible").count()).toBe(total);
  await page
    .locator("#filters")
    .getByRole("button", { name: "P1", exact: true })
    .click();
  const p1 = await page.locator("article:visible").count();
  expect(p1).toBeLessThan(total);
});

test("archive from the card page hides it and shows it under 'archived'", async ({
  page,
}) => {
  const card = page
    .locator(
      '[data-lane="nice-to-have"] [data-id], [data-lane="later"] [data-id]',
    )
    .first();
  const id = await card.getAttribute("data-id");
  await page.goto(`${BOARD}/c/${id}`);
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("status")).toHaveText(/Archived/);
  await page.goto(BOARD);
  await expect(page.locator(`[data-id="${id}"]`)).toHaveCount(0);
  await page.getByLabel("archived").check();
  await expect(
    page.locator(`[data-lane="archive"] [data-id="${id}"]`),
  ).toBeVisible();
  // restore so the suite is re-runnable
  await page.goto(`${BOARD}/c/${id}`);
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("status")).toHaveText(/Restored/);
  await page.goto(BOARD);
  await expect(page.locator(`[data-id="${id}"]`)).toBeVisible();
  await expect(
    page.locator(`[data-lane="archive"] [data-id="${id}"]`),
  ).toHaveCount(0);
});

test("card title and hover pill open the card page with the full body", async ({
  page,
}) => {
  const card = page.locator('[data-lane="now"] [data-id]').first();
  const id = await card.getAttribute("data-id");
  await card.hover();
  await card.getByTestId("open-issue").click();
  await expect(page).toHaveURL(new RegExp(`/c/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`#${id}`);
  await expect(page.getByRole("heading", { name: /^Ask$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^History$/i })).toBeVisible();
});

test("CSV export downloads the board", async ({ page }) => {
  const res = await page.request.get(`${BOARD}/export?internal=1`);
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text.split("\n")[0]).toContain(
    "id,title,lane,status,priority,effort,target_date",
  );
  expect(text.split("\n").length).toBeGreaterThanOrEqual(5);
});

test("work lanes can be created, renamed, reordered and removed", async ({
  page,
}) => {
  const suffix = Date.now();
  const initialName = `CRUD lane ${suffix}`;
  const renamed = `Review lane ${suffix}`;
  const key = `crud-lane-${suffix}`;

  const navAddLane = page
    .getByRole("navigation")
    .getByRole("button", { name: "Add lane" });
  await expect(navAddLane).toBeVisible();
  await navAddLane.click();
  await page.getByLabel("Lane name").fill(initialName);
  await page.getByRole("button", { name: "Add lane", exact: true }).click();
  const lane = page.locator(`[data-lane="${key}"]`);
  await expect(lane).toBeVisible();

  await lane
    .getByRole("button", { name: `Manage ${initialName} lane` })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Lane name").fill(renamed);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.locator(`[data-lane="${key}"] h2`)).toHaveText(renamed);

  const card = page.locator('[data-lane="done"] [data-id]').first();
  const cardId = await card.getAttribute("data-id");
  // Service role: this is a test back door for setting up board state, not the
  // behaviour under test. Local Supabase only.
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: createdLane, error: laneError } = await db
    .from("lanes")
    .select("id")
    .eq("key", key)
    .single();
  expect(laneError).toBeNull();
  const { error: cardError } = await db
    .from("cards")
    .update({ lane_id: createdLane!.id, rank: 1 })
    .eq("external_id", cardId!);
  expect(cardError).toBeNull();
  await page.reload();
  await expect(lane.locator(`[data-id="${cardId}"]`)).toBeVisible();

  const before = await page
    .locator("[data-lane]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-lane")),
    );
  await lane.getByRole("button", { name: `Manage ${renamed} lane` }).click();
  await page.getByRole("menuitem", { name: "Move left" }).click();
  await expect
    .poll(async () =>
      page
        .locator("[data-lane]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-lane")),
        ),
    )
    .not.toEqual(before);

  await lane.getByRole("button", { name: `Manage ${renamed} lane` }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(page.getByText(/1 card will be moved/)).toBeVisible();
  await page.getByLabel("Move cards to").selectOption({ label: "Done" });
  await page.getByRole("button", { name: "Move cards and remove" }).click();
  await expect(page.locator(`[data-lane="${key}"]`)).toHaveCount(0);
  await expect(
    page.locator(`[data-lane="done"] [data-id="${cardId}"]`),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(`[data-lane="${key}"]`)).toHaveCount(0);
});

test("screenshot for review", async ({ page }) => {
  await page.screenshot({ path: "screenshots/board.png" });
  await page.goto(`${BOARD}/timeline`);
  await page.screenshot({ path: "screenshots/timeline.png" });
});
