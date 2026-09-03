import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

test("the epic cockpit moves from fleet signal to task detail", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo/b/backlog/cockpit");

  await expect(
    page.getByRole("heading", { name: "Epic Cockpit" }),
  ).toBeVisible();
  await expect(page.getByText("Active epics", { exact: true })).toBeVisible();
  const maps = page.getByTestId("task-map");
  await expect(maps.first()).toBeVisible();

  const task = maps.first().locator("a").first();
  await task.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const [taskBox, tipBox] = await Promise.all([
    task.boundingBox(),
    tooltip.boundingBox(),
  ]);
  expect(taskBox).not.toBeNull();
  expect(tipBox).not.toBeNull();
  expect(
    Math.abs(tipBox!.x - (taskBox!.x + taskBox!.width / 2 + 12)),
  ).toBeLessThan(20);
  expect(
    Math.abs(tipBox!.y - (taskBox!.y + taskBox!.height / 2 + 12)),
  ).toBeLessThan(20);

  const epic = page.locator(".cockpit-epic h2 a").first();
  await epic.click();
  await expect(page).toHaveURL(/\/cockpit\/[0-9a-f-]+$/);
  await expect(
    page.getByText("Epic flight plan", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Flight plan", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save commitment" }),
  ).toBeVisible();

  const selectedTask = page.locator("[data-testid=task-map] a").first();
  await selectedTask.click();
  await expect(page).toHaveURL(/\/c\/\d+\?from=cockpit&epic=/);
  await expect(
    page.getByRole("link", { name: /Product backlog/ }),
  ).toHaveAttribute("href", /\/cockpit\/[0-9a-f-]+$/);
});

test("the epic page maps its lanes and clips a task into the inbox", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo/b/backlog/cockpit");
  await page.locator(".cockpit-epic h2 a").first().click();
  await expect(page).toHaveURL(/\/cockpit\/[0-9a-f-]+$/);

  // The lane map is one link to the board — a read, not a control surface.
  const laneMap = page.locator(".lane-map--marked");
  await expect(laneMap).toBeVisible();
  await expect(laneMap).toHaveAttribute("href", "/p/demo/b/backlog");
  await expect(laneMap.locator(".lane-map-cell").first()).toBeVisible();

  const before = (await laneMap.getAttribute("aria-label")) ?? "";
  const inbox = before.split(", ")[0] ?? "";
  const cut = inbox.lastIndexOf(" ");
  const inboxName = inbox.slice(0, cut);
  const inboxCount = Number(inbox.slice(cut + 1));
  expect(Number.isNaN(inboxCount)).toBe(false);

  await page.getByRole("button", { name: "Add a task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task title").fill("Clipped during planning");
  await dialog.getByLabel("Priority").selectOption("1");
  await dialog.getByLabel("Effort").selectOption("M");
  await dialog.getByLabel("Planned start").fill("2026-09-01");
  await dialog.getByLabel("Target", { exact: true }).fill("2026-09-15");
  await dialog.getByRole("button", { name: `Add to ${inboxName}` }).click();
  await expect(
    dialog.getByText(/Added #\d+ — Clipped during planning/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();

  // The refreshed page recounts the epic: the clip lands in the inbox lane.
  await expect(laneMap).toHaveAttribute(
    "aria-label",
    new RegExp(`^${inboxName} ${inboxCount + 1}\\b`),
  );
});
