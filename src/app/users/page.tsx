import Link from "next/link";
import { redirect } from "next/navigation";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";
import { memberLabel } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import { removeMembership } from "./actions";
import { InviteUserForm } from "./invite-user-form";

type Membership = {
  member_id: string;
  project_id: string;
  role: string;
  projects: { slug: string; name: string } | null;
};

export default async function UsersPage() {
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  if (me.role !== "owner") redirect("/");
  const db = await supabaseServer();
  const [{ data: members }, { data: projects }, { data: memberships }] =
    await Promise.all([
      db.from("members").select("id, email, display_name, role").order("email"),
      db.from("projects").select("id, slug, name").order("name"),
      db
        .from("project_members")
        .select("member_id, project_id, role, projects(slug, name)"),
    ]);
  const rows = (memberships ?? []) as unknown as Membership[];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <header>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Projects
        </Link>
        <h1 className="text-[27px] leading-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage who may sign in and which projects they can access.
        </p>
      </header>

      <InviteUserForm projects={projects ?? []} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          People
        </h2>
        <ul className="space-y-3">
          {(members ?? []).map((member) => {
            const memberProjects = rows.filter(
              (row) => row.member_id === member.id,
            );
            return (
              <li key={member.id} className="paper-lane p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Portrait email={member.email} size={36} />
                    <div>
                      <span className="font-medium">
                        {memberLabel(member.display_name)}
                      </span>
                      <span className="ml-2 font-mono text-sm text-muted-foreground">
                        {member.email}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {member.role}
                  </span>
                </div>
                {memberProjects.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {memberProjects.map((membership) => (
                      <li
                        key={membership.project_id}
                        className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-sm"
                      >
                        <Link
                          href={`/p/${membership.projects?.slug ?? ""}`}
                          className="hover:underline"
                        >
                          {membership.projects?.name ?? "Project"}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {membership.role}
                        </span>
                        {member.id !== me.id && (
                          <form action={removeMembership}>
                            <input
                              type="hidden"
                              name="projectId"
                              value={membership.project_id}
                            />
                            <input
                              type="hidden"
                              name="memberId"
                              value={member.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="xs"
                              aria-label={`Remove ${member.email} from ${membership.projects?.name ?? "project"}`}
                            >
                              Remove
                            </Button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Allowlisted, but not assigned to a project.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
