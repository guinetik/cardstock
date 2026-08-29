import { describe, expect, test } from "bun:test";
import {
  canInviteRole,
  canManageProject,
  canRemoveRole,
  isSiteOwner,
} from "./access";

const owner = { siteRole: "owner", projectRole: null };
const ownerOnProject = { siteRole: "owner", projectRole: "admin" };
const projectAdmin = { siteRole: "member", projectRole: "admin" };
const projectMember = { siteRole: "member", projectRole: "member" };
const allowlistedStranger = { siteRole: "member", projectRole: null };

describe("isSiteOwner", () => {
  test("is true only for the site owner role", () => {
    expect(isSiteOwner("owner")).toBe(true);
    expect(isSiteOwner("member")).toBe(false);
    expect(isSiteOwner("admin")).toBe(false);
  });
});

describe("canManageProject", () => {
  test("the site owner can manage any project, even without a membership row", () => {
    expect(canManageProject(owner)).toBe(true);
    expect(canManageProject(ownerOnProject)).toBe(true);
  });

  test("a project admin can manage that project", () => {
    expect(canManageProject(projectAdmin)).toBe(true);
  });

  test("a project member cannot", () => {
    expect(canManageProject(projectMember)).toBe(false);
  });

  test("an allowlisted person with no project role cannot", () => {
    expect(canManageProject(allowlistedStranger)).toBe(false);
  });
});

describe("canInviteRole", () => {
  test("the owner may invite a project admin or a member", () => {
    expect(canInviteRole(owner, "admin")).toBe(true);
    expect(canInviteRole(owner, "member")).toBe(true);
    expect(canInviteRole(ownerOnProject, "admin")).toBe(true);
  });

  test("a project admin may invite a member, not another admin", () => {
    expect(canInviteRole(projectAdmin, "member")).toBe(true);
    expect(canInviteRole(projectAdmin, "admin")).toBe(false);
  });

  test("a project member cannot invite anyone", () => {
    expect(canInviteRole(projectMember, "member")).toBe(false);
    expect(canInviteRole(projectMember, "admin")).toBe(false);
  });
});

describe("canRemoveRole", () => {
  test("nobody can remove themselves", () => {
    expect(
      canRemoveRole(ownerOnProject, {
        siteRole: "owner",
        projectRole: "admin",
        isSelf: true,
      }),
    ).toBe(false);
    expect(
      canRemoveRole(projectAdmin, {
        siteRole: "member",
        projectRole: "admin",
        isSelf: true,
      }),
    ).toBe(false);
  });

  test("the owner can remove a project admin or a member", () => {
    expect(
      canRemoveRole(owner, {
        siteRole: "member",
        projectRole: "admin",
        isSelf: false,
      }),
    ).toBe(true);
    expect(
      canRemoveRole(owner, {
        siteRole: "member",
        projectRole: "member",
        isSelf: false,
      }),
    ).toBe(true);
  });

  test("a project admin can remove a member, not another admin, not the owner", () => {
    expect(
      canRemoveRole(projectAdmin, {
        siteRole: "member",
        projectRole: "member",
        isSelf: false,
      }),
    ).toBe(true);
    expect(
      canRemoveRole(projectAdmin, {
        siteRole: "member",
        projectRole: "admin",
        isSelf: false,
      }),
    ).toBe(false);
    expect(
      canRemoveRole(projectAdmin, {
        siteRole: "owner",
        projectRole: "admin",
        isSelf: false,
      }),
    ).toBe(false);
  });

  test("a project member cannot remove anyone", () => {
    expect(
      canRemoveRole(projectMember, {
        siteRole: "member",
        projectRole: "member",
        isSelf: false,
      }),
    ).toBe(false);
  });
});
