"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "@/components/activity-link";
import {
  BOARD_VIEWS,
  boardBase,
  boardViewHref,
  boardViewSegment,
} from "@/lib/board-views";

/**
 * The board's views, kept in the topbar so they survive the trip into one of
 * them. Every board page used to carry its own copy of this list; the copy that
 * persists across navigation is the one that can show you where you are.
 */
export function BoardViewsNav() {
  const { project, board } = useParams();
  const pathname = usePathname();
  if (typeof project !== "string" || typeof board !== "string") return null;

  const base = boardBase(project, board);
  const active = boardViewSegment(pathname, base);

  return (
    <nav
      aria-label="Board views"
      className="hidden items-center gap-4 text-[12.5px] md:flex"
    >
      {BOARD_VIEWS.map((view) => {
        const current = view.segment === active;
        return (
          <Link
            key={view.segment}
            href={boardViewHref(base, view.segment)}
            aria-current={current ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 pb-0.5 ${
              current
                ? "border-[var(--color-ink)] font-medium text-[var(--color-ink)]"
                : "paper-link border-transparent"
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
