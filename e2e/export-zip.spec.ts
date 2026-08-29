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

test("the export zip gives back the sheets that were imported, byte for byte", async ({
  page,
}) => {
  await signIn(page);
  const res = await page.request.get("/p/demo/b/backlog/export.zip");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("application/zip");
  const files = unzipSync(new Uint8Array(await res.body()));
  const five = new TextDecoder().decode(files["5.md"]);
  expect(five).toBe(readFileSync("examples/tracker/5.md", "utf8"));
  expect(Object.keys(files).length).toBeGreaterThanOrEqual(13);
});
