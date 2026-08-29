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
    .getByRole("navigation")
    .getByRole("button", { name: "Add lane" })
    .click();
  await page.getByLabel("Lane name").fill(name);
  if (color)
    await page
      .getByLabel("New lane color")
      .getByRole("button", { name: color })
      .click();
  await page.getByRole("button", { name: "Add lane", exact: true }).click();
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
