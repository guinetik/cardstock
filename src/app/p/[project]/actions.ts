"use server";
import { revalidatePath } from "next/cache";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/**
 * Add an email to the allowlist and to this project.
 *
 * Owner-only: RLS enforces it, but check here too so the caller gets a reason
 * rather than a policy violation.
 */
export async function addMember(
  _prev: { error?: string } | null,
  form: FormData,
) {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  if (me.role !== "owner")
    return { error: "Only the owner can invite people while in beta." };
  const projectId = String(form.get("projectId") ?? "");
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!projectId || !email.includes("@"))
    return { error: "A valid email is required." };
  const db = await supabaseServer();
  const { data: m, error } = await db
    .from("members")
    .upsert(
      { email, display_name: email.split("@")[0] },
      { onConflict: "email" },
    )
    .select("id")
    .single();
  if (error || !m) return { error: error?.message ?? "Could not add member." };
  const { error: e2 } = await db
    .from("project_members")
    .upsert(
      { project_id: projectId, member_id: m.id },
      { onConflict: "project_id,member_id" },
    );
  if (e2) return { error: e2.message };
  revalidatePath("/p/[project]", "page");
  return null;
}
