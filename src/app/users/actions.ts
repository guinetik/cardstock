"use server";

import { revalidatePath } from "next/cache";
import { normalizeEmail } from "@/lib/auth";
import { cleanName } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export type UserActionResult = { error?: string; success?: string } | null;

export async function inviteUser(
  _previous: UserActionResult,
  form: FormData,
): Promise<UserActionResult> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  if (me.role !== "owner") return { error: "Only an owner can invite users." };

  const email = normalizeEmail(String(form.get("email") ?? ""));
  const rawName = String(form.get("displayName") ?? "");
  const displayName = rawName.trim() ? cleanName(rawName) : null;
  const projectId = String(form.get("projectId") ?? "");
  const role = String(form.get("role") ?? "member");
  if (!email) return { error: "Enter a valid email address." };
  if (rawName.trim() && !displayName)
    return { error: "Keep the display name to 80 characters or fewer." };
  if (!projectId) return { error: "Choose a project." };
  if (role !== "admin" && role !== "member")
    return { error: "Choose a valid project role." };

  const db = await supabaseServer();
  const { error } = await db.rpc("invite_project_member", {
    p_project_id: projectId,
    p_email: email,
    p_display_name: displayName,
    p_role: role,
  });
  if (error) return { error: error.message };
  revalidatePath("/users");
  return {
    success: `${email} can now onboard with a password and access the project.`,
  };
}

export async function removeMembership(form: FormData): Promise<void> {
  const me = await currentMember();
  if (!me || me.role !== "owner") return;
  const projectId = String(form.get("projectId") ?? "");
  const memberId = String(form.get("memberId") ?? "");
  if (!projectId || !memberId || memberId === me.id) return;
  const db = await supabaseServer();
  await db.rpc("remove_project_member", {
    p_project_id: projectId,
    p_member_id: memberId,
  });
  revalidatePath("/users");
}
