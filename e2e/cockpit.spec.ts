import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

test("the epic cockpit moves from fleet signal to task detail", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo/b/backlog/cockpit");

  await expect(
    page.getByRole("heading", { name: "Epic cockpit" }),
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
