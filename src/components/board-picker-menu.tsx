"use client";

import { Check, ChevronDown } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import Link from "@/components/activity-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BOARD_VIEWS,
  boardBase,
  boardViewHref,
  boardViewSegment,
} from "@/lib/board-views";
import styles from "./board-picker.module.css";

export interface PickerProject {
  id: string;
  slug: string;
  name: string;
  boards: { id: string; slug: string; name: string }[];
}

/** The shared layout persists during navigation; read the active board on the client. */
export function BoardPickerMenu({
  projects,
  failed = false,
}: {
  projects: PickerProject[];
  failed?: boolean;
}) {
  const params = useParams();
  const pathname = usePathname();
  const current = projects
    .find((project) => project.slug === params.project)
    ?.boards.find((board) => board.slug === params.board);
  const boardCount = projects.reduce(
    (count, project) => count + project.boards.length,
    0,
  );
  // Switching boards is a change of subject, not of task: land on the same view
  // of the new board. Only sound from a board, since that is the only place a
  // view is on screen to keep.
  const view =
    typeof params.project === "string" && typeof params.board === "string"
      ? boardViewSegment(pathname, boardBase(params.project, params.board))
      : "";
  const viewLabel = BOARD_VIEWS.find((v) => v.segment === view)?.label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Switch board" className={styles.trigger}>
        <span className="min-w-0 flex-1 truncate text-left">
          {current?.name ?? "Boards"}
        </span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={styles.menu} sideOffset={7}>
        <div className={styles.masthead} aria-hidden="true">
          <span>Board index</span>
          {!failed &&
            (view ? (
              /* Say where the switch lands, since it is not the board page. */
              <span>keeps {viewLabel}</span>
            ) : (
              <span>
                {boardCount} {boardCount === 1 ? "board" : "boards"}
              </span>
            ))}
        </div>
        {failed ? (
          <DropdownMenuItem disabled className={styles.item}>
            Could not load boards. Reload to try again.
          </DropdownMenuItem>
        ) : projects.length === 0 ? (
          <DropdownMenuItem disabled className={styles.item}>
            No boards available
          </DropdownMenuItem>
        ) : (
          projects.map((project) => (
            <DropdownMenuGroup key={project.id} className={styles.project}>
              <DropdownMenuLabel className={styles.projectLabel}>
                {project.name}
              </DropdownMenuLabel>
              {project.boards.map((board) => {
                const active =
                  project.slug === params.project &&
                  board.slug === params.board;
                return (
                  <DropdownMenuItem
                    key={board.id}
                    className={styles.item}
                    render={
                      <Link
                        href={boardViewHref(
                          boardBase(project.slug, board.slug),
                          view,
                        )}
                        aria-current={active ? "page" : undefined}
                      />
                    }
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {board.name}
                    </span>
                    {active && (
                      <Check aria-hidden="true" className="ml-auto size-4" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          ))
        )}
        <DropdownMenuSeparator className={styles.separator} />
        <DropdownMenuItem
          className={styles.footer}
          render={<Link href="/projects" />}
        >
          All projects
          <span aria-hidden="true">→</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
