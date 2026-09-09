import { expect, type Page, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  signInAs,
} from "./support/sign-in";

const slug = `e2e-activity-${crypto.randomUUID()}`;
const email = `${slug}@example.test`;
const password = "activity-test-123";
const projectId = crypto.randomUUID();
const boardId = crypto.randomUUID();
const laneId = crypto.randomUUID();
const cards = [crypto.randomUUID(), crypto.randomUUID()];
const boardPath = `/p/${slug}/b/work`;
const check = (result: { error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
};

test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw new Error("Activity tests require local Supabase.");
  await createMember(email, password);
  check(
    await admin
      .from("projects")
      .insert({ id: projectId, slug, name: "Activity review" }),
  );
  await attachToProject(email, slug, "admin");
  check(
    await admin.from("boards").insert({
      id: boardId,
      project_id: projectId,
      slug: "work",
      name: "Work",
    }),
  );
  check(
    await admin.from("lanes").insert({
      id: laneId,
      board_id: boardId,
      key: "now",
      name: "Now",
      kind: "work",
      position: 1,
    }),
  );
  check(
    await admin.from("cards").insert(
      cards.map((id, i) => ({
        id,
        board_id: boardId,
        lane_id: laneId,
        external_id: String(i + 1),
        title: i ? "A note to weigh" : "A stone already filed",
        status: "wip",
        priority: i ? null : 1,
        rank: i,
        audience: "all",
      })),
    ),
  );
});

test.afterAll(async () => {
  check(await admin.from("projects").delete().eq("id", projectId));
  await dropMember(email);
});

/** Hold an actual foreground request until the pending UI has been inspected. */
async function hold(
  page: Page,
  predicate: (request: import("@playwright/test").Request) => boolean,
) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = async (route: import("@playwright/test").Route) => {
    if (predicate(route.request())) await gate;
    await route.continue();
  };
  await page.route("**/*", handler);
  return async () => {
    release();
    await page.unrouteAll({ behavior: "wait" });
  };
}

test("a priority save marks only the affected card until the database responds", async ({
  page,
}, testInfo) => {
  await signInAs(page, email, password);
  await page.goto(`${boardPath}/priorities`);
  const note = page.locator(`[data-priority-card="${cards[1]}"]`);
  const stone = page.locator(`[data-priority-card="${cards[0]}"]`);
  const indicator = page.getByTestId("app-activity");
  await expect(note).toBeVisible();
  await expect(indicator).toBeHidden();
  const release = await hold(
    page,
    (request) => !!request.headers()["next-action"],
  );
  try {
    await note.dragTo(stone, { targetPosition: { x: 8, y: 25 } });
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText("Saving…");
    await expect(note).toHaveAttribute("aria-busy", "true");
    await expect(note).toHaveCSS("opacity", "0.65");
    await expect(stone).not.toHaveAttribute("data-saving", "true");
    await page.screenshot({ path: testInfo.outputPath("saving-priority.png") });
  } finally {
    await release();
  }
  await expect(note).not.toHaveAttribute("aria-busy", "true");
  await expect(indicator).toBeHidden();
  await expect
    .poll(
      async () =>
        (
          await admin
            .from("cards")
            .select("priority")
            .eq("id", cards[1])
            .single()
        ).data?.priority,
    )
    .toBe(1);
});

test("a failed watch clears the indicator and leaves the retry and error visible", async ({
  page,
}) => {
  await signInAs(page, email, password);
  await page.goto(boardPath);
  const watch = page.getByRole("button", {
    name: "Watch card #1",
    exact: true,
  });
  await expect(watch).toBeVisible();
  const release = await hold(
    page,
    (request) => !!request.headers()["next-action"],
  );
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-action"]) await route.abort("failed");
    else await route.fallback();
  });
  try {
    await watch.click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Could not update your watch" }),
    ).toContainText("Could not update your watch");
    await expect(page.getByTestId("app-activity")).toBeHidden();
    await expect(watch).toBeEnabled();
    await expect(watch).toHaveAttribute("aria-pressed", "false");
  } finally {
    await release();
  }
});

test("navigation and form saves share the indicator without blocking the page", async ({
  page,
}, testInfo) => {
  await signInAs(page, email, password);
  await page.getByRole("button", { name: "Account menu" }).click();
  const releaseNavigation = await hold(
    page,
    (request) => new URL(request.url()).pathname === "/profile",
  );
  const indicator = page.getByTestId("app-activity");
  try {
    await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText("Loading…");
  } finally {
    await releaseNavigation();
  }
  await expect(page).toHaveURL("/profile");
  await expect(indicator).toBeHidden();
  await page.locator("#profile-name").fill("Activity reviewer");
  const releaseSave = await hold(
    page,
    (request) => !!request.headers()["next-action"],
  );
  try {
    await page.getByRole("button", { name: "Save name", exact: true }).click();
    await expect(indicator).toHaveText("Saving…");
    await expect(indicator).toBeVisible();
    await expect(
      page.locator("form").filter({ has: page.locator("#profile-name") }),
    ).toHaveAttribute("aria-busy", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(indicator.locator(".app-activity-mark")).toHaveCSS(
      "animation-name",
      "none",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath("saving-profile-mobile.png"),
    });
  } finally {
    await releaseSave();
  }
  await expect(page.getByText("Name saved.", { exact: true })).toBeVisible();
  await expect(indicator).toBeHidden();
});
