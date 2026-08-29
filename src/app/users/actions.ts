"use server";

import { revalidatePath } from "next/cache";
import { canInviteRole, canRemoveRole, type ProjectRole } from "@/lib/access";
import { currentAccess } from "@/lib/access-server";
import { normalizeEmail } from "@/lib/auth";
import { cleanName } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export type UserActionResult = { error?: string; success?: string } | null;

/**
 * Allowlist an email and attach it to a project. Owner or project admin;
 * the RPC is the write path so a half-written members row cannot exist
 * without membership. Only the owner may invite a project admin.
 */
export async function inviteUser(
  _previous: UserActionResult,
  form: FormData,
): Promise<UserActionResult> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };

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

  const access = await currentAccess(projectId);
  if (!access) return { error: "Not signed in." };
  if (!canInviteRole(access.actor, role)) {
    return {
      error:
        role === "admin"
          ? "Only an owner can invite a project admin."
          : "Only an owner or project admin can invite users.",
    };
  }

  const db = await supabaseServer();
  const { error } = await db.rpc("invite_project_member", {
    p_project_id: projectId,
    p_email: email,
    p_display_name: displayName,
    p_role: role,
  });
  if (error) return { error: error.message };
  await revalidateMembership(db, projectId);
  return {
    success: `${email} can now onboard with a password and access the project.`,
  };
}

/** Take a person off one project. They stay on the allowlist. */
export async function removeMembership(form: FormData): Promise<void> {
  const me = await currentMember();
  if (!me) return;
  const projectId = String(form.get("projectId") ?? "");
  const memberId = String(form.get("memberId") ?? "");
  if (!projectId || !memberId || memberId === me.id) return;
  const access = await currentAccess(projectId);
  if (!access) return;
  const db = await supabaseServer();
  const [{ data: targetMember }, { data: targetMembership }] =
    await Promise.all([
      db.from("members").select("role").eq("id", memberId).maybeSingle(),
      db
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("member_id", memberId)
        .maybeSingle(),
    ]);
  if (!targetMember || !targetMembership) return;
  if (
    !canRemoveRole(access.actor, {
      siteRole: targetMember.role,
      projectRole: targetMembership.role as ProjectRole,
      isSelf: false,
    })
  )
    return;
  await db.rpc("remove_project_member", {
    p_project_id: projectId,
    p_member_id: memberId,
  });
  await revalidateMembership(db, projectId);
}

/**
 * Membership changes show up on the global Users page and on the folder the
 * person was added to or taken off.
 */
async function revalidateMembership(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  projectId: string,
) {
  revalidatePath("/users");
  const { data } = await db
    .from("projects")
    .select("slug")
    .eq("id", projectId)
    .maybeSingle();
  if (data?.slug) revalidatePath(`/p/${data.slug}`);
}
