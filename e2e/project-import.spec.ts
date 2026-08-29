import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { zipSync } from "fflate";
import { admin, signIn } from "./support/sign-in";

const SLUG = "e2e-imported";

test("an owner imports a zip as a new project", async ({ page }) => {
  await admin.from("projects").delete().eq("slug", SLUG);
  try {
    const entries: Record<string, Uint8Array> = {};
    for (const f of readdirSync("examples/tracker").filter((n) =>
      /^\d+\.md$/.test(n),
    ))
      entries[`tracker/${f}`] = new TextEncoder().encode(
        readFileSync(`examples/tracker/${f}`, "utf8"),
      );
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Import project" }).click();
    await page.getByLabel("Name").fill("E2E imported");
    await page.getByLabel("First board").fill("Backlog");
    await page.getByLabel("Zip of sheets").setInputFiles({
      name: "t.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zipSync(entries)),
    });
    await expect(page.getByTestId("plan-counts")).toContainText("13 new");
    await page
      .getByRole("button", { name: "Create project and import 13 cards" })
      .click();
    await page.waitForURL(`/p/${SLUG}/b/backlog`);
    await expect(page.getByText("Needs Input", { exact: true })).toBeVisible();
  } finally {
    await admin.from("projects").delete().eq("slug", SLUG);
  }
});
