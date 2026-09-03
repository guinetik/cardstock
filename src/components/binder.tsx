import { Download, Gauge, Settings } from "lucide-react";
import Link from "next/link";
import { BoardImportDialog } from "@/components/board-import-dialog";
import { SheetContract } from "@/components/sheet-contract";

/**
 * A project drawn as a dossier: a manila folder whose tab is the project's
 * name, with its boards inside as binders. A binder opens its board; manage
 * is concepts and gates; the cockpit link opens Epic Cockpit.
 */

export interface BinderBoard {
  id: string;
  slug: string;
  name: string;
  /** Cards on the board, archived ones included. */
  cards: number;
}

export interface BinderProject {
  slug: string;
  name: string;
  description: string | null;
  boards: BinderBoard[];
  /** Owner or project admin — controls the download/import tools on the foot. */
  canManage: boolean;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function Binder({ project }: { project: BinderProject }) {
  const boards = project.boards;
  const cards = boards.reduce((n, b) => n + b.cards, 0);
  const href = `/p/${project.slug}`;
  // Rendered once per project (a server component), not per board: the
  // schema it reads off stays out of the client bundle either way.
  const contract = <SheetContract />;
  return (
    <li className={`folder${boards.length ? "" : " folder--empty"}`}>
      <Link href={href} className="folder-tab">
        <span>{project.name}</span>
      </Link>
      <div className="folder-body">
        {project.description ? (
          <p className="folder-blurb">{project.description}</p>
        ) : (
          <p className="folder-blurb text-[var(--color-grey-faint)]">
            No description.
          </p>
        )}
        {boards.length > 0 ? (
          <ul className="binders" aria-label={`Boards in ${project.name}`}>
            {boards.map((b) => (
              <li key={b.slug} className="binder">
                <span className="binder-rivets" aria-hidden="true" />
                <h2 className="binder-name">
                  <Link href={`${href}/b/${b.slug}`} className="binder-open">
                    {b.name}
                  </Link>
                </h2>
                <p className="binder-count">
                  {plural(b.cards, "card", "cards")}
                </p>
                <div className="binder-foot binder-foot--tools binder-foot--stacked">
                  <span className="binder-io">
                    <Link
                      href={`${href}/b/${b.slug}/manage`}
                      className="binder-tool"
                      aria-label={`Manage ${b.name}`}
                      title={`Manage ${b.name}`}
                    >
                      <Settings size={14} aria-hidden="true" />
                    </Link>
                  </span>
                  <span className="binder-io">
                    {project.canManage && (
                      <>
                        <a
                          href={`${href}/b/${b.slug}/export.zip`}
                          className="binder-tool"
                          aria-label={`Download ${b.name} as sheets`}
                          title={`Download ${b.name} as sheets`}
                          download
                        >
                          <Download size={14} aria-hidden="true" />
                        </a>
                        <BoardImportDialog
                          boardId={b.id}
                          boardName={b.name}
                          contract={contract}
                        />
                      </>
                    )}
                    <Link
                      href={`${href}/b/${b.slug}/cockpit`}
                      className="binder-tool binder-tool--pen"
                      aria-label={`${b.name} Epic Cockpit`}
                      title={`Epic Cockpit for ${b.name}`}
                    >
                      <Gauge size={14} aria-hidden="true" />
                      Epic Cockpit
                    </Link>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="binders-empty">
            No boards yet — open the project to add one.
          </p>
        )}
        <div className="folder-aside">
          {cards > 0 ? (
            <span className="folder-stamp" aria-hidden="true">
              {plural(cards, "card", "cards")}
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
          <Link href={href} className="folder-go paper-link">
            Open project →
          </Link>
        </div>
      </div>
    </li>
  );
}
