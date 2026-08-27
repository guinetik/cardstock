import { expect, test } from "@playwright/test";
import { admin, OWNER, signIn } from "./support/sign-in";

/**
 * The Unsorted lane's order control. Regression guard: this shipped broken
 * because the sort only ran when every inbox card had rank 0, which the ETL
 * never produces — the unit tests passed while the control did nothing.
 */
const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";

const unsortedIds = (page: import("@playwright/test").Page) =>
  page
    .locator('[data-lane="unsorted"] [data-id]')
    .evaluateAll((n) => n.map((e) => Number(e.getAttribute("data-id"))));

test.beforeEach(async ({ page }) => {
  await signIn(page);
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

/** Force the stored preference, so a test never starts from what it asserts. */
async function setStoredSort(value: string) {
  const { data } = await admin
    .from("members")
    .select("prefs")
    .eq("email", OWNER)
    .single();
  const prefs = { ...((data?.prefs as object) ?? {}), inboxSort: value };
  await admin.from("members").update({ prefs }).eq("email", OWNER);
}

async function storedSort() {
  const { data } = await admin
    .from("members")
    .select("prefs")
    .eq("email", OWNER)
    .single();
  return (data?.prefs as { inboxSort?: string } | null)?.inboxSort;
}

test("the date orders are each other's reverse and survive a reload", async ({
  page,
}) => {
  // Start from "newest" — which is also the default — so that ending on
  // "oldest" cannot be satisfied by a stale preference or by the fallback.
  await setStoredSort("newest");
  await page.reload();
  await expect(
    page.locator('[data-lane="unsorted"] [data-id]').first(),
  ).toBeVisible();

  const sort = page.getByLabel("Unsorted order");
  const newest = await unsortedIds(page);
  await sort.selectOption("oldest");
  const oldest = await unsortedIds(page);
  expect(oldest).not.toEqual(newest);

  // The save is fired without being awaited, so wait for it to land rather
  // than racing it — a reload that overtakes it renders the old preference.
  await expect.poll(storedSort).toBe("oldest");

  await page.reload();
  await expect(
    page.locator('[data-lane="unsorted"] [data-id]').first(),
  ).toBeVisible();
  expect(await unsortedIds(page)).toEqual(oldest);
});
