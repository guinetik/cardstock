import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

const BOARD = "/p/demo/b/backlog";
let createdLaneIds: string[] = [];
let createdCardIds: string[] = [];
let doneLaneId = "";

test.beforeEach(async ({ page }) => {
  createdLaneIds = [];
  createdCardIds = [];
  await signIn(page);
  await page.goto(BOARD);
  await expect(page.locator("[data-lane]").first()).toBeVisible();
});

test.afterEach(async () => {
  if (createdCardIds.length > 0)
    await admin.from("cards").delete().in("id", createdCardIds);
  for (const laneId of [...createdLaneIds].reverse()) {
    if (doneLaneId)
      await admin.rpc("delete_work_lane", {
        p_lane_id: laneId,
        p_destination_lane_id: doneLaneId,
      });
  }
});

async function addLane(
  page: import("@playwright/test").Page,
  boardId: string,
  name: string,
  color?: string,
) {
  await page
    .getByRole("group", { name: "Board actions" })
    .getByRole("button", { name: "Add lane" })
    .click();
  await page.getByLabel("Lane name").fill(name);
  if (color)
    await page
      .getByLabel("New lane color")
      .getByRole("button", { name: color })
      .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add lane", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const { data, error } = await admin
    .from("lanes")
    .select("id, key")
    .eq("board_id", boardId)
    .eq("name", name)
    .single();
  expect(error).toBeNull();
  createdLaneIds.push(data!.id);
  return data!;
}

test("lane colors reach the project map and lane-wide actions persist", async ({
  page,
}) => {
  const { data: board } = await admin
    .from("boards")
    .select("id")
    .eq("slug", "backlog")
    .single();
  const { data: done } = await admin
    .from("lanes")
    .select("id")
    .eq("board_id", board!.id)
    .eq("kind", "done")
    .single();
  doneLaneId = done!.id;

  const suffix = Date.now();
  const left = await addLane(page, board!.id, `Bulk left ${suffix}`, "Blue");
  const leftColumn = page.locator(`[data-lane="${left.key}"]`);
  await expect(leftColumn).toHaveClass(/lane-color--blue/);

  await page.goto("/p/demo");
  await expect(page.locator(".lane-map-col.lane-color--blue")).toBeVisible();
  await page.goto(BOARD);

  const right = await addLane(page, board!.id, `Bulk right ${suffix}`);
  const rightColumn = page.locator(`[data-lane="${right.key}"]`);
  const base = BigInt(suffix) * 10n;
  const numbers = [base, base + 1n, base + 2n, base + 3n].map(String);
  const { data: inserted, error: insertError } = await admin
    .from("cards")
    .insert([
      {
        board_id: board!.id,
        lane_id: left.id,
        external_id: numbers[2],
        title: "Bulk two",
        rank: 1,
      },
      {
        board_id: board!.id,
        lane_id: left.id,
        external_id: numbers[0],
        title: "Bulk zero",
        rank: 2,
      },
      {
        board_id: board!.id,
        lane_id: left.id,
        external_id: numbers[3],
        title: "Bulk three",
        rank: 3,
      },
      {
        board_id: board!.id,
        lane_id: right.id,
        external_id: numbers[1],
        title: "Bulk one",
        rank: 5,
      },
    ])
    .select("id");
  expect(insertError).toBeNull();
  createdCardIds = (inserted ?? []).map((card) => card.id);
  await page.reload();

  await leftColumn
    .getByRole("button", { name: new RegExp(`Manage Bulk left ${suffix}`) })
    .click();
  await page.getByRole("menuitem", { name: "Move all cards right" }).click();
  await expect(
    page.getByText(new RegExp(`moved to Bulk right ${suffix}`)),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Move all cards", exact: true })
    .click();
  await expect(rightColumn.locator("[data-id]")).toHaveCount(4);

  await rightColumn
    .getByRole("button", { name: new RegExp(`Manage Bulk right ${suffix}`) })
    .click();
  await page.getByRole("menuitem", { name: "Order ascending" }).click();
  await expect(
    page.getByText(/replaces the lane’s current manual order/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Order ascending", exact: true })
    .click();
  await expect
    .poll(() =>
      rightColumn
        .locator("[data-id]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-id")),
        ),
    )
    .toEqual(numbers);

  await rightColumn
    .getByRole("button", { name: new RegExp(`Manage Bulk right ${suffix}`) })
    .click();
  await page.getByRole("menuitem", { name: "Move all cards left" }).click();
  await page
    .getByRole("button", { name: "Move all cards", exact: true })
    .click();
  await expect(leftColumn.locator("[data-id]")).toHaveCount(4);

  await page.reload();
  await expect(leftColumn.locator("[data-id]")).toHaveCount(4);
  await expect(leftColumn).toHaveClass(/lane-color--blue/);
});

test("a lane can be dragged across two positions", async ({ page }) => {
  const { data: board } = await admin
    .from("boards")
    .select("id")
    .eq("slug", "backlog")
    .single();
  const { data: seeded } = await admin
    .from("lanes")
    .select("id, key")
    .eq("board_id", board!.id)
    .order("position");
  const seededOrder = (seeded ?? []).map((l) => l.id);
  expect(seededOrder.length).toBeGreaterThan(2);

  // The board is shared seed data and this test reorders it for real, so the
  // restore has to survive a failure: a half-done reorder would leave every
  // later spec asserting the wrong lane order.
  try {
    await dragOneLaneTwoPositions(page);
  } finally {
    // Let any reorder the page still has in flight land first, or it would
    // overwrite the restore a moment after it.
    await page.waitForLoadState("networkidle").catch(() => {});
    const { error } = await admin.rpc("reorder_lanes", {
      p_board_id: board!.id,
      p_ordered_ids: seededOrder,
    });
    expect(error).toBeNull();
  }
});

async function dragOneLaneTwoPositions(page: import("@playwright/test").Page) {
  const order = async () =>
    page
      .locator("[data-lane]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-lane")));
  const before = await order();
  expect(before.length).toBeGreaterThan(3);

  const handle = page.locator(
    `[data-lane="${before[0]}"] [data-testid="lane-drag-handle"]`,
  );
  const target = page.locator(`[data-lane="${before[2]}"] .lane-head`);
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Two moves: the first clears the 6px activation constraint, the second is
  // the actual travel. A single jump can land before dnd-kit arms its sensor.
  await page.mouse.move(from.x + 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 20,
  });
  await page.mouse.up();

  await expect.poll(async () => (await order())[0]).not.toBe(before[0]);

  await page.reload();
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  const after = await order();
  expect(after.length).toBe(before.length);
  // Two positions, not one short: the lane lands where it was dropped.
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[2]);
  expect(after[2]).toBe(before[0]);
  // The grip is the ONLY thing that listens. Press one of the header's other
  // buttons and travel far enough to arm the 6px sensor, the way a shaky hand
  // on the add-card button would: if the listeners ever migrate onto
  // .lane-head or onto the <section>, this drags the lane and the order moves.
  const head = page.locator(`[data-lane="${after[1]}"]`);
  const addCard = head.getByRole("button", { name: /^Add card to / });
  const far = page.locator(`[data-lane="${after[3]}"] .lane-head`);
  const addBox = (await addCard.boundingBox())!;
  const farBox = (await far.boundingBox())!;
  await page.mouse.move(
    addBox.x + addBox.width / 2,
    addBox.y + addBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(addBox.x + 20, addBox.y + addBox.height / 2, {
    steps: 5,
  });
  await page.mouse.move(
    farBox.x + farBox.width / 2,
    farBox.y + farBox.height / 2,
    {
      steps: 20,
    },
  );
  await page.mouse.up();
  expect(await order()).toEqual(after);
  // That press-and-travel may or may not have opened the dialog; either way,
  // leave nothing behind.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // And the buttons are still buttons: onClick reaches them.
  await addCard.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await head.getByRole("button", { name: /^Manage / }).click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await order()).toEqual(after);
}

