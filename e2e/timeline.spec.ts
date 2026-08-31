import { expect, test } from "@playwright/test";
import { admin, signIn } from "./support/sign-in";

test("the raised-date rail highlights forgotten work and uses the project window", async ({
  page,
}) => {
  const { data: before } = await admin
    .from("projects")
    .select("id, settings")
    .eq("slug", "demo")
    .single();
  const previous = (before?.settings as Record<string, unknown> | null) ?? {};

  try {
    await signIn(page);
    await page.goto("/p/demo");
    await page.getByLabel("Days").fill("21");
    await page.getByRole("button", { name: "Save window" }).click();
    await expect(
      page.getByText(/flag unplanned work after 21 days/i),
    ).toBeVisible();

    await page.goto("/p/demo/b/backlog/timeline");
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    await expect(page.getByText("21-day project window")).toBeVisible();
    await expect(page.getByLabel("Cards by date raised")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Relative to today" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Built" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shipped" })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Built" })
        .getByRole("link", { name: /#7 Password reset email lands in spam/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Needs attention" }),
    ).toBeVisible();
    await expect(
      page.getByText("Forgotten", { exact: true }).first(),
    ).toBeVisible();

    const filters = page.getByRole("group", { name: "Timeline filters" });
    await filters.getByLabel("Epic").selectOption({ label: "Onboarding" });
    await filters.getByLabel("Find").fill("Password reset email lands in spam");
    await expect(page.locator('[data-timeline-id="7"]')).toBeVisible();
    await expect(page.getByText(/1 of \d+ raised/)).toBeVisible();

    await filters.getByLabel("Raised from").fill("2026-08-10");
    await expect(
      page.getByText("No raised work matches these filters."),
    ).toBeVisible();
    await filters.getByLabel("Raised from").fill("2026-08-09");
    await expect(page.locator('[data-timeline-id="7"]')).toBeVisible();
  } finally {
    if (before?.id)
      await admin
        .from("projects")
        .update({ settings: previous })
        .eq("id", before.id);
  }
});
