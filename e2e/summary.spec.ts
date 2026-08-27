import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./support/sign-in";

/**
 * The summary is seeded from markdown but editable in the app. Once a person
 * edits it, an import must not replace their words with the frontmatter's.
 */
test("a summary edited in the app survives the next import", async ({
  page,
}) => {
  await signIn(page);

  const typed = `edited in the app ${Date.now()}`;
  await page.goto("/p/demo/b/backlog/c/1");
  const box = page.locator("#summary");
  await box.fill(typed);
  await box.blur();
  // The save is a server action fired on blur; wait for it to land.
  await page.waitForTimeout(1500);

  // Clear source_hash so the importer actually reprocesses this card — that is
  // what an agent editing the file looks like. Without this the hash-skip makes
  // the test vacuous: the overwrite is never attempted.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: board } = await admin
    .from("boards")
    .select("id, projects!inner(slug)")
    .eq("slug", "backlog")
    .eq("projects.slug", "demo")
    .single();
  const { error: hashError } = await admin
    .from("cards")
    .update({ source_hash: "forced-reimport" })
    .eq("board_id", board!.id)
    .eq("external_id", "1");
  expect(hashError).toBeNull();

  // Re-import the same markdown, whose frontmatter carries a different summary.
  const r = spawnSync(
    process.platform === "win32" ? "bun.exe" : "bun",
    [
      "run",
      "etl/import.ts",
      "--project",
      "demo",
      "--board",
      "backlog",
      "--source",
      "examples/tracker",
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("1 updated");

  await page.reload();
  await expect(page.locator("#summary")).toHaveValue(typed);
});
