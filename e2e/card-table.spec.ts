import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

const slug = `e2e-table-${Date.now()}`;
const path = `/p/${slug}/b/work`;
let projectId = "";
let boardId = "";

test.beforeAll(async () => {
  if (
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  )
    throw new Error("Table tests require local Supabase.");
  const { data: project, error } = await admin
    .from("projects")
    .insert({ slug, name: "Table test project" })
    .select("id")
    .single();
  if (error) throw error;
  projectId = project.id;
  const { data: board, error: boardError } = await admin
    .from("boards")
    .insert({ project_id: projectId, slug: "work", name: "Delivery register" })
    .select("id")
    .single();
  if (boardError) throw boardError;
  boardId = board.id;
  const { data: lanes, error: laneError } = await admin
    .from("lanes")
    .insert([
      { board_id: boardId, key: "now", name: "NOW", kind: "work", position: 1 },
      {
        board_id: boardId,
        key: "next",
        name: "NEXT",
        kind: "work",
        position: 2,
      },
      {
        board_id: boardId,
        key: "archive",
        name: "ARCHIVE",
        kind: "archive",
        position: 3,
      },
    ])
    .select("id, key");
  if (laneError) throw laneError;
  const lane = (key: string) => lanes.find((l) => l.key === key)!.id;
  const { error: cardError } = await admin.from("cards").insert([
    {
      board_id: boardId,
      external_id: "10",
      title: "Write release notes",
      status: "wip",
      lane_id: lane("now"),
      rank: 1,
      priority: 2,
      effort: "L",
      target_date: "2026-09-20",
      raised_on: "2026-09-01",
    },
    {
      board_id: boardId,
      external_id: "2",
      title: "Fix account access",
      status: "backlog",
      lane_id: lane("next"),
      rank: 1,
      priority: 1,
      effort: "H",
      raised_on: "2026-09-02",
    },
    {
      board_id: boardId,
      external_id: "3",
      title: "Review notification copy",
      status: "wip",
      lane_id: lane("now"),
      rank: 2,
      effort: "M",
      target_date: "2026-09-18",
      raised_on: "2026-09-03",
    },
    {
      board_id: boardId,
      external_id: "99",
      title: "Old design",
      status: "done",
      rank: 1,
      lane_id: lane("archive"),
      archived_at: new Date().toISOString(),
    },
  ]);
  if (cardError) throw cardError;
});
test.afterAll(async () => {
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
});
test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("switching views preserves filters; columns sort without changing shared ranks", async ({
  page,
}) => {
  await page.goto(path);
  await page.getByRole("button", { name: "Table", exact: true }).click();
  const rows = page.locator("[data-card-row]");
  const ids = () =>
    rows.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-card-row")),
    );
  await expect(rows).toHaveCount(3);
  expect(await ids()).toEqual(["10", "3", "2"]);
  await page
    .getByRole("columnheader", { name: "#", exact: true })
    .getByRole("button")
    .click();
  expect(await ids()).toEqual(["2", "3", "10"]);
  await page
    .getByRole("columnheader", { name: "Priority", exact: true })
    .getByRole("button")
    .click();
  expect(await ids()).toEqual(["2", "10", "3"]);
  await page
    .getByRole("columnheader", { name: "Priority", exact: true })
    .getByRole("button")
    .click();
  expect(await ids()).toEqual(["10", "2", "3"]);
  await expect(
    page.getByRole("columnheader", { name: "Priority", exact: true }),
  ).toHaveAttribute("aria-sort", "descending");
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("#10");
  await expect(rows).toHaveCount(1);
  await page.getByRole("button", { name: "Kanban", exact: true }).click();
  await expect(page.locator('[data-id="10"]')).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search", exact: true }),
  ).toHaveValue("#10");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Archived", { exact: true }).check();
  await expect(rows).toHaveCount(4);
  const { data } = await admin
    .from("cards")
    .select("external_id,rank")
    .eq("board_id", boardId)
    .in("external_id", ["10", "2", "3"])
    .order("external_id");
  expect(data).toEqual([
    { external_id: "10", rank: 1 },
    { external_id: "2", rank: 1 },
    { external_id: "3", rank: 2 },
  ]);
});

test("table links open the card sheet and return to the filtered table; URL survives reload", async ({
  page,
}) => {
  await page.goto(`${path}?view=table`);
  await expect(page.getByRole("main", { name: "Card table" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Table", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("#10");
  await page
    .getByRole("link", { name: "Write release notes", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-card-row]")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Watch card #10", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("nothing-matches-this");
  await expect(
    page.getByText("No cards to show.", { exact: false }),
  ).toBeVisible();
});

test("table contains narrow-screen overflow and uses Paper in both themes", async ({
  page,
}, testInfo) => {
  await page.goto(`${path}?view=table`);
  await expect(page.locator("[data-card-row]")).toHaveCount(3);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const scroll = page.getByRole("region", { name: "Scrollable card table" });
    if (width === 390)
      expect(
        await scroll.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`table-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(
    () => (document.documentElement.dataset.theme = "paper-night"),
  );
  await page.screenshot({
    path: testInfo.outputPath("table-night.png"),
    fullPage: true,
  });
});

test("live changes update the table without losing its filter or sort", async ({
  page,
}) => {
  let subscribed = false;
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      try {
        const raw = JSON.parse(String(payload));
        const frame = Array.isArray(raw)
          ? { topic: raw[2], event: raw[3], payload: raw[4] }
          : raw;
        if (
          frame.topic === `realtime:board:${boardId}` &&
          frame.event === "phx_reply" &&
          frame.payload?.status === "ok"
        )
          subscribed = true;
      } catch {
        /* Ignore non-JSON heartbeat frames. */
      }
    }),
  );
  await page.goto(`${path}?view=table`);
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("#10");
  await page
    .getByRole("columnheader", { name: "Priority", exact: true })
    .getByRole("button")
    .click();
  await expect.poll(() => subscribed).toBe(true);
  try {
    const { error } = await admin
      .from("cards")
      .update({ title: "Release notes ready" })
      .eq("board_id", boardId)
      .eq("external_id", "10");
    if (error) throw error;
    await expect(
      page.getByRole("link", { name: "Release notes ready", exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("[data-card-row]")).toHaveCount(1);
    await expect(
      page.getByRole("columnheader", { name: "Priority", exact: true }),
    ).toHaveAttribute("aria-sort", "ascending");
  } finally {
    await admin
      .from("cards")
      .update({ title: "Write release notes" })
      .eq("board_id", boardId)
      .eq("external_id", "10");
  }
});
