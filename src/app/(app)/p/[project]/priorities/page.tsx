import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PrioritiesView } from "@/components/priorities/priorities-view";
import { calendarBoards } from "@/lib/calendar";
import { loadProjectPriorities } from "@/lib/priorities-data";
import { currentMember } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Priorities" };

/** Project-wide priority planning across all boards; board chips filter. */
export default async function ProjectPrioritiesPage(
  props: PageProps<"/p/[project]/priorities">,
) {
  const { project } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadProjectPriorities(project);
  const search = await props.searchParams;
  const selected = calendarBoards(
    search.boards,
    data.boards.map((board) => board.slug),
  );
  return (
    <main className="mx-auto w-full max-w-[var(--page-max)] px-4 pt-5 pb-16 sm:px-6">
      <Link
        href={`/p/${project}`}
        className="mb-4 inline-block text-xs text-muted-foreground hover:underline"
      >
        ← {data.project.name}
      </Link>
      <PrioritiesView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={null}
        boards={data.boards}
        selectedBoards={selected}
        cards={data.cards}
        path={`/p/${project}/priorities`}
      />
    </main>
  );
}
