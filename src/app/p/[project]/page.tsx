import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import { AddMemberForm } from "./add-member-form";
import { TaxonomyEditor, type TaxonomyGroup } from "./taxonomy-editor";

export default async function ProjectPage(props: PageProps<"/p/[project]">) {
  const { project: slug } = await props.params;
  const member = await currentMember();
  if (!member) redirect("/login?error=member");
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("id, slug, name, description, boards(id, slug, name)")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) notFound();
  const { data: members } = await db
    .from("project_members")
    .select("role, members(email, display_name)")
    .eq("project_id", project.id);
  // Tag groups belong to a board. A project holds one today, so the editor
  // below edits that one; a project with several would need a picker.
  const board = (project.boards ?? [])[0] as
    | { id: string; slug: string; name: string }
    | undefined;
  const { data: groups } = board
    ? await db
        .from("tag_groups")
        .select("id, key, name, position, tags(id, key, name)")
        .eq("board_id", board.id)
        .order("position")
    : { data: null };
  const taxonomy = ((groups ?? []) as TaxonomyGroup[]).map((g) => ({
    ...g,
    tags: [...(g.tags ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  }));
  return (
    <main className="mx-auto w-full max-w-4xl p-6 space-y-8">
      <header>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Projects
        </Link>
        <h1 className="text-[27px] leading-tight">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </header>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Boards
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(project.boards ?? []).map((b) => (
            <li key={b.slug} className="paper-card p-4">
              <Link
                href={`/p/${project.slug}/b/${b.slug}`}
                className="font-semibold hover:underline"
              >
                {b.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members
        </h2>
        <div className="paper-lane p-4">
          <ul className="mb-4 space-y-1 text-sm">
            {(members ?? []).map((m) => {
              const mm = m.members as unknown as {
                email: string;
                display_name: string | null;
              } | null;
              return (
                <li
                  key={
                    (m.members as unknown as { email: string } | null)?.email ??
                    m.role
                  }
                >
                  <span className="font-medium">
                    {mm?.display_name ?? mm?.email}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {mm?.email} · {m.role}
                  </span>
                </li>
              );
            })}
          </ul>
          <AddMemberForm projectId={project.id} />
        </div>
      </section>
      {board && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tags
          </h2>
          <TaxonomyEditor
            boardId={board.id}
            boardName={board.name}
            groups={taxonomy}
          />
        </section>
      )}
    </main>
  );
}
