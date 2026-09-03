import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

const BOARD = process.env.E2E_BOARD_PATH ?? "/p/demo/b/backlog";
const MANAGE = `${BOARD}/manage`;
const GROUP = `E2E Manage ${Date.now()}`;
const GROUP_KEY = GROUP.toLowerCase().replace(/[^a-z0-9]+/g, "-");
let boardId = "";

test.beforeAll(async () => {
  const { data: board } = await admin
    .from("boards")
    .select("id, projects!inner(slug)")
    .eq("slug", "backlog")
    .eq("projects.slug", "demo")
    .single();
  boardId = board?.id as string;
});

test.afterAll(async () => {
  const { data: groups } = await admin
    .from("tag_groups")
    .select("id")
    .eq("board_id", boardId)
    .like("key", "e2e-manage-%");
  for (const group of groups ?? []) {
    await admin.from("tags").delete().eq("group_id", group.id);
    await admin.from("tag_groups").delete().eq("id", group.id);
  }
});

test("the board header opens this board's concepts and gates", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(BOARD);
  await page.getByRole("link", { name: "Manage", exact: true }).click();
  await expect(page).toHaveURL(MANAGE);
  await expect(page.getByRole("heading", { name: "Manage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "concepts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "gates" })).toBeVisible();
  await expect(page.getByLabel("New tag group")).toBeVisible();
  await expect(page.getByLabel("Name for Built")).toHaveValue("Built");
  await expect(page.getByLabel("Name for Shipped")).toHaveValue("Shipped");
});

test("a concept added on manage is this board's vocabulary", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(MANAGE);
  await page.getByLabel("New tag group").fill(GROUP);
  await page.getByRole("button", { name: "Add group" }).click();
  await expect(page.getByText(GROUP_KEY)).toBeVisible();

  const { data: row } = await admin
    .from("tag_groups")
    .select("board_id, name")
    .eq("key", GROUP_KEY)
    .maybeSingle();
  expect(row?.board_id).toBe(boardId);
  expect(row?.name).toBe(GROUP);
});
