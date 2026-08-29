import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { zipSync } from "fflate";
import { signIn } from "./support/sign-in";

function trackerZip(edit?: (name: string, text: string) => string) {
  const entries: Record<string, Uint8Array> = {};
  for (const f of readdirSync("examples/tracker").filter((n) =>
    /^\d+\.md$/.test(n),
  )) {
    let text = readFileSync(`examples/tracker/${f}`, "utf8");
    if (edit) text = edit(f, text);
    entries[`tracker/${f}`] = new TextEncoder().encode(text);
  }
  return Buffer.from(zipSync(entries));
}

test("dropping the tracker on the demo board shows a plan, and a re-import is all unchanged", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import into Product backlog" })
    .click();
  await page.getByLabel("Zip of sheets").setInputFiles({
    name: "tracker.zip",
    mimeType: "application/zip",
    buffer: trackerZip(),
  });
  await expect(
    page.getByRole("heading", { name: "Importing into Product backlog" }),
  ).toBeVisible();
  await expect(page.getByTestId("plan-counts")).toContainText("13 unchanged");
  await expect(
    page.getByRole("button", { name: /^Import 0 cards$/ }),
  ).toBeDisabled();
});

test("a changed sheet shows as changed, imports, and the board reflects it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import into Product backlog" })
    .click();
  await page.getByLabel("Zip of sheets").setInputFiles({
    name: "tracker.zip",
    mimeType: "application/zip",
    buffer: trackerZip((name, text) =>
      name === "5.md"
        ? text.replace(/^title: .*$/m, 'title: "Should trials require a card?"')
        : text,
    ),
  });
  const row = page.getByTestId("plan-row-5");
  await expect(row).toContainText("changed");
  await expect(row).toContainText("title");
  await page.getByRole("button", { name: "Import 1 card" }).click();
  await expect(page.getByTestId("import-done")).toContainText("1 changed");
  await page.goto("/p/demo/b/backlog");
  await expect(page.getByText("Should trials require a card?")).toBeVisible();
});
