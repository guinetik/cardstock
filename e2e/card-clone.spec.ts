import { expect, test } from "@playwright/test";
import { admin, attachToProject, OWNER, signIn } from "./support/sign-in";

let BOARD = "";
let projectId = "";
let boardId = "";
let marker = "";

test.beforeEach(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname,
    )
  )
    throw new Error("Clone tests require local Supabase.");
  marker = `Clone regression ${Date.now()}`;
  const slug = `e2e-clone-${crypto.randomUUID()}`;
  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({ slug, name: "Clone regression" })
    .select("id")
    .single();
  if (projectError) throw projectError;
  projectId = project.id;
  await attachToProject(OWNER, slug, "admin");
  const { data, error } = await admin
    .from("boards")
    .insert({ project_id: projectId, slug: "work", name: "Clone tests" })
    .select("id")
    .single();
  if (error) throw error;
  boardId = data.id;
  BOARD = `/p/${slug}/b/work`;
  const lanes = await admin.from("lanes").insert([
    {
      board_id: boardId,
      key: "unsorted",
      name: "Unsorted",
      kind: "inbox",
      position: 0,
    },
    {
      board_id: boardId,
      key: "archive",
      name: "Archive",
      kind: "archive",
      position: 1,
    },
  ]);
  if (lanes.error) throw lanes.error;
  const epic = await admin
    .from("epics")
    .insert({ board_id: boardId, source_name: "Clone epic" });
  if (epic.error) throw epic.error;
  const group = await admin
    .from("tag_groups")
    .insert({ board_id: boardId, key: "kind", name: "Kind" })
    .select("id")
    .single();
  if (group.error) throw group.error;
  const tags = await admin.from("tags").insert([
    { group_id: group.data.id, key: "bug", name: "Bug" },
    { group_id: group.data.id, key: "enhancement", name: "Enhancement" },
  ]);
  if (tags.error) throw tags.error;
});

test.afterEach(async () => {
  // Deleting only cards leaves reserved IDs behind. Drop the isolated project
  // so neither fixtures nor their tombstones affect a real board's numbering.
  if (projectId) {
    const { error } = await admin.from("projects").delete().eq("id", projectId);
    expect(error).toBeNull();
    projectId = "";
    boardId = "";
  }
});

async function seedSource(archived = false) {
  const [{ data: lanes }, { data: epics }, { data: tags }, { data: member }] =
    await Promise.all([
      admin.from("lanes").select("id, kind").eq("board_id", boardId),
      admin
        .from("epics")
        .select("id, source_name")
        .eq("board_id", boardId)
        .limit(1),
      admin
        .from("tags")
        .select("id, tag_groups!inner(board_id)")
        .eq("tag_groups.board_id", boardId)
        .limit(2),
      admin.from("members").select("id, email").eq("email", OWNER).single(),
    ]);
  const inbox = lanes!.find((lane) => lane.kind === "inbox")!;
  const lane = archived
    ? lanes!.find((item) => item.kind === "archive")!
    : inbox;
  expect(epics!.length).toBeGreaterThan(0);
  expect(tags!.length).toBeGreaterThan(0);
  const { data: source, error } = await admin
    .from("cards")
    .insert({
      board_id: boardId,
      external_id: "1",
      lane_id: lane.id,
      rank: -10,
      title: marker,
      summary: marker,
      body_md:
        "## Ask\n\nRepeat this description.\n\n## Status\n\nOriginal notes.\n\n## Comments\n\n### 2026-09-01 12:00 · someone\n\n> Private conversation on the original.",
      status: "done",
      epic_id: epics![0].id,
      epic: epics![0].source_name,
      assignee_id: member!.id,
      assignee: member!.email,
      area: "Customer experience",
      priority: 1,
      effort: "M",
      audience: "internal",
      color: "blue",
      planned_start_date: "2026-09-08",
      target_date: "2026-09-10",
      raised_on: "2026-01-01",
      raised_by: "Original author",
      shipped_on: "2026-09-01",
      needs: "Old blocker",
      archived_at: archived ? "2026-09-01T00:00:00Z" : null,
      archived_by: archived ? OWNER : null,
    })
    .select("*")
    .single();
  expect(error).toBeNull();
  const tagIds = tags!.map((tag) => tag.id).sort();
  const { error: tagError } = await admin
    .from("card_tags")
    .insert(tagIds.map((tag_id) => ({ card_id: source!.id, tag_id })));
  expect(tagError).toBeNull();
  // Tag changes also update the card timestamp; capture the complete fixture.
  const { data: seeded, error: readError } = await admin
    .from("cards")
    .select("*")
    .eq("id", source!.id)
    .single();
  expect(readError).toBeNull();
  return { source: seeded!, inbox, tagIds };
}