test("a done lane can be renamed, and its key does not change", async ({
  page,
}) => {
  const { data: board } = await admin
    .from("boards")
    .select("id")
    .eq("slug", "backlog")
    .single();
  const { data: done } = await admin
    .from("lanes")
    .select("id, name")
    .eq("board_id", board!.id)
    .eq("kind", "done")
    .single();
  const originalName = done!.name;

  try {
    await page.goto(BOARD);
    const lane = page.locator('[data-lane="done"]');
    await lane.getByRole("button", { name: /^Manage / }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const input = page.getByLabel("Lane name");
    await expect(input).toBeEditable();
    await input.fill("Zenbox");
    await page.getByRole("button", { name: /save|rename/i }).click();

    await expect(lane.locator(".lane-name")).toHaveText("Zenbox");
    await page.reload();
    // The key is the identity: the selector still finds it.
    await expect(page.locator('[data-lane="done"] .lane-name')).toHaveText(
      "Zenbox",
    );
  } finally {
    // Restore the shared board's lane name and verify it actually landed —
    // a stray in-flight write here would leave every later spec asserting
    // against "Zenbox" instead of the seeded name.
    await page.waitForLoadState("networkidle").catch(() => {});
    const { error } = await admin
      .from("lanes")
      .update({ name: originalName })
      .eq("id", done!.id);
    expect(error).toBeNull();
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("lanes")
          .select("name")
          .eq("id", done!.id)
          .single();
        return data?.name;
      })
      .toBe(originalName);
  }
});

