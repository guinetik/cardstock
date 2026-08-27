import { redirect } from "next/navigation";
import { BoardView } from "@/components/board/board-view";
import { loadBoard } from "@/lib/board-data";
import { currentMember } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BoardPage(
  props: PageProps<"/p/[project]/b/[board]">,
) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadBoard(project, board);
  const prefs = (me.prefs ?? {}) as {
    inboxSort?: "newest" | "oldest";
    showInternal?: boolean;
  };
  return <BoardView data={data} me={{ email: me.email, prefs }} />;
}
