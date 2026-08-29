import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import { markHue } from "@/lib/types";
import { CreateBoardDialog } from "./create-board-dialog";
import { TaxonomyEditor, type TaxonomyGroup } from "./taxonomy-editor";

/** The shapes the nested select comes back in. */
interface LaneRow {
  id: string;
  name: string;
  kind: "inbox" | "work" | "waiting" | "built" | "done" | "archive";
  position: number;
}
interface CardRow {
  lane_id: string | null;
  archived_at: string | null;
  source_path: string | null;
}
interface BoardRow {
  id: string;
  slug: string;
  name: string;
  lanes: LaneRow[] | null;
  cards: CardRow[] | null;
}
interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  boards: BoardRow[] | null;
}

/** The pen a lane's tally is written in: the same rule the board draws under its tab. */
const KIND_STAT: Record<LaneRow["kind"], string> = {
  inbox: "stat--muted",
  work: "stat--ink",
  waiting: "stat--wip",
  built: "stat--info",
  done: "stat--success",
  archive: "stat--faint",
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function ProjectPage(props: PageProps<"/p/[project]">) {
  const { project: slug } = await props.params;
  const member = await currentMember();
  if (!member) redirect("/login?error=member");
  const db = await supabaseServer();
  const { data } = await db
    .from("projects")
    .select(
      "id, slug, name, description, boards(id, slug, name, lanes(id, name, kind, position), cards(lane_id, archived_at, source_path))",
    )
    .eq("slug", slug)
    .maybeSingle();
  const project = data as ProjectRow | null;
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

  const allCards = boards.flatMap((b) => b.cards ?? []);
  const cardCount = allCards.length;
  const onFile = allCards.filter((c) => c.source_path).length;
  const href = `/p/${project.slug}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href="/"
        className="eyebrow mb-4 inline-block hover:text-[var(--color-ink)]"
      >
        ← Projects
      </Link>

      {/* The folder, opened. */}
      <div
        className={`folder folder--open${boards.length ? "" : " folder--empty"}`}
      >
        <span className="folder-tab">
          <h1>{project.name}</h1>
        </span>
        <div className="folder-body">
          <div className="min-w-0">
            {project.description ? (
              <p className="folder-blurb">{project.description}</p>
            ) : (
              <p className="folder-blurb text-[var(--color-grey-faint)]">
                No description.
              </p>
            )}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <span className="stat stat--flat stat--ink">
                {plural(boards.length, "board", "boards")}
              </span>
              <span className="stat stat--flat">
                {plural(cardCount, "card", "cards")}
              </span>
              {onFile > 0 && (
                <span className="stat stat--flat stat--faint">
                  {onFile} from .md files
                </span>
              )}
            </p>
          </div>
          {boards.length > 0 ? (
            <ul className="binders" aria-label="Boards">
              {boards.map((board) => {
                const lanes = [...(board.lanes ?? [])].sort(
                  (a, b) => a.position - b.position,
                );
                const cards = board.cards ?? [];
                const live = cards.filter((c) => !c.archived_at);
                const archived = cards.length - live.length;
                const byLane = new Map<string, number>();
                for (const c of live) {
                  if (c.lane_id)
                    byLane.set(c.lane_id, (byLane.get(c.lane_id) ?? 0) + 1);
                }
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
                    <p className="binder-tally">
                      {lanes
                        .filter((l) => l.kind !== "archive")
                        .map((l) => (
                          <span
                            key={l.id}
                            className={`stat ${KIND_STAT[l.kind]}`}
                          >
                            {l.name}{" "}
                            <b className="font-medium">
                              {byLane.get(l.id) ?? 0}
                            </b>
                          </span>
                        ))}
                      {archived > 0 && (
                        <span className="stat stat--faint">
                          archived <b className="font-medium">{archived}</b>
                        </span>
                      )}
                      {cards.length === 0 && (
                        <span className="stat stat--flat stat--faint">
                          no cards yet
                        </span>
                      )}
                    </p>
                    <div className="binder-foot">
                      <span className="binder-count">
                        {plural(cards.length, "card", "cards")}
                      </span>
                      <span className="binder-links">
                        <Link
                          href={`${boardHref}/cockpit`}
                          className="binder-cockpit paper-link"
                          aria-label={`${board.name} cockpit`}
                        >
                          Take stock
                        </Link>
                        <a
                          href={`${boardHref}/export`}
                          className="binder-cockpit paper-link"
                          aria-label={`Export ${board.name} as CSV`}
                        >
                          Export CSV
                        </a>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="binders-empty">
              No boards yet. A new board starts with Unsorted, Now, Next, Done
              and Archive lanes; work lanes can be renamed or added on the board
              itself.
            </p>
          )}
          <div className="folder-aside">
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
            <CreateBoardDialog
              projectId={project.id}
              projectSlug={project.slug}
            />
          </div>
        </div>
      </div>

      {boards.length > 0 && (
        <section className="mt-12" aria-labelledby="concepts-heading">
          <div className="section-head">
            <h2 id="concepts-heading">Concepts</h2>
            <span className="count">
              how each board sorts its cards, and the tags that follow
            </span>
          </div>
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
                    <h3 className="mb-2 text-[15px] font-semibold uppercase tracking-[0.06em]">
                      {board.name}
                    </h3>
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
        </section>
      )}

      {/* Take the whole folder home. Not wired up yet. */}
      <section className="cta mt-14" aria-labelledby="download-heading">
        <div className="min-w-0">
          <h2 id="download-heading" className="cta-title">
            Take this project home
          </h2>
          <p className="cta-body">
            Every card as a markdown file, one per sheet, with the board
            decisions written into its frontmatter. Nothing here is locked in.
          </p>
        </div>
        <button
          type="button"
          className="cta-button"
          aria-disabled="true"
          title="Not available yet"
        >
          Download .zip
        </button>
        <span className="cta-note">Coming soon</span>
      </section>

      <section className="danger mt-6" aria-labelledby="danger-heading">
        <div className="min-w-0">
          <h2 id="danger-heading" className="cta-title">
            Danger zone
          </h2>
          <p className="cta-body">
            Deleting a project removes its boards, lanes and every card in them.
            The markdown files you have exported are not touched.
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
    </main>
  );
}
