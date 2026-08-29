import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import { CreateBoardDialog } from "./create-board-dialog";
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
  const boards = [...(project.boards ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const boardIds = boards.map((board) => board.id);
  const { data: groups } = boardIds.length
    ? await db
        .from("tag_groups")
        .select("id, board_id, key, name, position, tags(id, key, name)")
        .in("board_id", boardIds)
        .order("position")
    : { data: null };
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
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Boards
          </h2>
          <CreateBoardDialog
            projectId={project.id}
            projectSlug={project.slug}
          />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.map((b) => (
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
        {!boards.length && (
          <p className="paper-lane p-4 text-sm text-muted-foreground">
            This project has no boards yet.
          </p>
        )}
      </section>
      {boards.map((board) => {
        const taxonomy = (
          (groups ?? []) as Array<TaxonomyGroup & { board_id: string }>
        )
          .filter((group) => group.board_id === board.id)
          .map(({ board_id: _boardId, ...group }) => ({
            ...group,
            tags: [...(group.tags ?? [])].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          }));
        return (
          <section key={board.id}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {board.name} tags
            </h2>
            <TaxonomyEditor
              boardId={board.id}
              boardName={board.name}
              groups={taxonomy}
            />
          </section>
        );
      })}
    </main>
  );
}
