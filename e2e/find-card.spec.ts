import { expect, type Page, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signInAs,
} from "./support/sign-in";

const slug = `e2e-find-${crypto.randomUUID()}`;
const email = `${slug}@example.test`;
const password = "find-card-test-123";
const projectId = crypto.randomUUID();
const boardId = crypto.randomUUID();
const lanes = Array.from({ length: 8 }, () => crypto.randomUUID());
const path = `/p/${slug}/b/work`;
const check = (result: { error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
};

test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw new Error("Find tests require local Supabase.");
  await createMember(email, password);
  check(
    await admin
      .from("projects")
      .insert({ id: projectId, slug, name: "Find card review" }),
  );
  await attachToProject(email, slug, "admin");
  check(
    await admin.from("boards").insert({
      id: boardId,
      project_id: projectId,
      slug: "work",
      name: "Work",
    }),
  );
  check(
    await admin.from("lanes").insert(
      lanes.map((id, i) => ({
        id,
        board_id: boardId,
        key: `lane-${i}`,
        name: `Lane ${i}`,
        position: i,
        kind: i === 7 ? "archive" : "work",
      })),
    ),
  );
  const cards = Array.from({ length: 30 }, (_, i) => ({
    external_id: String(400 + i),
    title: `Email delivery task ${i}`,
    lane_id: lanes[5],
    rank: i,
    archived_at: null,
  }));
  cards.push({
    external_id: "500",
    title: "Collapsed lane task",
    lane_id: lanes[4],
    rank: 0,
    archived_at: null,
  });
  check(
    await admin.from("cards").insert([
      ...cards.map((card) => ({
        ...card,
        board_id: boardId,
        status: "wip",
        audience: "all",
      })),
      {
        board_id: boardId,
        external_id: "900",
        title: "Archived task",
        lane_id: lanes[7],
        rank: 0,
        status: "done",
        audience: "all",
        archived_at: new Date().toISOString(),
      },
    ]),
  );
  check(
    await admin
      .from("members")
      .update({ prefs: { laneViews: { [boardId]: { [lanes[4]]: "min" } } } })
      .eq("email", email),
  );
});
test.afterAll(async () => {
  check(await admin.from("projects").delete().eq("id", projectId));
  await dropMember(email);
});
test.beforeEach(async ({ page }) => {
  await signInAs(page, email, password);
  await page.goto(path);
});

async function find(page: Page, number: string) {
  await page.getByRole("button", { name: "Find Card", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Card number", exact: true });
  await expect(input).toBeFocused();
  await input.fill(number);
  await input.press("Enter");
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("find jumps horizontally and vertically, centers and expands the exact card", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const board = page.getByRole("main", { name: "Priority lanes" });
  const target = page.locator('[data-id="424"] .paper-card');
  await page.keyboard.press("Control+p");
  const input = page.getByRole("textbox", { name: "Card number", exact: true });
  await expect(input).toBeFocused();
  await input.pressSequentially("abc");
  await expect(input).toHaveValue("");
  await input.fill("99999");
  await input.press("Enter");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "isn’t on this board",
  );
  await input.fill("424");
  await page.screenshot({ path: testInfo.outputPath("find-card-popup.png") });
  await input.press("Enter");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(target).toHaveAttribute("data-pinned", "true");
  await expect(target.locator("[data-card-title]")).toBeFocused();
  await expect(target.getByLabel("Status", { exact: true })).toBeVisible();
  await expect
    .poll(() => board.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  const stack = page.locator('[data-lane="lane-5"] [data-lane-cards]');
  await expect
    .poll(() => stack.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const b = (await board.boundingBox())!,
        c = (await target.boundingBox())!;
      return (
        c.x >= b.x &&
        c.x + c.width <= b.x + b.width &&
        c.y >= b.y &&
        c.y + c.height <= b.y + b.height
      );
    })
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("found-card.png") });
  // Repeating the same find still jumps back after manual scrolling.
  await board.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await find(page, "424");
  await expect
    .poll(() => board.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
});

test("find reveals filtered, collapsed and archived cards without changing filter or saved lane preferences", async ({
  page,
}) => {
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  await search.fill("nothing matches this");
  await expect(
    page.getByRole("button", { name: "Expand Lane 4", exact: true }),
  ).toBeVisible();
  await find(page, "500");
  await expect(page.locator('[data-id="500"] .paper-card')).toHaveAttribute(
    "data-found",
    "true",
  );
  await expect(page.getByText(/Revealed outside your filters/)).toBeVisible();
  await expect(search).toHaveValue("nothing matches this");
  await page.getByRole("button", { name: "Clear find", exact: true }).click();
  await expect(page.locator('[data-id="500"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Expand Lane 4", exact: true }),
  ).toBeVisible();
  await find(page, "900");
  await expect(page.locator('[data-id="900"] .paper-card')).toHaveAttribute(
    "data-found",
    "true",
  );
  await expect(
    page.getByRole("checkbox", { name: "Archived", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Clear find", exact: true }).click();
  await expect(page.locator('[data-lane="lane-7"]')).toHaveCount(0);
  const { data } = await admin
    .from("members")
    .select("prefs")
    .eq("email", email)
    .single();
  expect(data?.prefs.laneViews[boardId][lanes[4]]).toBe("min");
});

test("table find opens Kanban, and the popup fits mobile and cancels with Escape", async ({
  page,
}, testInfo) => {
  await page.goto(`${path}?view=table`);
  await find(page, "424");
  await expect(page).toHaveURL(path);
  await expect(page.locator('[data-id="424"] .paper-card')).toHaveAttribute(
    "data-found",
    "true",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Find Card", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("find-card-mobile.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Find Card", exact: true }),
  ).toBeFocused();
});
