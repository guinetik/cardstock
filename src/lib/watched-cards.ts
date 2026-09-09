import { supabaseServer } from "@/lib/supabase/server";

export interface WatchedCard {
  id: string;
  external_id: string;
  title: string;
  status: string;
  archived_at: string | null;
  boards: {
    name: string;
    slug: string;
    projects: { name: string; slug: string };
  };
  lanes: { name: string } | null;
}

/** The watch policy and inner card joins both require current access. */
export async function loadWatchedCards(): Promise<WatchedCard[]> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("card_watches")
    .select(
      "cards!inner(id, external_id, title, status, archived_at, boards!inner(name, slug, projects!inner(name, slug)), lanes!cards_lane_id_fkey(name))",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your watched issues.");
  return (data as unknown as { cards: WatchedCard }[]).map((row) => row.cards);
}