test("protected lanes offer no Remove, ordinary lanes do", async ({ page }) => {
  await page.goto(BOARD);
  // The archive lane is hidden unless the Archived filter is on.
  await page.getByLabel("archived").check();
  for (const key of ["unsorted", "done", "archive"]) {
    await page
      .locator(`[data-lane="${key}"]`)
      .getByRole("button", { name: /^Manage / })
      .click();
    // Prove the menu actually opened before trusting an absence inside it —
    // every lane can be renamed, so "Edit" is always there to check against.
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Remove" })).toHaveCount(0);
    await page.getByRole("menu").press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    // The closing menu's exit-animation overlay can still intercept a click
    // on the very next lane's Manage button for a moment after the menu
    // itself is gone from the accessibility tree. Wait on the overlay
    // element directly rather than a flat sleep.
    await expect(page.locator('[data-base-ui-inert=""]')).toHaveCount(0);
  }
  await page
    .locator('[data-lane="now"]')
    .getByRole("button", { name: /^Manage / })
    .click();
  await expect(page.getByRole("menuitem", { name: "Remove" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("the archive lane has a manage menu at all", async ({ page }) => {
  await page.goto(BOARD);
  await page.getByLabel("archived").check();
  await expect(
    page.locator('[data-lane="archive"]').getByRole("button", {
      name: /^Manage /,
    }),
  ).toBeVisible();
});

test("a pinned lane leads the board and holds the left edge while it scrolls", async ({
  page,
}) => {
  const order = async () =>
    page
      .locator("[data-lane]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-lane")));

  const before = await order();
  expect(before.length).toBeGreaterThan(3);
  // Pin a lane that is NOT already first: sticky alone would never bring one
  // in from the right, so leading the board is the half being proven here.
  const target = before[2] as string;

  const pin = async (key: string, label: "Pin lane" | "Unpin lane") => {
    await page
      .locator(`[data-lane="${key}"]`)
      .getByRole("button", { name: /^Manage / })
      .click();
    await expect(page.getByRole("menuitem", { name: label })).toBeVisible();
    await page.getByRole("menuitem", { name: label }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  };

  try {
    await pin(target, "Pin lane");

    // It leads the board...
    await expect.poll(async () => (await order())[0]).toBe(target);
    const pinned = page.locator(`[data-lane="${target}"]`);
    await expect(pinned).toHaveAttribute("data-pinned", "true");

    // ...and it is still there after the board scrolls right.
    const scroller = page.locator('main[aria-label="Priority lanes"]');
    const leftBefore = (await pinned.boundingBox())!.x;
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect
      .poll(async () => Math.round((await pinned.boundingBox())!.x))
      .toBe(Math.round(leftBefore));

    // The shared order is untouched: everyone else still sees what they saw.
    const shared = await order();
    expect(shared.filter((k) => k !== target)).toEqual(
      before.filter((k) => k !== target),
    );

    // A pin is this browser's, so it survives a reload.
    await page.reload();
    await expect(page.locator("[data-lane]").first()).toHaveAttribute(
      "data-lane",
      target,
    );
  } finally {
    await pin(target, "Unpin lane");
    await expect.poll(async () => await order()).toEqual(before);
  }
});

test("a pinned lane cannot be dragged, and the others still can", async ({
  page,
}) => {
  const order = async () =>
    page
      .locator("[data-lane]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-lane")));
  const before = await order();
  const target = before[2] as string;

  // Every lane on the board, in the order the team sees — including the
  // archive lane the filter hides, which is why this comes from the database
  // rather than the DOM.
  const boardId = (
    await admin.from("boards").select("id").eq("slug", "backlog").single()
  ).data!.id;
  const sharedOrder = (
    await admin
      .from("lanes")
      .select("id")
      .eq("board_id", boardId)
      .order("position")
  ).data!.map((l) => l.id);

  const menu = async (key: string, label: string) => {
    await page
      .locator(`[data-lane="${key}"]`)
      .getByRole("button", { name: /^Manage / })
      .click();
    await page.getByRole("menuitem", { name: label }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  };

  try {
    await menu(target, "Pin lane");
    await expect.poll(async () => (await order())[0]).toBe(target);

    // No grip: the one control that can start a lane drag is gone while the
    // lane's position is a personal view rather than the board's.
    await expect(
      page.locator(`[data-lane="${target}"] [data-testid="lane-drag-handle"]`),
    ).toHaveCount(0);

    // An unpinned lane still drags, and the pinned one stays put in front.
    const current = await order();
    const grip = page.locator(
      `[data-lane="${current[1]}"] [data-testid="lane-drag-handle"]`,
    );
    const dest = page.locator(`[data-lane="${current[3]}"] .lane-head`);
    const from = (await grip.boundingBox())!;
    const to = (await dest.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 20,
    });
    await page.mouse.up();

    await expect.poll(async () => (await order())[1]).not.toBe(current[1]);
    expect((await order())[0]).toBe(target);
  } finally {
    await menu(target, "Unpin lane");
    await page.waitForLoadState("networkidle").catch(() => {});
    // Restore from the snapshot taken before the drag, not from the DOM:
    // the board hides the archive lane, so a DOM reading is missing a lane
    // and reorder_lanes rightly refuses a partial order.
    const { error } = await admin.rpc("reorder_lanes", {
      p_board_id: boardId,
      p_ordered_ids: sharedOrder,
    });
    expect(error).toBeNull();
  }
});