test("clone an archived card into an editable fresh card without changing its source", async ({
  page,
}) => {
  const { source, inbox, tagIds } = await seedSource(true);
  await signIn(page);
  await page.goto(`${BOARD}/c/${source.external_id}`);
  await page.getByRole("button", { name: "Clone card", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: `Clone card #${source.external_id}`,
  });
  await expect(dialog.getByLabel("Issue title")).toHaveValue(source.title);
  await expect(dialog.getByLabel("Summary — in plain words")).toHaveValue(
    marker,
  );
  await expect(
    dialog.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("backlog");
  await expect(
    dialog.getByRole("combobox", { name: "Epic", exact: true }),
  ).toHaveValue(source.epic_id);
  await expect(
    dialog.getByRole("combobox", { name: "Assignee", exact: true }),
  ).toHaveValue(source.assignee_id);
  await expect(dialog.getByTestId("issue-body-editor")).toContainText(
    "Repeat this description.",
  );
  await expect(dialog.getByTestId("issue-body-editor")).not.toContainText(
    "Private conversation",
  );
  const title = `${marker} copy`;
  await dialog.getByLabel("Issue title").fill(title);
  await dialog.getByRole("button", { name: /^Create in / }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  // The editor is remounted for the new identity when navigating between cards.
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue(title);

  const { data: copy, error } = await admin
    .from("cards")
    .select("*")
    .eq("board_id", boardId)
    .eq("title", title)
    .single();
  expect(error).toBeNull();
  expect(copy!.id).not.toBe(source.id);
  expect(copy!.external_id).not.toBe(source.external_id);
  expect(copy!.external_id).toBe("2");
  expect(copy).toMatchObject({
    title,
    summary: marker,
    lane_id: inbox.id,
    status: "backlog",
    epic_id: source.epic_id,
    assignee_id: source.assignee_id,
    area: source.area,
    priority: source.priority,
    effort: source.effort,
    audience: source.audience,
    color: source.color,
    planned_start_date: source.planned_start_date,
    target_date: source.target_date,
    archived_at: null,
    archived_by: null,
    shipped_on: null,
    needs: null,
  });
  expect(copy!.body_md).toContain("Repeat this description.");
  expect(copy!.body_md).not.toContain("## Comments");
  expect(copy!.raised_on).not.toBe(source.raised_on);
  const { data: copyTags } = await admin
    .from("card_tags")
    .select("tag_id")
    .eq("card_id", copy!.id);
  expect(copyTags!.map((tag) => tag.tag_id).sort()).toEqual(tagIds);
  const { data: original } = await admin
    .from("cards")
    .select("*")
    .eq("id", source.id)
    .single();
  expect(original).toEqual(source);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue(title);
});

test("cancel a clone from the board dialog, then reopen and create it", async ({
  page,
}) => {
  const { source } = await seedSource();
  await signIn(page);
  await page.goto(BOARD);
  // Include the internal source in the board's audience filter.
  const audience = page
    .locator("#filters")
    .getByRole("button", { name: "Internal", exact: true });
  if (await audience.count()) await audience.click();
  await page
    .locator(`[data-id="${source.external_id}"]`)
    .getByRole("link")
    .first()
    .click();
  await page.getByRole("button", { name: "Clone card", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: `Clone card #${source.external_id}`,
  });
  await dialog.getByLabel("Issue title").fill("Discard this draft");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const { count } = await admin
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("board_id", boardId)
    .eq("summary", marker);
  expect(count).toBe(1);

  await page.getByRole("button", { name: "Clone card", exact: true }).click();
  await expect(dialog.getByLabel("Issue title")).toHaveValue(source.title);
  const title = `${marker} from dialog`;
  await dialog.getByLabel("Issue title").fill(title);
  await dialog.getByRole("button", { name: /^Create in / }).click();
  await expect(
    page.getByRole("heading", { level: 1 }).filter({ hasText: title }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue(title);
});

test("ordinary card creation still starts blank", async ({ page }) => {
  await signIn(page);
  await page.goto(BOARD);
  await page.getByRole("button", { name: "Add card to Unsorted" }).click();
  const dialog = page.getByRole("dialog", { name: "Write the issue" });
  await expect(dialog.getByLabel("Issue title")).toHaveValue("");
  await expect(dialog.getByLabel("Summary — in plain words")).toHaveValue("");
  await expect(
    dialog.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("backlog");
  await dialog.getByLabel("Issue title").fill(marker);
  await dialog.getByLabel("Summary — in plain words").fill(marker);
  await dialog.getByRole("button", { name: "Create in Unsorted" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator("article").filter({ hasText: marker }),
  ).toBeVisible();
});
