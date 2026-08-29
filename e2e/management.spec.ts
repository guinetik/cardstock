import { expect, test } from "@playwright/test";
import { admin, dropMember, OWNER, signIn } from "./support/sign-in";

const PROJECT_SLUG = "e2e-multi-project";
const INVITED = "e2e-project-invite@example.test";
const PROJECT_INVITED = "e2e-project-page-invite@example.test";

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

test("the project page lists members and invites someone without sending email", async ({
  page,
}) => {
  await dropMember(PROJECT_INVITED);
  try {
    await signIn(page);
    await page.goto("/p/demo");
    await expect(page.getByRole("heading", { name: "people" })).toBeVisible();
    await expect(
      page.getByText(OWNER.split("@")[0] ?? OWNER, { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Email").fill(PROJECT_INVITED);
    await page.getByLabel("Display name").fill("Folder Invite");
    await page.getByLabel("Role", { exact: true }).selectOption("member");
    await page.getByRole("button", { name: "Invite user" }).click();
    await expect(page.getByRole("status")).toContainText("can now onboard");
    await expect(
      page.getByText("Folder Invite", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: `Remove ${PROJECT_INVITED} from Demo` })
      .click();
    await expect(page.getByText("Folder Invite", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await dropMember(PROJECT_INVITED);
  }
});

test("the project page is a letterhead and four section folders", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo");
  await expect(
    page.getByRole("heading", { name: "Demo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "boards", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "people", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "concepts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Take this project home" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Danger zone" }),
  ).toBeVisible();
});
