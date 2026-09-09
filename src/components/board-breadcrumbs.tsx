import {
  Book,
  CalendarDays,
  ChartNoAxesGantt,
  Columns3,
  Flag,
  Folder,
  Settings,
} from "lucide-react";
import Link from "next/link";

const PAGE_ICONS = {
  "Epic Cockpit": Book,
  Calendar: CalendarDays,
  Timeline: ChartNoAxesGantt,
  Priorities: Flag,
  Configuration: Settings,
} as const;

const iconClass = "mt-[2px] size-[13px] shrink-0 text-[var(--color-grey)]";

/** The folder, the board, and the page: each name points to that exact place. */
export function BoardBreadcrumbs({
  project,
  board,
  page,
}: {
  project: { slug: string; name: string };
  board: { slug: string; name: string };
  page?: keyof typeof PAGE_ICONS;
}) {
  const PageIcon = page ? PAGE_ICONS[page] : null;
  const boardLabel = (
    <>
      <Columns3 aria-hidden="true" className={iconClass} />
      <span className="min-w-0 break-words">{board.name}</span>
    </>
  );
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 font-mono text-[11px] leading-relaxed text-[var(--color-grey)]"
    >
      <ol className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <li className="min-w-0 break-words">
          <Link
            className="inline-flex min-w-0 items-start gap-1.5 hover:text-[var(--color-ink)] hover:underline"
            href={`/p/${project.slug}`}
          >
            <Folder aria-hidden="true" className={iconClass} />
            <span className="min-w-0 break-words">{project.name}</span>
          </Link>
        </li>
        <li className="flex min-w-0 items-baseline gap-2">
          <span aria-hidden="true" className="text-[var(--color-grey-faint)]">
            /
          </span>
          {page ? (
            <Link
              className="inline-flex min-w-0 items-start gap-1.5 hover:text-[var(--color-ink)] hover:underline"
              href={`/p/${project.slug}/b/${board.slug}`}
            >
              {boardLabel}
            </Link>
          ) : (
            <span
              aria-current="page"
              className="inline-flex min-w-0 items-start gap-1.5 text-[var(--color-ink)]"
            >
              {boardLabel}
            </span>
          )}
        </li>
        {PageIcon && (
          <li className="flex min-w-0 items-baseline gap-2">
            <span aria-hidden="true" className="text-[var(--color-grey-faint)]">
              /
            </span>
            <span
              aria-current="page"
              className="inline-flex min-w-0 items-start gap-1.5 text-[var(--color-ink)]"
            >
              <PageIcon aria-hidden="true" className={iconClass} />
              <span className="min-w-0 break-words">{page}</span>
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}
