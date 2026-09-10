import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CardTemplateEditor } from "@/app/(app)/p/[project]/card-template-editor";
import { GatesEditor } from "@/app/(app)/p/[project]/gates-editor";
import { ProjectSection } from "@/app/(app)/p/[project]/project-section";
import { TaxonomyEditor } from "@/app/(app)/p/[project]/taxonomy-editor";
import { BoardBreadcrumbs } from "@/components/board-breadcrumbs";
import { currentAccess } from "@/lib/access-server";
import { loadBoardManage } from "@/lib/board-manage-data";
import { cardTemplate } from "@/lib/card-template";
import { resolveBoardGates } from "@/lib/gates";
import { currentMember } from "@/lib/supabase/server";
import { markHue } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configuration" };

/** `{n} concept` / `{n} concepts` for the letterhead stats. */
function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Board-level vocabulary: this board's concepts and gates, without the rest
 * of the project folder. People and the forgotten-work window stay on the
 * project page.
 */
export default async function BoardManagePage(
  props: PageProps<"/p/[project]/b/[board]/manage">,
) {
  const { project: projectSlug, board: boardSlug } = await props.params;
  const member = await currentMember();
  if (!member) redirect("/login?error=member");

  const data = await loadBoardManage(projectSlug, boardSlug);
  const access = await currentAccess(data.project.id);
  if (!access) notFound();

  const groups = [...data.groups]
    .sort((a, b) => a.position - b.position)
    .map((group, i) => ({
      ...group,
      hue: markHue(i),
      tags: [...(group.tags ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }));
  const gates = resolveBoardGates(
    (data.board.settings ?? {}) as Record<string, unknown>,
    data.lanes,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <BoardBreadcrumbs
        project={data.project}
        board={data.board}
        page="Configuration"
      />

      <header className="letterhead">
        <div className="min-w-0">
          <h1>Configuration</h1>
          <p className="folder-blurb">
            Concepts and gates for {data.board.name}. People, boards, and the
            forgotten-work window stay on the project.
          </p>
        </div>
        <div className="letterhead-aside">
          <span className="folder-stamp" aria-hidden="true">
            {plural(groups.length, "concept", "concepts")}
            <br />
            {plural(gates.length, "gate", "gates")}
          </span>
        </div>
      </header>

      <ProjectSection id="concepts-heading" title="concepts">
        <TaxonomyEditor
          boardId={data.board.id}
          boardName={data.board.name}
          groups={groups}
        />
      </ProjectSection>

      <ProjectSection id="card-template-heading" title="card template">
        <CardTemplateEditor
          boardId={data.board.id}
          projectSlug={data.project.slug}
          boardSlug={data.board.slug}
          initial={cardTemplate(
            (data.board.settings ?? {}) as Record<string, unknown>,
          )}
          canEdit={access.canManage}
        />
      </ProjectSection>

      <ProjectSection id="gates-heading" title="gates">
        <GatesEditor
          boardId={data.board.id}
          boardSlug={data.board.slug}
          projectSlug={data.project.slug}
          boardName={data.board.name}
          showBoardName={false}
          lanes={data.lanes.map((lane) => ({ id: lane.id, name: lane.name }))}
          initialGates={gates}
          canEdit={access.canManage}
        />
      </ProjectSection>
    </main>
  );
}
