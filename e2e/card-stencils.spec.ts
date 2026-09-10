import { expect, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signInAs,
} from "./support/sign-in";

const slug = `e2e-stencil-${Date.now()}`;
const email = `${slug}@example.test`;
const memberEmail = `${slug}-member@example.test`;
const password = "stencil-test-123";
const boardPath = `/p/${slug}/b/work`;
const skeleton =
  "## Ask\n\nDescribe the work.\n\n## Status\n\nReady for planning.\n";
let projectId = "";
let boardId = "";
let laneId = "";
let stencilId = "";
let tagIds: string[] = [];

// Each test owns its board, so failures and filtered runs cannot affect another case.
test.beforeEach(async () => {
  if (
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  )
    throw new Error("Stencil tests require local Supabase.");
  const { data: project, error } = await admin
    .from("projects")
    .insert({ slug, name: "Stencil test" })
    .select("id")
    .single();
  if (error) throw error;
  projectId = project.id;
  for (const [address, role] of [
    [email, "admin"],
    [memberEmail, "member"],
  ] as const) {
    await createMember(address, password);
    await attachToProject(address, slug, role);
  }
  const { data: board, error: boardError } = await admin
    .from("boards")
    .insert({
      project_id: projectId,
      slug: "work",
      name: "Work",
      settings: { card_template: skeleton },
    })
    .select("id")
    .single();
  if (boardError) throw boardError;
  boardId = board.id;
  const { data: lane, error: laneError } = await admin
    .from("lanes")
    .insert({
      board_id: boardId,
      key: "now",
      name: "Now",
      kind: "work",
      position: 0,
    })
    .select("id")
    .single();
  if (laneError) throw laneError;
  laneId = lane.id;
  const { data: group, error: groupError } = await admin
    .from("tag_groups")
    .insert({ board_id: boardId, key: "kind", name: "Kind" })
    .select("id")
    .single();
  if (groupError) throw groupError;
  const { data: tags, error: tagError } = await admin
    .from("tags")
    .insert([
      { group_id: group.id, key: "integration", name: "Integration work" },
      { group_id: group.id, key: "delivery", name: "Delivery" },
    ])
    .select("id");
  if (tagError) throw tagError;
  tagIds = tags.map((tag) => tag.id);
  const { data: stencil, error: stencilError } = await admin
    .from("card_stencils")
    .insert({
      board_id: boardId,
      name: "Integration",
      title: "Integration",
      summary: "Deliver one client integration.",
      area: "Delivery",
      effort: "M",
      body_md:
        "## Ask\n\nConnect the client.\n\n## Checklist\n- [ ] Credentialing\n- [ ] Field mapping\n- [ ] Go live\n",
    })
    .select("id")
    .single();
  if (stencilError) throw stencilError;
  stencilId = stencil.id;
  const { error: linksError } = await admin
    .from("card_stencil_tags")
    .insert(tagIds.map((tag_id) => ({ stencil_id: stencilId, tag_id })));
  if (linksError) throw linksError;
});

test.afterEach(async () => {
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
  await dropMember(email);
  await dropMember(memberEmail);
});

