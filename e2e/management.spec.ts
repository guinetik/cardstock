import { expect, test } from "@playwright/test";
import { admin, dropMember, signIn } from "./support/sign-in";

const PROJECT_SLUG = "e2e-multi-project";
const INVITED = "e2e-project-invite@example.test";

test("an owner can create a project and more than one board", async ({
  page,
}) => {
  await admin.from("projects").delete().eq("slug", PROJECT_SLUG);
  try {
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Name").fill("E2E multi project");
    await page
      .getByLabel("Description")
      .fill("A project created by the management flow.");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(`/p/${PROJECT_SLUG}`);

    await page.getByRole("button", { name: "New board" }).click();
    await page.getByLabel("Name").fill("Product backlog");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${PROJECT_SLUG}/b/product-backlog`);
    await expect(page.getByText("Unsorted", { exact: true })).toBeVisible();

    await page.goto(`/p/${PROJECT_SLUG}`);
    await page.getByRole("button", { name: "New board" }).click();
    await page.getByLabel("Name").fill("Planning");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${PROJECT_SLUG}/b/planning`);
    await expect(page.getByText("Now", { exact: true })).toBeVisible();
  } finally {
    await admin.from("projects").delete().eq("slug", PROJECT_SLUG);
  }
});

test("the users page invites someone to a project without sending email", async ({
  page,
}) => {
  await dropMember(INVITED);
  try {
    await signIn(page);
    await page.goto("/users");
    await page.getByLabel("Email").fill(INVITED);
    await page.getByLabel("Display name").fill("Project Invite");
    await page
      .getByLabel("Project", { exact: true })
      .selectOption({ label: "Demo" });
    await page.getByLabel("Role", { exact: true }).selectOption("member");
    await page.getByRole("button", { name: "Invite user" }).click();
    await expect(page.getByRole("status")).toContainText("can now onboard");
    await expect(
      page.getByText("Project Invite", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: `Remove ${INVITED} from Demo` })
      .click();
    await expect(
      page.getByText("Allowlisted, but not assigned to a project."),
    ).toBeVisible();
  } finally {
    await dropMember(INVITED);
  }
});
