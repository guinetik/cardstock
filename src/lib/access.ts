/**
 * Who may do what on a project.
 *
 * Site role lives on `members.role` (`owner` | `member`). Project role lives
 * on `project_members.role` (`admin` | `member`). The owner is a global
 * project-admin even when they have no membership row.
 */

export type SiteRole = "owner" | "member";
export type ProjectRole = "admin" | "member";

export type Actor = {
  siteRole: string;
  projectRole: string | null;
};

export type RemovalTarget = {
  siteRole: string;
  projectRole: string;
  isSelf: boolean;
};

export function isSiteOwner(role: string): boolean {
  return role === "owner";
}

/** Create/import/export boards, invite and remove (within invite rules). */
export function canManageProject(actor: Actor): boolean {
  return isSiteOwner(actor.siteRole) || actor.projectRole === "admin";
}

export function canInviteRole(actor: Actor, invited: ProjectRole): boolean {
  if (isSiteOwner(actor.siteRole)) return true;
  if (actor.projectRole === "admin") return invited === "member";
  return false;
}

export function canRemoveRole(actor: Actor, target: RemovalTarget): boolean {
  if (target.isSelf) return false;
  if (isSiteOwner(target.siteRole)) return false;
  if (isSiteOwner(actor.siteRole)) return true;
  if (actor.projectRole === "admin") return target.projectRole === "member";
  return false;
}
