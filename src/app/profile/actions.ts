"use server";

import { revalidatePath } from "next/cache";
import { cleanName, displayNameProblem } from "@/lib/keys";
import { type NotificationPrefs, notificationPrefs } from "@/lib/notify";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export type ProfileResult = { error?: string; success?: string } | null;

/** Update the signed-in member's display name. Email is identity, not a field. */
export async function updateProfile(
  _previous: ProfileResult,
  form: FormData,
): Promise<ProfileResult> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  const problem = displayNameProblem(String(form.get("displayName") ?? ""));
  if (problem) return { error: problem };
  const displayName = cleanName(String(form.get("displayName") ?? ""));
  if (!displayName) return { error: problem ?? "Enter a name." };

  const db = await supabaseServer();
  const { error } = await db
    .from("members")
    .update({ display_name: displayName })
    .eq("id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/users");
  return { success: "Name saved." };
}

/**
 * Store what board activity may interrupt this member. The value is
 * re-parsed through {@link notificationPrefs} so only the known shape ever
 * lands in prefs, merged beside the board's own keys.
 */
export async function saveNotificationPrefs(
  next: NotificationPrefs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await currentMember();
  if (!me) return { ok: false, error: "Not signed in." };
  const clean = notificationPrefs(next);
  const db = await supabaseServer();
  const { error } = await db
    .from("members")
    .update({
      prefs: {
        ...((me.prefs ?? {}) as Record<string, unknown>),
        notifications: clean,
      },
    })
    .eq("id", me.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}
