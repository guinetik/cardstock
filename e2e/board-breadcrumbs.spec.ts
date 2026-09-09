import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

const BOARD = "/p/demo/b/backlog";
let projectName = "";
let boardName = "";

test.beforeAll(async () => {
  const { data, error } = await admin
    .from("projects")
    .select("name, boards(slug, name)")
    .eq("slug", "demo")
    .single();
  expect(error).toBeNull();
  projectName = data!.name;
  boardName = data!.boards.find((board) => board.slug === "backlog")!.name;
});

for (const [route, label] of [
  ["cockpit", "Epic Cockpit"],
  ["calendar", "Calendar"],
  ["timeline", "Timeline"],
  ["priorities", "Priorities"],
  ["manage", "Configuration"],
]) {
  test(`${label} names the project, board, and current page with the right destinations`, async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${BOARD}/${route}`);
    const trail = page.getByRole("navigation", {
      name: "Breadcrumb",
      exact: true,
    });
    await expect(trail).toHaveCount(1);
    await expect(trail.getByRole("link")).toHaveText([projectName, boardName]);
    await expect(trail.locator('[aria-current="page"]')).toHaveText(label);
    await expect(trail.getByRole("link").nth(0)).toHaveAttribute(
      "href",
      "/p/demo",
    );
    await expect(trail.getByRole("link").nth(1)).toHaveAttribute("href", BOARD);
    await expect(
      page.locator("main").getByRole("link", { name: /^← / }),
    ).toHaveCount(0);

    await trail.getByRole("link").nth(1).click();
    await expect(page).toHaveURL(BOARD);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(boardName);
    await page.goto(`${BOARD}/${route}`);
    await trail.getByRole("link").nth(0).click();
    await expect(page).toHaveURL("/p/demo");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      projectName,
    );
  });
}

test("the board calendar has one breadcrumb and the global picker on a narrow screen", async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BOARD}/calendar?month=2026-09`);
  const trail = page.getByRole("navigation", {
    name: "Breadcrumb",
    exact: true,
  });
  await expect(trail).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "September",
  );
  await expect(
    page.getByRole("combobox", { name: "Switch board" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Switch board" })).toHaveCount(
    1,
  );
  const bounds = await trail.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("calendar-breadcrumbs.png"),
  });

  // The project calendar retains its choice of individual calendars and All boards.
  await page.goto("/p/demo/calendar?month=2026-09");
  await expect(
    page.getByRole("combobox", { name: "Switch board" }),
  ).toBeVisible();
});
