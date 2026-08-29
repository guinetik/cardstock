import { expect, test } from "@playwright/test";
import {
  admin,
  attachToProject,
  createMember,
  dropMember,
  OWNER,
  signIn,
  signInAs,
} from "./support/sign-in";

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
    await page.locator("#board-name").fill("Product backlog");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${PROJECT_SLUG}/b/product-backlog`);
    await expect(page.getByText("Unsorted", { exact: true })).toBeVisible();

    await page.goto(`/p/${PROJECT_SLUG}`);
    await page.getByRole("button", { name: "New board" }).click();
    await page.locator("#board-name").fill("Planning");
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
    await page.getByLabel("Name").fill("Project Invite");
    await page
      .getByLabel("Project", { exact: true })
      .selectOption({ label: "Demo" });
    await page.getByRole("combobox", { name: "Role" }).selectOption("member");
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
    await expect(page.getByRole("list", { name: "People" })).toContainText(
      OWNER.split("@")[0] ?? OWNER,
    );

    await page.locator("#invite-email").fill(PROJECT_INVITED);
    await page.locator("#invite-name").fill("Folder Invite");
    await page.getByRole("combobox", { name: "Role" }).selectOption("member");
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

const ADMIN_PROJECT_SLUG = "e2e-admin-caps";
const PROJECT_ADMIN = "e2e-project-admin@example.test";
const PROJECT_MEMBER = "e2e-project-member@example.test";
const ADMIN_INVITED = "e2e-admin-invited@example.test";
const PASSWORD = "correct horse battery";

test("a project admin can create a board and invite a member, but not open /users", async ({
  page,
}) => {
  await dropMember(PROJECT_ADMIN);
  await dropMember(ADMIN_INVITED);
  await admin.from("projects").delete().eq("slug", ADMIN_PROJECT_SLUG);
  try {
    await createMember(PROJECT_ADMIN, PASSWORD);
    await signIn(page);
    await page.goto("/");
    await page.getByRole("button", { name: "New project" }).click();
    await page.getByLabel("Name").fill("E2E admin caps");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(`/p/${ADMIN_PROJECT_SLUG}`);
    await attachToProject(PROJECT_ADMIN, ADMIN_PROJECT_SLUG, "admin");

    await page.context().clearCookies();
    await signInAs(page, PROJECT_ADMIN, PASSWORD);
    await page.goto(`/p/${ADMIN_PROJECT_SLUG}`);
    await page.getByRole("button", { name: "New board" }).click();
    await page.locator("#board-name").fill("Admin board");
    await page.getByRole("button", { name: "Create board" }).click();
    await page.waitForURL(`/p/${ADMIN_PROJECT_SLUG}/b/admin-board`);

    await page.goto(`/p/${ADMIN_PROJECT_SLUG}`);
    await expect(
      page.locator('#invite-role option[value="admin"]'),
    ).toHaveCount(0);
    await page.getByLabel("Email").fill(ADMIN_INVITED);
    await page.locator("#invite-name").fill("Admin Invited");
    await page.getByRole("button", { name: "Invite user" }).click();
    await expect(page.getByRole("status")).toContainText("can now onboard");

    await page.goto("/users");
    await expect(page).not.toHaveURL(/\/users/);
  } finally {
    await admin.from("projects").delete().eq("slug", ADMIN_PROJECT_SLUG);
    await dropMember(PROJECT_ADMIN);
    await dropMember(ADMIN_INVITED);
  }
});

test("a project member can use the board but cannot create, invite, or export", async ({
  page,
}) => {
  await dropMember(PROJECT_MEMBER);
  try {
    await createMember(PROJECT_MEMBER, PASSWORD);
    await attachToProject(PROJECT_MEMBER, "demo", "member");
    await signInAs(page, PROJECT_MEMBER, PASSWORD);
    await page.goto("/p/demo");
    await expect(page.getByRole("button", { name: "New board" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Invite user" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: /Export .* as CSV/ }),
    ).toHaveCount(0);

    const csv = await page.request.get("/p/demo/b/backlog/export");
    expect(csv.status()).toBe(403);

    await page.goto("/p/demo/b/backlog");
    await expect(page.locator("[data-lane]").first()).toBeVisible();
  } finally {
    await dropMember(PROJECT_MEMBER);
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
