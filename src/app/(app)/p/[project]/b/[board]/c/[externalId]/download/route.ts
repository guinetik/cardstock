import { resolveAccess, serviceDb } from "@/lib/api/route";
import { syncSnapshot } from "@/lib/api/sync";
import { currentMember } from "@/lib/supabase/server";

/** A read-only single sheet, byte-for-byte the markdown returned by CLI sync. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/p/[project]/b/[board]/c/[externalId]/download">,
) {
  const member = await currentMember();
  if (!member)
    return new Response("Sign in to download this card.", { status: 401 });
  const { project, board, externalId } = await ctx.params;
  if (!/^[1-9]\d*$/.test(externalId))
    return new Response("Card not found.", { status: 404 });
  try {
    const db = serviceDb();
    // The privileged serializer runs only after checking this member's project access.
    const access = await resolveAccess(db, member, project, board);
    if (!access.ok) return new Response("Card not found.", { status: 404 });
    const snapshot = await syncSnapshot(db, access.board.id, project, board);
    const card = snapshot.cards.find(
      (item) => item.externalId === externalId && !item.deleted,
    );
    if (!card) return new Response("Card not found.", { status: 404 });
    return new Response(card.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${externalId}.md"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Could not download this card. Please try again.", {
      status: 500,
    });
  }
}
