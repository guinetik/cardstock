import { expect, test } from "@playwright/test";
import { admin, OWNER, signIn } from "./support/sign-in";

/**
 * Collapsed (and maximized) lanes are member prefs, same as inbox sort.
 * A reload must not expand them again.
 */
const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

/**
 * Drop stored lane widths so this file cannot leave Unsorted collapsed for
 * the rest of the suite (collapsed lanes do not render their cards).
 */
async function clearLaneViews() {
  const { data } = await admin
    .from("members")
    .select("prefs")
    .eq("email", OWNER)
    .single();
  const prefs = { ...((data?.prefs as object) ?? {}) } as {
    laneViews?: unknown;
  };
  delete prefs.laneViews;
  await admin.from("members").update({ prefs }).eq("email", OWNER);
}

async function storedHasMin(): Promise<boolean> {
  const { data } = await admin
    .from("members")
    .select("prefs")
    .eq("email", OWNER)
    .single();
  const views = (
    data?.prefs as { laneViews?: Record<string, Record<string, string>> } | null
  )?.laneViews;
  return Object.values(views ?? {}).some((board) =>
    Object.values(board).includes("min"),
  );
}

test.beforeEach(async ({ page }) => {
  await clearLaneViews();
  await signIn(page);
  await page.goto(BOARD);
  await expect(page.locator('[data-lane="unsorted"]')).toBeVisible();
});

test.afterEach(async () => {
  await clearLaneViews();
});

test("a collapsed lane stays collapsed after reload", async ({ page }) => {
  const unsorted = page.locator('[data-lane="unsorted"]');
  await unsorted.getByLabel("Minimize lane").click();
  await expect(page.getByLabel("Expand Unsorted")).toBeVisible();

  await expect.poll(storedHasMin).toBe(true);

  await page.reload();
  await expect(page.getByLabel("Expand Unsorted")).toBeVisible();
  await expect(unsorted.getByLabel("Minimize lane")).toHaveCount(0);
});
