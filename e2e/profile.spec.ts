import { expect, test } from "@playwright/test";
import { admin, OWNER, signIn } from "./support/sign-in";

test("a member can open their profile, rename themselves, and see their folders", async ({
  page,
}) => {
  const { data: before } = await admin
    .from("members")
    .select("display_name")
    .eq("email", OWNER)
    .single();
  const previous = before?.display_name ?? null;
  try {
    await signIn(page);
    await page.goto("/");
    await expect(async () => {
      await page.getByRole("button", { name: "Account menu" }).click();
      await expect(page.getByRole("menuitem", { name: "Profile" })).toBeVisible(
        { timeout: 1000 },
      );
    }).toPass({ timeout: 15_000 });
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await page.waitForURL("/profile");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".portrait--lg")).toHaveAttribute(
      "src",
      /gravatar\.com\/avatar\//,
    );
    await expect(
      page.getByRole("button", { name: "Change portrait" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My cardstock" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Demo" })).toBeVisible();

    const name = `Profile ${Date.now()}`;
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("status")).toContainText("Name saved");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  } finally {
    await admin
      .from("members")
      .update({ display_name: previous })
      .eq("email", OWNER);
  }
});
