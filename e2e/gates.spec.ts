import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

test("gates rename the milestone on the timeline without looking like Planned + Built", async ({
  page,
}) => {
  const { data: board } = await admin
    .from("boards")
    .select("id, settings, project_id")
    .eq("slug", "backlog")
    .single();
  const previous = (board?.settings as Record<string, unknown> | null) ?? {};

  const { data: card } = await admin
    .from("cards")
    .select("id, status, lane_id, target_date, target_label")
    .eq("external_id", "7")
    .eq("board_id", board!.id)
    .single();
  const previousCard = card!;

  try {
    await admin
      .from("cards")
      .update({ target_date: "2026-12-31", target_label: null })
      .eq("id", previousCard.id);

    await signIn(page);
    await page.goto("/p/demo");
    await expect(page.getByRole("heading", { name: "gates" })).toBeVisible();
    await expect(page.getByLabel("Name for Built")).toHaveValue("Built");
    await expect(page.getByLabel("Name for Shipped")).toHaveValue("Shipped");

    const builtRow = page
      .locator("li")
      .filter({ has: page.getByLabel("Name for Built") });
    await builtRow.getByRole("checkbox", { name: "Now" }).check();
    await builtRow.getByLabel("Name for Built").fill("Awaiting delivery");
    await page.getByRole("button", { name: "Save gates" }).click();
    await expect(page.getByText("Gates saved.")).toBeVisible();

    await page.goto("/p/demo/b/backlog/timeline");
    const row = page.locator('[data-timeline-id="7"]');
    await expect(row.getByText("Awaiting delivery")).toBeVisible();
    await expect(row.getByText(/Planned · Target/)).toBeVisible();
    await expect(row.getByText("Planned", { exact: true })).toHaveCount(0);
    await expect(row.locator(".stat")).toHaveCount(0);
  } finally {
    if (board?.id)
      await admin
        .from("boards")
        .update({ settings: previous })
        .eq("id", board.id);
    if (previousCard?.id)
      await admin
        .from("cards")
        .update({
          target_date: previousCard.target_date,
          target_label: previousCard.target_label,
        })
        .eq("id", previousCard.id);
  }
});
