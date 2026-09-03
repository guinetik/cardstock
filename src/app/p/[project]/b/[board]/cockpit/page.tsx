import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CockpitView } from "@/components/cockpit/cockpit-view";
import { buildCockpitModel } from "@/lib/cockpit";
import { loadCockpit } from "@/lib/cockpit-data";
import { laneMicrocosm } from "@/lib/lane-map";
import { currentMember } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cockpit" };

export default async function CockpitPage(props: {
  params: Promise<{ project: string; board: string }>;
}) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadCockpit(project, board);
  const model = buildCockpitModel(data);
  const boardBase = `/p/${project}/b/${board}`;
  const laneRows = laneMicrocosm(data.lanes, data.cards);
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <header className="mb-8">
        <Link
          href={boardBase}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {data.board.name}
        </Link>
        <h1 className="mt-1 text-[27px] leading-tight">Epic Cockpit</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The whole delivery fleet, without the task-level noise. Open an epic
          when a signal needs explanation.
        </p>
        <nav
          className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]"
          aria-label="Board views"
        >
          <Link className="paper-link" href={boardBase}>
            Board
          </Link>
          <Link className="paper-link" href={`${boardBase}/timeline`}>
            Timeline
          </Link>
          <Link
            className="paper-link"
            href={`/p/${project}/b/${board}/calendar`}
          >
            Calendar
          </Link>
          <Link className="paper-link" href={`${boardBase}/manage`}>
            Manage
          </Link>
          <Link className="paper-link" href={`/p/${project}`}>
            Project
          </Link>
        </nav>
      </header>
      <CockpitView
        model={model}
        boardId={data.board.id}
        cockpitBase={`${boardBase}/cockpit`}
        cardBase={`${boardBase}/c`}
        boardHref={boardBase}
        laneRows={laneRows}
        cardCount={data.cards.length}
      />
    </main>
  );
}
