import { expect, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signInAs,
} from "./support/sign-in";

const slug = `e2e-checklist-${Date.now()}`;
const email = `${slug}@example.test`;
const password = "checklist-test-123";
const boardPath = `/p/${slug}/b/work`;
let projectId = "";
let cardId = "";
let epicId = "";

test.beforeAll(async () => {
  if (
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  )
    throw new Error("Checklist item tests require local Supabase.");
  const { data: project, error } = await admin
    .from("projects")
    .insert({ slug, name: "Checklist item test" })
    .select("id")
    .single();
  if (error) throw error;
  projectId = project.id;
  await createMember(email, password);
  await attachToProject(email, slug, "admin");
  const { data: board, error: boardError } = await admin
    .from("boards")
    .insert({ project_id: projectId, slug: "work", name: "Work" })
    .select("id")
    .single();
  if (boardError) throw boardError;
  const { data: lane, error: laneError } = await admin
    .from("lanes")
    .insert({
      board_id: board.id,
      key: "now",
      name: "Now",
      kind: "work",
      position: 0,
    })
    .select("id")
    .single();
  if (laneError) throw laneError;
  const inbox = await admin.from("lanes").insert({
    board_id: board.id,
    key: "inbox",
    name: "Inbox",
    kind: "inbox",
    position: 1,
  });
  if (inbox.error) throw inbox.error;
  const { data: epic, error: epicError } = await admin
    .from("epics")
    .insert({ board_id: board.id, source_name: "Checklist epic" })
    .select("id")
    .single();
  if (epicError) throw epicError;
  epicId = epic.id;
  const { data: card, error: cardError } = await admin
    .from("cards")
    .insert({
      board_id: board.id,
      external_id: "1",
      title: "Checklist example",
      area: "UI",
      status: "wip",
      lane_id: lane.id,
      rank: 1,
      epic: "Checklist epic",
      epic_id: epic.id,
      body_md: "## Ask\nKeep this body.",
      checklist_input: {
        present: true,
        items: [
          { label: "First", completed: false },
          { label: "Second", completed: true },
        ],
      },
    })
    .select("id")
    .single();
  if (cardError) throw cardError;
  cardId = card.id;
});
test.afterAll(async () => {
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
  await dropMember(email);
});

test("checklist editing persists, exports and displays battery progress", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/c/1`);
  const list = page.getByRole("region", { name: "Checklist", exact: true });
  await expect(list).toContainText("1/2 completed");
  await expect(page.getByTestId("issue-body")).not.toContainText("Checklist");
  await list
    .getByRole("checkbox", { name: "Complete First", exact: true })
    .check();
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list).toContainText("2/2 completed");
  await list
    .getByRole("textbox", { name: "New checklist item", exact: true })
    .fill("Third");
  await list.getByRole("button", { name: "Add", exact: true }).click();
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list).toContainText("2/3 completed");
  await list
    .getByRole("button", { name: "Move checklist item 3 up", exact: true })
    .click();
  await expect(list).toHaveAttribute("aria-busy", "false");
  const label = list.getByRole("textbox", {
    name: "Checklist item 2",
    exact: true,
  });
  await expect(label).toHaveValue("Third");
  await label.fill("Review");
  await label.press("Enter");
  await expect(list).toHaveAttribute("aria-busy", "false");
  await page.reload();
  await expect(label).toHaveValue("Review");
  const response = await page.request.get(`${boardPath}/c/1/download`);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain(
    "## Checklist\n- [x] First\n- [ ] Review\n- [x] Second",
  );
  const { data: card } = await admin
    .from("cards")
    .select("body_md,status")
    .eq("id", cardId)
    .single();
  expect(card?.body_md).toBe("## Ask\nKeep this body.");
  expect(card?.status).toBe("wip");
  for (const route of [
    `${boardPath}/cockpit`,
    `${boardPath}/cockpit/${epicId}`,
  ]) {
    await page.goto(route);
    const battery = page.getByTestId("task-map").locator("a").first();
    await expect(battery).toHaveAttribute(
      "aria-label",
      /2\/3 checklist items completed/,
    );
    await expect(battery.locator('rect[data-completed="true"]')).toHaveCount(2);
    await expect(battery.locator('rect[data-completed="false"]')).toHaveCount(
      1,
    );
  }
  await page.goto(boardPath);
  await page.locator('[data-id="1"]').getByRole("link").first().click();
  const modalList = page
    .getByRole("dialog")
    .getByRole("region", { name: "Checklist", exact: true });
  await expect(modalList).toContainText("2/3 completed");
  await modalList
    .getByRole("button", { name: "Delete checklist item 2", exact: true })
    .click();
  await expect(modalList).toHaveAttribute("aria-busy", "false");
  await expect(modalList).toContainText("2/2 completed");
});

test("pasted body checklist is extracted and saved with a replacement notice", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/c/1`);
  await page.getByTestId("edit-issue-body").click();
  const editor = page
    .getByTestId("issue-body-editor")
    .locator('[contenteditable="true"]');
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await editor.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.setData(
      "text/plain",
      "## Ask\nNew body.\n\n## Checklist\n- [ ] Replacement\n- [x] Already done",
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(
    page.getByText(
      "Saving this Checklist section will replace the existing checklist.",
    ),
  ).toBeVisible();
  await page.getByTestId("save-issue-body").click();
  await expect(page.getByTestId("issue-body")).toContainText("New body.");
  await expect(
    page.getByRole("checkbox", { name: "Complete Replacement", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("issue-body")).not.toContainText("Checklist");
});

test("failed saves retain edits and can be retried", async ({ page }) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/c/1`);
  const list = page.getByRole("region", { name: "Checklist", exact: true });
  const checkbox = list.getByRole("checkbox").first();
  const wasChecked = await checkbox.isChecked();
  let interrupted = false;
  await page.route("**/c/1", async (route) => {
    if (
      !interrupted &&
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    ) {
      interrupted = true;
      await route.abort("failed");
    } else await route.continue();
  });
  await checkbox.setChecked(!wasChecked);
  await expect(list.getByRole("alert")).toContainText(
    "Could not save the checklist",
  );
  await expect(checkbox).toBeChecked({ checked: !wasChecked });
  await list.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list.getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(checkbox).toBeChecked({ checked: !wasChecked });
});

test("cloning copies the checklist with new identities and unchecked items", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/c/1`);
  const { data: before } = await admin
    .from("card_checklist_items")
    .select("id,label,completed,position")
    .eq("card_id", cardId)
    .order("position");
  await page.getByRole("button", { name: "Clone card", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Clone card #1",
    exact: true,
  });
  await dialog
    .getByLabel("Summary — in plain words")
    .fill("Copy the checklist");
  await dialog.getByRole("button", { name: /^Create in / }).click();
  await expect(page).toHaveURL(new RegExp(`${boardPath}/c/2$`));
  const list = page.getByRole("region", { name: "Checklist", exact: true });
  await expect(list).toContainText(`0/${before!.length} completed`);
  const { data: after } = await admin
    .from("card_checklist_items")
    .select(
      "id,label,completed,position,cards!inner(external_id,boards!inner(project_id))",
    )
    .eq("cards.external_id", "2")
    .eq("cards.boards.project_id", projectId)
    .order("position");
  expect(after?.map((i) => i.label)).toEqual(before?.map((i) => i.label));
  expect(
    after?.every((i) => !i.completed && !before!.some((b) => b.id === i.id)),
  ).toBe(true);
});

