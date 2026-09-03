import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LaneMap } from "@/components/lane-map";
import { canManageProject, isSiteOwner } from "@/lib/access";
import { resolveBoardGates } from "@/lib/gates";
import { laneMicrocosm } from "@/lib/lane-map";
import { oneRelated } from "@/lib/related";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import { forgottenAfterDays } from "@/lib/timeline";
import { markHue } from "@/lib/types";
import { CreateBoardDialog } from "./create-board-dialog";
import { GatesEditor } from "./gates-editor";
import { ProjectPeople, type ProjectPerson } from "./project-people";
import { ProjectSection } from "./project-section";
import { TaxonomyEditor, type TaxonomyGroup } from "./taxonomy-editor";
import { TimelineSettings } from "./timeline-settings";

/** The shapes the nested select comes back in. */
interface LaneRow {
  id: string;
  name: string;
  kind: "inbox" | "work" | "waiting" | "built" | "done" | "archive";
  position: number;
  color: string | null;
}
interface CardRow {
  lane_id: string | null;
  archived_at: string | null;
  source_path: string | null;
  color: string | null;
  rank: number;
  status: string | null;
  needs: string | null;
  target_date: string | null;
}
interface BoardRow {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown> | null;
  lanes: LaneRow[] | null;
  cards: CardRow[] | null;
}
interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown> | null;
  boards: BoardRow[] | null;
}
interface MemberEmbed {
  id: string;
  email: string;
  display_name: string | null;
}
interface MembershipRow {
  member_id: string;
  role: string;
  members: MemberEmbed | MemberEmbed[] | null;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export async function generateMetadata(
  props: PageProps<"/p/[project]">,
): Promise<Metadata> {
  const { project: slug } = await props.params;
  const db = await supabaseServer();
  const { data: project } = await db
    .from("projects")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  return { title: project?.name ?? "Project" };
}

export default async function ProjectPage(props: PageProps<"/p/[project]">) {
  const { project: slug } = await props.params;
  const member = await currentMember();
  if (!member) redirect("/login?error=member");
  const db = await supabaseServer();
  const { data } = await db
    .from("projects")
    .select(
      "id, slug, name, description, settings, boards(id, slug, name, settings, lanes(id, name, kind, position, color), cards(lane_id, archived_at, source_path, color, rank, status, needs, target_date))",
    )
    .eq("slug", slug)
    .maybeSingle();
  const project = data as ProjectRow | null;
  if (!project) notFound();
  const boards = [...(project.boards ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const boardIds = boards.map((board) => board.id);
  const [{ data: groups }, { data: memberships }] = await Promise.all([
    boardIds.length
      ? db
          .from("tag_groups")
          .select("id, board_id, key, name, position, tags(id, key, name)")
          .in("board_id", boardIds)
          .order("position")
      : Promise.resolve({ data: null }),
    db
      .from("project_members")
      .select("member_id, role, members(id, email, display_name)")
      .eq("project_id", project.id),
  ]);
  const people: ProjectPerson[] = (
    (memberships ?? []) as unknown as MembershipRow[]
  )
    .map((row) => {
      const related = oneRelated(row.members);
      if (!related) return null;
      return {
        memberId: related.id,
        email: related.email,
        displayName: related.display_name,
        role: row.role,
      };
    })
    .filter((row): row is ProjectPerson => row !== null)
    .sort((a, b) =>
      (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email),
    );
  const mine = people.find((person) => person.memberId === member.id);
  const canManage = canManageProject({
    siteRole: member.role,
    projectRole: mine?.role ?? null,
  });
  const owner = isSiteOwner(member.role);

  const allCards = boards.flatMap((b) => b.cards ?? []);
  const cardCount = allCards.length;
  const href = `/p/${project.slug}`;
  const timelineWatchDays = forgottenAfterDays(project.settings);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href="/"
        className="eyebrow mb-4 inline-block hover:text-[var(--color-ink)]"
      >
        ← Projects
      </Link>

      <header className="letterhead">
        <div className="min-w-0">
          <h1>{project.name}</h1>
          {project.description ? (
            <p className="folder-blurb">{project.description}</p>
          ) : (
            <p className="folder-blurb text-[var(--color-grey-faint)]">
              No description.
            </p>
          )}
          <nav
            className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]"
            aria-label="Project views"
          >
            <Link className="paper-link" href={`${href}/calendar`}>
              Calendar
            </Link>
          </nav>
        </div>
        <div className="letterhead-aside">
          {cardCount > 0 ? (
            <span className="folder-stamp" aria-hidden="true">
              {plural(cardCount, "card", "cards")}
              <br />
              filed
            </span>
          ) : (
            <span
              className="folder-stamp folder-stamp--faint"
              aria-hidden="true"
            >
              nothing
              <br />
              filed
            </span>
          )}
        </div>
      </header>

      <ProjectSection
        id="boards-heading"
        title="boards"
        count={String(boards.length)}
        empty={boards.length === 0}
        aside={
          canManage ? (
            <CreateBoardDialog
              projectId={project.id}
              projectSlug={project.slug}
            />
          ) : undefined
        }
      >
        {boards.length > 0 ? (
          <ul className="binders" aria-label="Boards">
            {boards.map((board) => {
              const lanes = [...(board.lanes ?? [])].sort(
                (a, b) => a.position - b.position,
              );
              const cards = board.cards ?? [];
              const boardHref = `${href}/b/${board.slug}`;
              return (
                <li key={board.id} className="binder binder--wide">
                  <span className="binder-rivets" aria-hidden="true" />
                  <h2 className="binder-name">
                    <Link href={boardHref} className="binder-open">
                      {board.name}
                    </Link>
                    <code className="graph-key ml-2">{board.slug}</code>
                  </h2>
                  {cards.length === 0 ? (
                    <p className="binder-vacant">no cards yet</p>
                  ) : (
                    <LaneMap
                      href={boardHref}
                      rows={laneMicrocosm(lanes, cards)}
                    />
                  )}
                  <div className="binder-foot">
                    <span className="binder-count">
                      {plural(cards.length, "card", "cards")}
                    </span>
                    <span className="binder-links">
                      <Link
                        href={boardHref}
                        className="binder-cockpit paper-link"
                        aria-label={`Go to ${board.name}`}
                      >
                        Go to Board
                      </Link>
                      <Link
                        href={`${boardHref}/cockpit`}
                        className="binder-cockpit paper-link"
                        aria-label={`${board.name} Epic Cockpit`}
                      >
                        Epic Cockpit
                      </Link>
                      <Link
                        href={`${boardHref}/manage`}
                        className="binder-cockpit paper-link"
                        aria-label={`Manage ${board.name}`}
                      >
                        Manage
                      </Link>
                      {canManage && (
                        <a
                          href={`${boardHref}/export`}
                          className="binder-cockpit paper-link"
                          aria-label={`Export ${board.name} as CSV`}
                        >
                          Export CSV
                        </a>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="binders-empty">
            No boards yet. A new board starts with Unsorted, Now, Next, Done and
            Archive lanes; work lanes can be renamed or added on the board
            itself.
          </p>
        )}
      </ProjectSection>

      <ProjectSection
        id="people-heading"
        title="people"
        count={String(people.length)}
      >
        <ProjectPeople
          projectId={project.id}
          projectName={project.name}
          people={people}
          currentMemberId={member.id}
          canInvite={canManage}
          allowAdminRole={owner}
        />
      </ProjectSection>

      {boards.length > 0 && (
        <ProjectSection id="concepts-heading" title="concepts">
          <div className="space-y-8">
            {boards.map((board) => {
              const taxonomy = (
                (groups ?? []) as Array<TaxonomyGroup & { board_id: string }>
              )
                .filter((group) => group.board_id === board.id)
                .map(({ board_id: _boardId, ...group }, i) => ({
                  ...group,
                  hue: markHue(i),
                  tags: [...(group.tags ?? [])].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
                }));
              return (
                <div key={board.id}>
                  {boards.length > 1 && (
                    <p className="graph-board">{board.name}</p>
                  )}
                  <TaxonomyEditor
                    boardId={board.id}
                    boardName={board.name}
                    groups={taxonomy}
                  />
                </div>
              );
            })}
          </div>
        </ProjectSection>
      )}

      <ProjectSection id="gates-heading" title="gates">
        <div className="space-y-8">
          {boards.map((board) => (
            <GatesEditor
              key={board.id}
              boardId={board.id}
              boardSlug={board.slug}
              projectSlug={project.slug}
              boardName={board.name}
              showBoardName={boards.length > 1}
              lanes={[...(board.lanes ?? [])]
                .sort((a, b) => a.position - b.position)
                .map((l) => ({ id: l.id, name: l.name }))}
              initialGates={resolveBoardGates(
                (board.settings ?? {}) as Record<string, unknown>,
                board.lanes ?? [],
              )}
              canEdit={canManage}
            />
          ))}
        </div>
      </ProjectSection>

      <ProjectSection id="settings-heading" title="settings">
        {canManage ? (
          <TimelineSettings
            projectId={project.id}
            projectSlug={project.slug}
            initialDays={timelineWatchDays}
          />
        ) : (
          <section className="cta" aria-labelledby="timeline-settings-heading">
            <div className="min-w-0">
              <h2 id="timeline-settings-heading" className="cta-title">
                Forgotten work window
              </h2>
              <p className="cta-body">
                The timeline highlights unplanned work after {timelineWatchDays}
                days. An owner or project admin can change this setting.
              </p>
            </div>
            <span className="cta-note">Project setting</span>
          </section>
        )}
        <section className="cta" aria-labelledby="download-heading">
          <div className="min-w-0">
            <h2 id="download-heading" className="cta-title">
              Take this project home
            </h2>
            <p className="cta-body">
              Every card as a markdown file, one per sheet, with the board
              decisions written into its frontmatter. Nothing here is locked in.
            </p>
          </div>
          {canManage ? (
            <a href={`${href}/export.zip`} className="cta-button" download>
              Download .zip
            </a>
          ) : (
            <button type="button" className="cta-button" aria-disabled="true">
              Download .zip
            </button>
          )}
          <span className="cta-note">
            {canManage
              ? `One folder per board · ${plural(cardCount, "sheet", "sheets")}`
              : "Owners and project admins"}
          </span>
        </section>
        <section className="danger" aria-labelledby="danger-heading">
          <div className="min-w-0">
            <h2 id="danger-heading" className="cta-title">
              Danger zone
            </h2>
            <p className="cta-body">
              Deleting a project removes its boards, lanes and every card in
              them. The markdown files you have exported are not touched.
            </p>
          </div>
          <button
            type="button"
            className="cta-button cta-button--danger"
            aria-disabled="true"
            title="Not available yet"
          >
            Delete this project
          </button>
          <span className="cta-note">Owners only · coming soon</span>
        </section>
      </ProjectSection>
    </main>
  );
}
