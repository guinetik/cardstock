"use server";

import { revalidatePath } from "next/cache";
import { scheduleWatchMail } from "@/lib/schedule-watch-mail";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export async function setCardWatch(cardId: string, watching: boolean) {
  if (!(await currentMember()))
    return { ok: false as const, error: "Not signed in." };
  const db = await supabaseServer();
  const { error } = await db.rpc("set_card_watch", {
    p_card: cardId,
    p_watching: watching,
  });
  if (error)
    return {
      ok: false as const,
      error: "Could not update your watch. Please try again.",
    };
  if (watching) scheduleWatchMail();
  revalidatePath("/projects");
  revalidatePath("/watched");
  revalidatePath("/p/[project]/b/[board]", "page");
  return { ok: true as const };
}
