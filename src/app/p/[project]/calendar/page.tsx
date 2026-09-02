import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { calendarBoards, calendarMonth } from "@/lib/calendar";
import { loadProjectCalendar } from "@/lib/project-calendar-data";
import { currentMember } from "@/lib/supabase/server";
import { forgottenAfterDays, timelineToday } from "@/lib/timeline";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

/**
 * Project calendar across all boards. Board chips filter slips; drops persist
 * `target_date` via `updateCard` inside {@link CalendarView}.
 */
export default async function ProjectCalendarPage(
  props: PageProps<"/p/[project]/calendar">,
) {
  const { project } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadProjectCalendar(project);
  const today = timelineToday();
  const search = await props.searchParams;
  const month = calendarMonth(search.month, today);
  const selected = calendarBoards(
    search.boards,
    data.boards.map((board) => board.slug),
  );
  const slips = selected
    ? data.slips.filter((slip) => selected.includes(slip.boardSlug))
    : data.slips;
  return (
    <main className="flex h-full min-h-0 flex-1 flex-col px-4 pt-5 pb-4 sm:px-6">
      <Link
        href={`/p/${project}`}
        className="text-xs text-muted-foreground hover:underline"
      >
        ← {data.project.name}
      </Link>
      <CalendarView
        projectSlug={project}
        projectName={data.project.name}
        boardSlug={null}
        heading="All boards"
        month={month}
        today={today}
        watchDays={forgottenAfterDays(data.project.settings)}
        slips={slips}
        boards={data.boards}
        selectedBoards={selected}
        path={`/p/${project}/calendar`}
      />
    </main>
  );
}
