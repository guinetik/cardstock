import { canManageProject } from "@/lib/access";
import { apiJson } from "@/lib/api/errors";
import { withTokenNoBoard } from "@/lib/api/route";

/** Every project and board the token holder can reach. */
export const GET = withTokenNoBoard(async ({ member, db }) => {
  const { data: memberships } = await db
    .from("project_members")
    .select("project_id, role")
    .eq("member_id", member.id);
  const roleByProject = new Map(
    (memberships ?? []).map((row) => [
      row.project_id as string,
      row.role as string,
    ]),
  );
  const query = db
    .from("projects")
    .select("id, slug, name, boards(slug, name)")
    .order("name");
  const { data: projects } =
    member.role === "owner"
      ? await query
      : await query.in("id", [...roleByProject.keys()]);

  return apiJson({
    projects: (projects ?? []).map((project) => {
      const projectRole = roleByProject.get(project.id as string) ?? null;
      return {
        slug: project.slug,
        name: project.name,
        role: projectRole,
        canManage: canManageProject({ siteRole: member.role, projectRole }),
        boards: (project.boards ?? []) as { slug: string; name: string }[],
      };
    }),
  });
});
