import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoardBreadcrumbs } from "@/components/board-breadcrumbs";
import { PrioritiesView } from "@/components/priorities/priorities-view";
import { loadProjectPriorities } from "@/lib/priorities-data";
import { currentMember } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Priorities" };

/** One board's slice of the project's priority ordering. */
export default async function BoardPrioritiesPage(
  props: PageProps<"/p/[project]/b/[board]/priorities">,
) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadProjectPriorities(project, board);
  return (
    <main className="mx-auto w-full max-w-[var(--page-max)] px-4 pt-5 pb-16 sm:px-6">
      <BoardBreadcrumbs
        project={data.project}
        board={data.boards.find((item) => item.slug === board)!}
        page="Priorities"
      />
      <PrioritiesView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={board}
        boards={data.boards}
        selectedBoards={null}
        cards={data.cards}
        path={`/p/${project}/b/${board}/priorities`}
      />
    </main>
  );
}
