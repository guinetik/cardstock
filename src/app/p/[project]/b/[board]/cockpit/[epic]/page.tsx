import { notFound, redirect } from "next/navigation";
import { EpicDetail } from "@/components/cockpit/epic-detail";
import { buildCockpitModel } from "@/lib/cockpit";
import { loadCockpit } from "@/lib/cockpit-data";
import { currentMember } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EpicCockpitPage(props: {
  params: Promise<{ project: string; board: string; epic: string }>;
}) {
  const { project, board, epic } = await props.params;
  const member = await currentMember();
  if (!member) redirect("/login?error=member");
  const data = await loadCockpit(project, board);
  const model = buildCockpitModel(data);
  const view = [...model.active, ...model.completed].find(
    (candidate) => candidate.epic.id === epic,
  );
  if (!view) notFound();
  const boardBase = `/p/${project}/b/${board}`;
  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
      <EpicDetail
        view={view}
        cockpitBase={`${boardBase}/cockpit`}
        cardBase={`${boardBase}/c`}
      />
    </main>
  );
}
