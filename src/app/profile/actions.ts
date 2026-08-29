"use server";

import { revalidatePath } from "next/cache";
import { cleanName, displayNameProblem } from "@/lib/keys";
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
