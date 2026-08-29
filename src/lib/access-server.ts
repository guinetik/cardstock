import {
  type Actor,
  canManageProject,
  type ProjectRole,
  type SiteRole,
} from "./access";
import { currentMember, supabaseServer } from "./supabase/server";

export type ProjectAccess = {
  member: NonNullable<Awaited<ReturnType<typeof currentMember>>>;
  actor: Actor;
  siteRole: SiteRole | string;
  projectRole: ProjectRole | null;
  canManage: boolean;
};

/** The signed-in member plus their role on this project. Null if not signed in. */
export async function currentAccess(
  projectId: string,
): Promise<ProjectAccess | null> {
  const member = await currentMember();
  if (!member) return null;
  const db = await supabaseServer();
  const { data } = await db
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("member_id", member.id)
    .maybeSingle();
  const projectRole = (data?.role ?? null) as ProjectRole | null;
  const actor: Actor = { siteRole: member.role, projectRole };
  return {
    member,
    actor,
    siteRole: member.role,
    projectRole,
    canManage: canManageProject(actor),
  };
}