test("cockpit batteries keep status color, equal insets, and readable segments as they grow", async ({
  page,
}) => {
  const { data: original } = await admin
    .from("cards")
    .select("board_id,lane_id")
    .eq("id", cardId)
    .single();
  const plain = await admin.from("cards").insert({
    board_id: original!.board_id,
    lane_id: original!.lane_id,
    external_id: "3",
    title: "Plain task",
    status: "wip",
    epic_id: epicId,
    epic: "Checklist epic",
    rank: 3,
  });
  expect(plain.error).toBeNull();
  const setItems = async (count: number) => {
    const result = await admin
      .from("cards")
      .update({
        checklist_input: {
          present: true,
          items: Array.from({ length: count }, (_, i) => ({
            label: `Item ${i + 1}`,
            completed: i < 2,
          })),
        },
      })
      .eq("id", cardId);
    expect(result.error).toBeNull();
  };
  await signInAs(page, email, password);
  for (const route of [
    `${boardPath}/cockpit`,
    `${boardPath}/cockpit/${epicId}`,
  ]) {
    await setItems(4);
    await page.goto(route);
    const battery = page.getByTestId("task-map").locator('a[href*="/c/1?"]');
    const plainTask = page.getByTestId("task-map").locator('a[href*="/c/3?"]');
    await expect(battery).toBeVisible();
    expect(
      await battery
        .locator(".cockpit-task-square")
        .evaluate((e) => getComputedStyle(e).fill),
    ).toBe(
      await plainTask
        .locator(".cockpit-task-square")
        .evaluate((e) => getComputedStyle(e).fill),
    );
    const segments = battery.locator("rect[data-completed]");
    await expect(segments).toHaveCount(4);
    const small = (await battery.boundingBox())!;
    const first = (await segments.first().boundingBox())!;
    const last = (await segments.last().boundingBox())!;
    expect(
      Math.abs(
        first.x - small.x - (small.x + small.width - last.x - last.width),
      ),
    ).toBeLessThan(1);
    expect(
      await segments.first().evaluate((e) => getComputedStyle(e).stroke),
    ).toBe("rgb(255, 255, 255)");
    await setItems(40);
    await page.reload();
    await expect(segments).toHaveCount(40);
    const expanded = (await battery.boundingBox())!;
    const expandedSegment = (await segments.first().boundingBox())!;
    const next = (await plainTask.boundingBox())!;
    expect(expanded.width).toBeGreaterThan(small.width * 5);
    expect(expandedSegment.width).toBeCloseTo(first.width, 1);
    expect(
      next.x >= expanded.x + expanded.width ||
        next.y >= expanded.y + expanded.height,
    ).toBe(true);
  }
});
