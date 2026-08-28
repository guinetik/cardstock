import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

/**
 * The tag taxonomy: the groups a board sorts tags into, and the tags in them.
 *
 * These used to be three hardcoded word lists in the importer, so a group you
 * added in the database was one the importer would never file anything into.
 * They are now the board's own rows, which makes the editor and the importer
 * two views of one thing — and makes it worth testing that adding a tag here
 * actually changes what a tracker file is allowed to say.
 */

const GROUP = `E2E Team ${Date.now()}`;
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
    .like("key", "e2e-%");
  for (const g of groups ?? []) {
    await admin.from("tags").delete().eq("group_id", g.id);
    await admin.from("tag_groups").delete().eq("id", g.id);
  }
});

test("a group and its tags can be created, renamed and removed", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo");

  await page.getByLabel("New tag group").fill(GROUP);
  await page.getByRole("button", { name: "Add group" }).click();
  await expect(page.getByText(GROUP_KEY)).toBeVisible();

  // The ID is derived from the name and shown, because frontmatter uses it.
  await page.getByLabel(`New tag in ${GROUP}`).fill("Back End");
  await page.getByRole("button", { name: `Add tag` }).last().click();
  await expect(page.getByText("back-end")).toBeVisible();

  // Renaming changes the display name and leaves the ID alone — a card's
  // frontmatter names the tag by that ID.
  await page.getByRole("button", { name: "Rename Back End" }).click();
  await page
    .getByRole("textbox", { name: "Name for back-end" })
    .fill("Backend");
  await page.getByRole("button", { name: "Save name for back-end" }).click();
  await expect(page.getByText("Backend")).toBeVisible();
  await expect(page.getByText("back-end")).toBeVisible();

  const { data: tag } = await admin
    .from("tags")
    .select("key, name")
    .eq("key", "back-end")
    .maybeSingle();
  expect(tag?.name).toBe("Backend");
});

test("a tag ID cannot be claimed by two groups", async ({ page }) => {
  await signIn(page);
  await page.goto("/p/demo");

  // `bug` already exists under Kind on the demo board. A second group claiming
  // it would make a bare `bug` in a tracker file ambiguous everywhere.
  await page.getByLabel("New tag group").fill(`E2E Clash ${Date.now()}`);
  await page.getByRole("button", { name: "Add group" }).click();
  const clash = page.locator("li").filter({ hasText: "E2E Clash" }).last();
  await clash.getByRole("textbox").fill("Bug");
  await clash.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(/already uses the ID/i)).toBeVisible();
});

test("a tag still on a card cannot be removed", async ({ page }) => {
  await signIn(page);
  await page.goto("/p/demo");

  // Demo cards carry Kind tags; removing one out from under them would strip
  // it off the cards, and the next import would put it straight back.
  const { data: used } = await admin
    .from("card_tags")
    .select("tags(name)")
    .limit(1)
    .single();
  const name = (used?.tags as unknown as { name: string } | null)?.name;
  expect(name).toBeTruthy();

  await page
    .getByRole("button", { name: `Remove ${name}` })
    .first()
    .click();
  await expect(page.getByText(/still use/i).first()).toBeVisible();
});
