import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signInAs,
} from "./support/sign-in";

const slug = `e2e-download-${Date.now()}`;
const email = `${slug}@example.test`;
const outsider = `${slug}-outsider@example.test`;
const password = "download-test-123";
const boardPath = `/p/${slug}/b/work`;
let projectId = "";
let boardId = "";
let token = "";
let memberId = "";

test.beforeAll(async () => {
  if (
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  )
    throw new Error("Download tests require local Supabase.");
  const { data: project, error } = await admin
    .from("projects")
    .insert({ slug, name: "Markdown download test" })
    .select("id")
    .single();
  if (error) throw error;
  projectId = project.id;
  await createMember(email, password);
  await createMember(outsider, password);
  await attachToProject(email, slug, "member");
  const { data: member } = await admin
    .from("members")
    .select("id")
    .eq("email", email)
    .single();
  memberId = member!.id;
  const tokenId = randomBytes(6).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  token = `cst_${tokenId}_${secret}`;
  const { error: tokenError } = await admin.from("cli_tokens").insert({
    id: tokenId,
    member_id: memberId,
    name: "Download parity test",
    token_hash: createHash("sha256").update(secret).digest("hex"),
  });
  if (tokenError) throw tokenError;
  const { data: board, error: boardError } = await admin
    .from("boards")
    .insert({ project_id: projectId, slug: "work", name: "Work" })
    .select("id")
    .single();
  if (boardError) throw boardError;
  boardId = board.id;
  const { data: lane, error: laneError } = await admin
    .from("lanes")
    .insert({
      board_id: boardId,
      key: "now",
      name: "In Progress",
      kind: "work",
      position: 1,
    })
    .select("id")
    .single();
  if (laneError) throw laneError;
  for (const id of ["1", "2", "3"]) {
    const body =
      "## Ask\n\nKeep **this** description.\n\n## Status\n\nWorking.\n\n## Comments\n\n### 2026-09-09 10:00 · Teammate\n\n> Keep this comment.";
    const source = `---\nid: ${id}\ntitle: Download example ${id}\nstatus: wip\nepic: Test\narea: UI\ntags: []\ncustom:\n  nested: [keep, this]\n---\n# #${id} — Download example ${id}\n\n${body}\n`;
    const { data: card, error: cardError } = await admin
      .from("cards")
      .insert({
        board_id: boardId,
        external_id: id,
        title: `Download example ${id}`,
        status: "wip",
        epic: "Test",
        area: "UI",
        lane_id: lane.id,
        rank: Number(id),
        priority: 2,
        effort: "L",
        body_md: body,
        source_text: id === "2" ? null : source,
        frontmatter_extra: { custom: { nested: ["keep", "this"] } },
      })
      .select("id")
      .single();
    if (cardError) throw cardError;
    if (id === "3") {
      const { data: projection, error: projectionError } = await admin.rpc(
        "cli_card_projection",
        { p_id: card.id },
      );
      if (projectionError) throw projectionError;
      const { error: updateError } = await admin
        .from("cards")
        .update({ sync_projection: projection, priority: 1, color: "pink" })
        .eq("id", card.id);
      if (updateError) throw updateError;
    }
  }
});
test.afterAll(async () => {
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
  await dropMember(email);
  await dropMember(outsider);
});

test("downloads match CLI markdown for source, source-less, and rebased cards without changing stored data", async ({
  page,
}) => {
  await signInAs(page, email, password);
  const before = await admin
    .from("cards")
    .select("*")
    .eq("board_id", boardId)
    .order("external_id");
  const response = await page.request.get(`/api/v1/boards/${slug}/work/sync`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  const snapshot = await response.json();
  for (const card of snapshot.cards) {
    const download = await page.request.get(
      `${boardPath}/c/${card.externalId}/download`,
    );
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(download.headers()["content-disposition"]).toBe(
      `attachment; filename="${card.externalId}.md"`,
    );
    expect(download.headers()["cache-control"]).toContain("no-store");
    expect(await download.text()).toBe(card.markdown);
    expect(await download.text()).toContain("Keep this comment.");
    expect(await download.text()).toContain("custom:");
  }
  const after = await admin
    .from("cards")
    .select("*")
    .eq("board_id", boardId)
    .order("external_id");
  expect(after.data).toEqual(before.data);
});

test("clicking download waits for title autosave and blocks a failed save", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/c/1`);
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
  await page.route(`**${boardPath}/c/1`, async (route) => {
    if (route.request().method() === "POST")
      await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.getByLabel("Title", { exact: true }).fill("Saved before download");
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download markdown", exact: true })
    .click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("1.md");
  expect(await readFile((await file.path())!, "utf8")).toContain(
    "title: Saved before download",
  );
  await page.getByLabel("Title", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Download markdown", exact: true })
    .click();
  await expect(
    page.getByText("An edit could not be saved. Fix it before downloading.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Saved before download");
  const retried = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download markdown", exact: true })
    .click();
  await retried;
});

test("the modal supports downloads and warns about unposted comments and unsaved body edits", async ({
  page,
}, testInfo) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}?view=table`);
  await page
    .getByRole("link", { name: "Download example 2", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByTestId("comment-composer").fill("Not posted yet");
  await dialog
    .getByRole("button", { name: "Download markdown", exact: true })
    .click();
  await expect(
    page.getByText("Post or clear your comment before downloading."),
  ).toBeVisible();
  await page.getByTestId("comment-composer").fill("");
  await page.getByTestId("edit-issue-body").click();
  const editor = page
    .getByTestId("issue-body-editor")
    .locator('[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await editor.fill("Body draft to save");
  await dialog
    .getByRole("button", { name: "Download markdown", exact: true })
    .click();
  await expect(
    page.getByText("Save or cancel your body edits before downloading."),
  ).toBeVisible();
  await page.getByTestId("save-issue-body").click();
  await expect(page.getByTestId("issue-body")).toContainText(
    "Body draft to save",
  );
  const downloaded = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Download markdown", exact: true })
    .click();
  expect(await readFile((await (await downloaded).path())!, "utf8")).toContain(
    "Body draft to save",
  );
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await dialog.screenshot({
    path: testInfo.outputPath("download-modal-mobile.png"),
  });
});

test("missing cards, outsiders, and revoked membership cannot download a sheet", async ({
  page,
  request,
}) => {
  const signedOut = await request.get(`${boardPath}/c/1/download`, {
    maxRedirects: 0,
  });
  expect([307, 401]).toContain(signedOut.status());
  await signInAs(page, outsider, password);
  expect((await page.request.get(`${boardPath}/c/1/download`)).status()).toBe(
    404,
  );
  await page.context().clearCookies();
  await signInAs(page, email, password);
  expect((await page.request.get(`${boardPath}/c/999/download`)).status()).toBe(
    404,
  );
  expect(
    (await page.request.get(`${boardPath}/c/not-a-card/download`)).status(),
  ).toBe(404);
  await admin
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("member_id", memberId);
  try {
    expect((await page.request.get(`${boardPath}/c/1/download`)).status()).toBe(
      404,
    );
  } finally {
    await attachToProject(email, slug, "member");
  }
});
