import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardStencil } from "./stencils";

/** Shared by board and configuration loaders; stencils never require card data. */
export async function loadStencils(
  db: SupabaseClient,
  boardId: string,
): Promise<CardStencil[]> {
  const { data, error } = await db
    .from("card_stencils")
    .select(
      "id, board_id, name, title, summary, body_md, area, effort, card_stencil_tags(tag_id)",
    )
    .eq("board_id", boardId)
    .order("name");
  if (error) throw new Error("Could not load board stencils.");
  return (data ?? []).map(({ card_stencil_tags, ...row }) => ({
    ...row,
    tag_ids: card_stencil_tags.map((tag: { tag_id: string }) => tag.tag_id),
  })) as CardStencil[];
}
