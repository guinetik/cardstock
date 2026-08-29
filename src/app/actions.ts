"use server";

import { redirect } from "next/navigation";
import { cleanName, keyFromName } from "@/lib/keys";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export type CreateProjectResult = { error?: string } | null;

export async function createProject(
  _previous: CreateProjectResult,
  form: FormData,
): Promise<CreateProjectResult> {
  const member = await currentMember();
  if (!member) return { error: "Not signed in." };
  if (member.role !== "owner")
    return { error: "Only an owner can create projects." };

  const name = cleanName(String(form.get("name") ?? ""));
  const description = String(form.get("description") ?? "").trim();
  if (!name) return { error: "Enter a project name (80 characters or fewer)." };
  if (description.length > 500)
    return { error: "Keep the description to 500 characters or fewer." };
  const slug = keyFromName(name);
  if (!slug) return { error: "The project name needs a letter or number." };

  const db = await supabaseServer();
  const { error } = await db.rpc("create_project", {
    p_slug: slug,
    p_name: name,
    p_description: description || null,
  });
  if (error) {
    if (error.code === "23505")
      return { error: `A project using “${slug}” already exists.` };
    return { error: error.message };
  }
  redirect(`/p/${slug}`);
}
