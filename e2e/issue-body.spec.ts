import { expect, test } from "@playwright/test";
import { signIn } from "./support/sign-in";

const ISSUE = "/p/demo/b/backlog/c/1";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto(ISSUE);
  await expect(page.getByTestId("issue-body")).toBeVisible();
});

test("editing the body survives reload", async ({ page }) => {
  const marker = `Ask edited in e2e ${Date.now()}`;
  await page.getByTestId("edit-issue-body").click();
  const editable = page
    .getByTestId("issue-body-editor")
    .locator("[contenteditable='true']");
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type(`## Ask\n\n${marker}`);
  await page.getByTestId("save-issue-body").click();
  await expect(page.getByTestId("issue-body")).toContainText(marker);
  await page.reload();
  await expect(page.getByTestId("issue-body")).toContainText(marker);
});

test("posting a comment survives reload", async ({ page }) => {
  const marker = `comment ${Date.now()}`;
  await page.getByTestId("comment-composer").fill(marker);
  await page.getByTestId("post-comment").click();
  await expect(page.getByTestId("comment-thread")).toContainText(marker);
  await page.reload();
  await expect(page.getByTestId("comment-thread")).toContainText(marker);
});

test("saving the body keeps existing comments", async ({ page }) => {
  const comment = `keep me ${Date.now()}`;
  await page.getByTestId("comment-composer").fill(comment);
  await page.getByTestId("post-comment").click();
  await expect(page.getByTestId("comment-thread")).toContainText(comment);

  await page.getByTestId("edit-issue-body").click();
  const editable = page
    .getByTestId("issue-body-editor")
    .locator("[contenteditable='true']");
  await expect(editable).toBeVisible({ timeout: 15_000 });
  await editable.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.type("## Ask\n\nBody after comment.");
  await page.getByTestId("save-issue-body").click();
  await expect(page.getByTestId("comment-thread")).toContainText(comment);
});
