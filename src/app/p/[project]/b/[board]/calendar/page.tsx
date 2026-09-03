import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { loadBoard } from "@/lib/board-data";
import { type CalendarSlip, calendarMonth } from "@/lib/calendar";
import { resolveBoardGates } from "@/lib/gates";
import { currentMember } from "@/lib/supabase/server";
import { forgottenAfterDays, timelineToday } from "@/lib/timeline";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

/**
 * Board month of target dates. Drops persist `target_date` via `updateCard`.
 */
export default async function BoardCalendarPage(
  props: PageProps<"/p/[project]/b/[board]/calendar">,
) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadBoard(project, board);
  const today = timelineToday();
  const month = calendarMonth((await props.searchParams).month, today);
  const gates = resolveBoardGates(
    data.board.settings as Record<string, unknown>,
    data.lanes,
  );
  const slips: CalendarSlip[] = data.cards
    .filter((card) => !card.archived_at)
    .map((card) => ({
      card,
      boardSlug: data.board.slug,
      boardName: data.board.name,
      gates,
    }));
  const path = `/p/${project}/b/${board}/calendar`;
  return (
    <main className="flex h-full min-h-0 flex-1 flex-col px-4 pt-5 pb-4 sm:px-6">
      <Link
        href={`/p/${project}/b/${board}`}
        className="mb-4 inline-block text-xs text-muted-foreground hover:underline"
      >
        ← {data.board.name}
      </Link>
      <CalendarView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={board}
        heading={data.board.name}
        month={month}
        today={today}
        watchDays={forgottenAfterDays(data.project.settings)}
        slips={slips}
        boards={[]}
        selectedBoards={null}
        path={path}
      />
    </main>
  );
}
