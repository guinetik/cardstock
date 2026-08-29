import Link from "next/link";

/**
 * A project drawn as a dossier: a manila folder whose tab is the project's
 * name, with its boards inside as binders. A binder opens its board; the
 * cockpit link on it is where you take stock.
 */

export interface BinderBoard {
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
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function Binder({ project }: { project: BinderProject }) {
  const boards = project.boards;
  const cards = boards.reduce((n, b) => n + b.cards, 0);
  const href = `/p/${project.slug}`;
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
                <div className="binder-foot">
                  <span className="binder-count">
                    {plural(b.cards, "card", "cards")}
                  </span>
                  <Link
                    href={`${href}/b/${b.slug}/cockpit`}
                    className="binder-cockpit paper-link"
                    aria-label={`${b.name} cockpit`}
                  >
                    Take stock
                  </Link>
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
