import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
      <Link
        href={`/p/${project}/b/${board}`}
        className="mb-4 inline-block text-xs text-muted-foreground hover:underline"
      >
        ← Board
      </Link>
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
