import { expect, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signIn,
  signInAs,
} from "./support/sign-in";

const suffix = Date.now();
const MEMBER = `e2e-picker-${suffix}@example.test`;
const PASSWORD = "correct horse battery";
const projectA = {
  slug: `e2e-picker-${suffix}-a`,
  name: `Picker Alpha ${suffix}`,
};
const projectB = {
  slug: `e2e-picker-${suffix}-b`,
  name: `Picker Beta ${suffix}`,
};
const boardPath = (slug: string) => `/p/${slug}/b/delivery`;
const projectIds: string[] = [];

test.beforeAll(async () => {
  for (const project of [projectA, projectB]) {
    const { data, error } = await admin
      .from("projects")
      .insert(project)
      .select("id")
      .single();
    expect(error).toBeNull();
    projectIds.push(data!.id);
    const { data: board, error: boardError } = await admin
      .from("boards")
      .insert({ project_id: data!.id, slug: "delivery", name: "Delivery" })
      .select("id")
      .single();
    expect(boardError).toBeNull();
    const { error: laneError } = await admin.from("lanes").insert({
      board_id: board!.id,
      key: "unsorted",
      name: "Unsorted",
      position: 0,
      kind: "inbox",
    });
    expect(laneError).toBeNull();
  }
});

test.afterAll(async () => {
  await dropMember(MEMBER);
  if (projectIds.length) {
    const { error } = await admin
      .from("projects")
      .delete()
      .in("id", projectIds);
    expect(error).toBeNull();
  }
});

test("switch boards by the logo from account and nested board pages", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");
  const trigger = page.getByRole("button", { name: "Switch board" });
  const logo = page.getByRole("link", { name: "cardstock", exact: true });
  const logoBox = await logo.boundingBox();
  const pickerBox = await trigger.boundingBox();
  expect(pickerBox!.x).toBeGreaterThan(logoBox!.x + logoBox!.width);
  expect(pickerBox!.x - (logoBox!.x + logoBox!.width)).toBeLessThan(20);
  await trigger.focus();
  await trigger.press("Enter");
  const menu = page.getByRole("menu", { name: "Switch board", exact: true });
  const alpha = menu.getByRole("group", { name: projectA.name });
  const beta = menu.getByRole("group", { name: projectB.name });
  await expect(
    alpha.getByRole("menuitem", { name: "Delivery", exact: true }),
  ).toBeVisible();
  await expect(
    beta.getByRole("menuitem", { name: "Delivery", exact: true }),
  ).toBeVisible();
  await alpha.getByRole("menuitem", { name: "Delivery", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(boardPath(projectA.slug));
  await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveText("Delivery");
  await trigger.click();
  await expect(
    alpha.getByRole("menuitem", { name: "Delivery", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.goto(`${boardPath(projectA.slug)}/calendar`);
  await trigger.click();
  await expect(
    alpha.getByRole("menuitem", { name: "Delivery", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await beta.getByRole("menuitem", { name: "Delivery", exact: true }).click();
  await expect(page).toHaveURL(boardPath(projectB.slug));
  await trigger.click();
  await expect(
    beta.getByRole("menuitem", { name: "Delivery", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    alpha.getByRole("menuitem", { name: "Delivery", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");
  await menu
    .getByRole("menuitem", { name: "All projects", exact: true })
    .click();
  await expect(page).toHaveURL("/projects");
  await expect(trigger).toHaveText("Boards");
});

test("members see only their accessible boards and the menu fits a narrow screen", async ({
  page,
}, testInfo) => {
  await createMember(MEMBER, PASSWORD);
  await attachToProject(MEMBER, projectA.slug, "member");
  await signInAs(page, MEMBER, PASSWORD);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects");
  await page.getByRole("button", { name: "Switch board" }).click();
  const menu = page.getByRole("menu", { name: "Switch board", exact: true });
  await expect(menu.getByRole("group", { name: projectA.name })).toBeVisible();
  await expect(menu.getByRole("group", { name: projectB.name })).toHaveCount(0);
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  const bounds = await menu.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("board-picker-mobile.png"),
  });
  await menu.getByRole("menuitem", { name: "Delivery", exact: true }).click();
  await expect(page).toHaveURL(boardPath(projectA.slug));
});

test("a member without projects gets an empty state and signed-out pages have no picker", async ({
  page,
}) => {
  await createMember(MEMBER, PASSWORD);
  await signInAs(page, MEMBER, PASSWORD);
  await page.goto("/projects");
  await page.getByRole("button", { name: "Switch board" }).click();
  const menu = page.getByRole("menu", { name: "Switch board", exact: true });
  await expect(
    menu.getByRole("menuitem", { name: "No boards available" }),
  ).toBeDisabled();
  await expect(menu.getByRole("group")).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "All projects" }).click();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Switch board" })).toHaveCount(
    0,
  );
});