test("authoring persists editable checklist steps, tags and board-template content", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/manage`);
  await page.getByLabel("New stencil name").fill("New hire");
  await page.getByRole("button", { name: "Add stencil", exact: true }).click();
  const row = page.locator("li", {
    has: page.getByText("New hire", { exact: true }),
  });
  await expect(row).toContainText("0 steps");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "Start from the board's card template",
      exact: true,
    })
    .click();
  await expect(dialog.getByTestId("issue-body-editor")).toContainText(
    "Describe the work.",
  );
  await dialog.getByLabel("Default card title").fill("Welcome a new hire");
  await dialog
    .getByLabel("Summary", { exact: true })
    .fill("Prepare a new colleague's first day.");
  for (const label of ["Laptop", "Badge", "Accounts"]) {
    await dialog.getByRole("button", { name: "Add step", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: /^Step / })
      .last()
      .fill(label);
  }
  await dialog
    .getByRole("button", { name: "Move step 3 up", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Step 2", exact: true }),
  ).toHaveValue("Accounts");
  await dialog
    .getByRole("button", { name: "Integration work", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Delivery", exact: true }).click();
  await page.screenshot({
    path: ".cardstock/stencils-dialog.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Save stencil", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("3 steps · 2 tags");
  await page.reload();
  await expect(row).toContainText("3 steps · 2 tags");
  const { data: saved, error } = await admin
    .from("card_stencils")
    .select("body_md, card_stencil_tags(tag_id)")
    .eq("board_id", boardId)
    .eq("name", "New hire")
    .single();
  if (error) throw error;
  expect(saved.body_md).toContain("Describe the work.");
  expect(saved.body_md).toMatch(
    /## Checklist\r?\n- \[ \] Laptop\r?\n- \[ \] Accounts\r?\n- \[ \] Badge(?:\r?\n|$)/,
  );
  expect(saved.card_stencil_tags).toHaveLength(2);
  const { data: board } = await admin
    .from("boards")
    .select("settings")
    .eq("id", boardId)
    .single();
  expect(board?.settings.card_template).toBe(skeleton);
  await page.screenshot({
    path: ".cardstock/stencils-manage.png",
    fullPage: true,
  });
  // Duplicate names are reported without losing the existing row.
  await page.getByLabel("New stencil name").fill("New hire");
  await page.getByRole("button", { name: "Add stencil", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "stencils", exact: true })
      .getByRole("alert"),
  ).toContainText("already has a stencil");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Remove step 3", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Delivery", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save stencil", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("2 steps · 1 tag");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
});

test("stamping creates an independent card with real ordered checklist rows", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(boardPath);
  await page
    .getByRole("button", { name: /add card/i })
    .first()
    .click();
  await page
    .getByRole("menuitem", { name: "Integration", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Issue title", { exact: true })).toHaveValue(
    "Integration",
  );
  await dialog
    .getByLabel("Issue title", { exact: true })
    .fill("Integration — Denali");
  await expect(
    dialog.getByRole("combobox", { name: "Priority", exact: true }),
  ).toHaveValue("");
  await dialog
    .getByRole("button", { name: "Create in Now", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Integration — Denali", { exact: true }),
  ).toBeVisible();
  const { data: card, error } = await admin
    .from("cards")
    .select(
      "id, lane_id, priority, assignee_id, epic_id, effort, area, card_checklist_items(label, position, completed), card_tags(tag_id)",
    )
    .eq("board_id", boardId)
    .eq("title", "Integration — Denali")
    .single();
  if (error) throw error;
  expect(card.lane_id).toBe(laneId);
  expect(card.priority).toBeNull();
  expect(card.assignee_id).toBeNull();
  expect(card.epic_id).toBeNull();
  expect(card.area).toBe("Delivery");
  expect(card.effort).toBe("M");
  expect(card.card_tags).toHaveLength(2);
  expect(
    card.card_checklist_items
      .sort((a, b) => a.position - b.position)
      .map(({ label, completed }) => ({ label, completed })),
  ).toEqual(
    ["Credentialing", "Field mapping", "Go live"].map((label) => ({
      label,
      completed: false,
    })),
  );
  await page.goto(`${boardPath}/manage`);
  const row = page.locator("li", {
    has: page.getByText("Integration", { exact: true }),
  });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Step 1", exact: true })
    .fill("Changed stencil step");
  await page.getByRole("button", { name: "Save stencil", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(row).toHaveCount(0);
  const { data: items } = await admin
    .from("card_checklist_items")
    .select("label")
    .eq("card_id", card.id)
    .order("position");
  expect(items?.map((item) => item.label)).toEqual([
    "Credentialing",
    "Field mapping",
    "Go live",
  ]);
});

test("blank cards keep the existing flow with and without stencils", async ({
  page,
}) => {
  const { error: removeSeedError } = await admin
    .from("card_stencils")
    .delete()
    .eq("id", stencilId);
  if (removeSeedError) throw removeSeedError;
  const { data: row, error } = await admin
    .from("card_stencils")
    .insert({ board_id: boardId, name: "Blank flow stencil" })
    .select("id")
    .single();
  if (error) throw error;
  try {
    await signInAs(page, email, password);
    await page.goto(boardPath);
    await page
      .getByRole("button", { name: /add card/i })
      .first()
      .click();
    await page
      .getByRole("menuitem", { name: "Blank card", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("Issue title", { exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByRole("dialog").getByTestId("issue-body-editor"),
    ).toContainText("Describe the work.");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await admin.from("card_stencils").delete().eq("id", row.id);
  }
  await page.reload();
  await page
    .getByRole("button", { name: /add card/i })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByTestId("issue-body-editor"),
  ).toContainText("Describe the work.");
});

test("ordinary members see the stencil section without management controls", async ({
  page,
}) => {
  await signInAs(page, memberEmail, password);
  await page.goto(`${boardPath}/manage`);
  const section = page.getByRole("region", { name: "stencils", exact: true });
  await expect(section).toContainText("Only an owner or project admin");
  await expect(
    section.getByRole("button", { name: "Add stencil", exact: true }),
  ).toHaveCount(0);
});

test("unbulleted template steps import with a notice and leave the board template unchanged", async ({
  page,
}) => {
  const template =
    "## Problem\r\n\r\n## Approach\r\n\r\n## Checklist\r\n\r\n[ ] T1\r\n[ ] T2\r\n[ ] T3";
  const { error } = await admin
    .from("boards")
    .update({
      settings: { card_template: template },
    })
    .eq("id", boardId);
  if (error) throw error;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/manage`);
  await page.getByLabel("New stencil name").fill("Template import");
  await page.getByRole("button", { name: "Add stencil", exact: true }).click();
  const row = page.locator("li", {
    has: page.getByText("Template import", { exact: true }),
  });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", {
      name: "Start from the board's card template",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Checklist formatting was corrected",
  );
  await dialog
    .getByRole("status")
    .screenshot({ path: ".cardstock/stencils-import-warning.png" });
  for (const [index, label] of ["T1", "T2", "T3"].entries()) {
    await expect(
      dialog.getByRole("textbox", { name: `Step ${index + 1}`, exact: true }),
    ).toHaveValue(label);
  }
  await dialog
    .getByRole("button", { name: "Save stencil", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("3 steps");
  const { data: board, error: boardError } = await admin
    .from("boards")
    .select("settings")
    .eq("id", boardId)
    .single();
  if (boardError) throw boardError;
  expect(board.settings.card_template).toBe(template);
  const { data: saved, error: savedError } = await admin
    .from("card_stencils")
    .select("body_md")
    .eq("board_id", boardId)
    .eq("name", "Template import")
    .single();
  if (savedError) throw savedError;
  expect(saved.body_md).toMatch(/- \[ \] T1\r?\n- \[ \] T2\r?\n- \[ \] T3/);
  expect(pageErrors).toEqual([]);
});

test("invalid board-template checklist stays in the dialog without losing the draft", async ({
  page,
}) => {
  const { error } = await admin
    .from("boards")
    .update({
      settings: {
        card_template: "## Ask\nDescribe the work.\n\n## Checklist\n- [ ] \n",
      },
    })
    .eq("id", boardId);
  if (error) throw error;

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/manage`);
  await page.getByLabel("New stencil name").fill("Template recovery");
  await page.getByRole("button", { name: "Add stencil", exact: true }).click();
  const row = page.locator("li", {
    has: page.getByText("Template recovery", { exact: true }),
  });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Default card title").fill("Keep my draft");
  await dialog
    .getByRole("button", {
      name: "Start from the board's card template",
      exact: true,
    })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "flat checklist with non-empty labels",
  );
  await expect(dialog.getByLabel("Default card title")).toHaveValue(
    "Keep my draft",
  );
  await expect(dialog.getByTestId("issue-body-editor")).not.toContainText(
    "Describe the work.",
  );
  await expect(dialog.getByRole("textbox", { name: /^Step / })).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  await dialog.getByRole("button", { name: "Add step", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "Step 1", exact: true })
    .fill("A real step");
  await dialog
    .getByRole("button", { name: "Save stencil", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("1 step");
});
