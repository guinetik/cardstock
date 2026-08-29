import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { resetDemoBoard } from "./support/reset";
import { signIn } from "./support/sign-in";

// This spec compares a download with the file on disk, so it needs the demo
// board exactly as the tracker states it — whatever ran before it.
test.beforeAll(() => {
  resetDemoBoard();
});

test("the project export zips every board into its own folder", async ({
  page,
}) => {
  await signIn(page);
  const res = await page.request.get("/p/demo/export.zip");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("application/zip");
  const files = unzipSync(new Uint8Array(await res.body()));
  expect(new TextDecoder().decode(files["backlog/5.md"])).toBe(
    readFileSync("examples/tracker/5.md", "utf8"),
  );
});

test("the settings section links to the project export for a manager", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo");
  const link = page.getByRole("link", { name: "Download .zip" });
  await expect(link).toHaveAttribute("href", "/p/demo/export.zip");
});
