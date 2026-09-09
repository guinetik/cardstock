import { expect, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signInAs,
} from "./support/sign-in";

const suffix = Date.now();
const slug = `e2e-watch-${suffix}`;
const watcher = `watch-${suffix}@example.test`;
const teammate = `watch-peer-${suffix}@example.test`;
const password = "watch-test-123";
let projectId = "";
let cardId = "";
let nowLane = "";
let doneLane = "";
let memberId = "";

test.beforeAll(async () => {
  if (
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  )
    throw new Error("Watch tests require local Supabase.");
  const { data: project, error } = await admin
    .from("projects")
    .insert({ slug, name: "Watch test project" })
    .select("id")
    .single();
  if (error) throw error;
  projectId = project.id;
  await createMember(watcher, password);
  await createMember(teammate, password);
  await attachToProject(watcher, slug, "member");
  await attachToProject(teammate, slug, "member");
  const { data: member } = await admin
    .from("members")
    .update({ prefs: { notifications: { enabled: true } } })
    .eq("email", watcher)
    .select("id")
    .single();
  memberId = member!.id;
  const { data: board } = await admin
    .from("boards")
    .insert({ project_id: projectId, slug: "work", name: "Work" })
    .select("id")
    .single();
  const { data: lanes } = await admin
    .from("lanes")
    .insert([
      {
        board_id: board!.id,
        key: "now",
        name: "NOW",
        kind: "work",
        position: 1,
      },
      {
        board_id: board!.id,
        key: "done",
        name: "DONE",
        kind: "done",
        position: 2,
      },
    ])
    .select("id, key");
  nowLane = lanes!.find((lane) => lane.key === "now")!.id;
  doneLane = lanes!.find((lane) => lane.key === "done")!.id;
  const { data: card } = await admin
    .from("cards")
    .insert({
      board_id: board!.id,
      external_id: "24",
      title: "Keep an eye on this",
      lane_id: nowLane,
    })
    .select("id")
    .single();
  cardId = card!.id;
});

test.afterAll(async () => {
  if (projectId) await admin.from("projects").delete().eq("id", projectId);
  await dropMember(watcher);
  await dropMember(teammate);
});

test("watch persists, appears in the personal folder, and movement notifies away from the board", async ({
  page,
}, testInfo) => {
  let subscribed = false;
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      try {
        const raw = JSON.parse(String(payload));
        const frame = Array.isArray(raw)
          ? { topic: raw[2], event: raw[3], payload: raw[4] }
          : raw;
        if (
          frame.topic?.includes("watch-notifications:") &&
          frame.event === "phx_reply" &&
          frame.payload?.status === "ok"
        )
          subscribed = true;
      } catch {
        /* Not a JSON frame. */
      }
    }),
  );
  await page.addInitScript(() => {
    const notices: { title: string; body: string }[] = [];
    Object.assign(window, { watchTestNotices: notices });
    class BrowserNotice {
      static permission = "granted";
      static requestPermission = async () => "granted";
      constructor(title: string, options: { body: string }) {
        notices.push({ title, body: options.body });
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", {
      value: BrowserNotice,
      configurable: true,
    });
  });
  await signInAs(page, watcher, password);
  await expect.poll(() => subscribed).toBe(true);
  await page.goto(`/p/${slug}/b/work`);
  const watch = page.getByRole("button", {
    name: "Watch card #24",
    exact: true,
  });
  await expect(watch).toBeVisible();
  await watch.click();
  await expect(
    page.getByRole("button", { name: "Stop watching card #24" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Stop watching card #24" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: testInfo.outputPath("watch-board.png") });
  await page.goto("/projects");
  const folder = page.locator("li.folder").filter({
    has: page.getByRole("link", { name: "My watched issues", exact: true }),
  });
  await expect(
    folder.getByText("Keep an eye on this", { exact: false }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("watched-folder.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(folder).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath("watched-folder-mobile.png"),
  });
  // Moving through the database also covers events while no board is mounted.
  await admin.from("cards").update({ lane_id: doneLane }).eq("id", cardId);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { watchTestNotices: { title: string }[] }
        ).watchTestNotices.some((notice) => notice.title.includes("moved #24")),
      ),
    )
    .toBe(true);
  const { data: queued } = await admin
    .from("watch_notifications")
    .select("email_state")
    .eq("card_id", cardId)
    .eq("member_id", memberId)
    .eq("kind", "watchedMoved");
  expect(queued?.[0]?.email_state).toBe("pending");
  await folder.getByRole("link", { name: "Open watched issues" }).click();
  await expect(
    page.getByRole("heading", { name: "My watched issues" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop watching card #24" }).click();
  await expect(
    page.getByText("Nothing watched yet.", { exact: false }),
  ).toBeVisible();
  await page.goto(`/p/${slug}/b/work`);
  await expect(
    page.getByRole("button", { name: "Watch card #24", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("email opt-outs persist independently of browser settings", async ({
  page,
}) => {
  await signInAs(page, watcher, password);
  await page.goto("/profile");
  const emailSettings = page.getByRole("group", {
    name: "Email notifications",
  });
  const announcements = emailSettings.getByRole("checkbox", {
    name: "Someone starts watching",
    exact: false,
  });
  const moves = emailSettings.getByRole("checkbox", {
    name: "A watched card moves",
    exact: false,
  });
  const allEmail = page.getByRole("checkbox", { name: /^Email notifications/ });
  await expect(allEmail).toBeChecked();
  await expect(announcements).toBeChecked();
  await expect(moves).toBeChecked();
  await announcements.uncheck();
  await expect(moves).toBeEnabled();
  await expect(allEmail).toBeChecked({ indeterminate: true });
  await allEmail.click();
  await expect(announcements).toBeChecked();
  await expect(allEmail).toBeEnabled();
  await allEmail.uncheck();
  await expect(announcements).toBeEnabled();
  await page.reload();
  await expect(announcements).not.toBeChecked();
  await expect(moves).not.toBeChecked();
  await expect(allEmail).not.toBeChecked();
  await allEmail.check();
  await expect(announcements).toBeEnabled();
  await page.reload();
  await expect(announcements).toBeChecked();
  await expect(moves).toBeChecked();
  await expect(allEmail).toBeChecked();
});
