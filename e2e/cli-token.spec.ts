import { expect, test } from "@playwright/test";
import { admin, OWNER, signIn } from "./support/sign-in";

test("a member mints a CLI token, sees it once, and revokes it", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/profile");

  const name = `e2e-${Date.now()}`;
  const section = page.getByRole("region", { name: "cli tokens" });
  await section.getByLabel("Name").fill(name);
  await section.getByRole("button", { name: "Mint token" }).click();

  const shown = page.locator("output code");
  await expect(shown).toBeVisible();
  const plaintext = (await shown.textContent()) ?? "";
  expect(plaintext).toMatch(/^cst_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}$/);

  const { data: rows } = await admin
    .from("cli_tokens")
    .select("id, token_hash, member_id, members(email)")
    .eq("name", name);
  expect(rows).toHaveLength(1);
  const secret = plaintext.slice(plaintext.lastIndexOf("_") + 1);
  expect(secret.length).toBeGreaterThan(8);
  expect(JSON.stringify(rows)).not.toContain(secret);

  await page.reload();
  await expect(page.getByText(plaintext)).toHaveCount(0);
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Revoke ${name}` }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toHaveCount(0);

  await admin.from("cli_tokens").delete().eq("name", name);
  expect(OWNER).toBeTruthy();
});
