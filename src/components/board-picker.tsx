import {
  BoardPickerMenu,
  type PickerProject,
} from "@/components/board-picker-menu";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/** Read through the member's session so project and board access follows RLS. */
export async function BoardPicker() {
  const member = await currentMember();
  if (!member) return null;
  const db = await supabaseServer();
  const { data, error } = await db
    .from("projects")
    .select("id, slug, name, boards(id, slug, name)")
    .order("name");
  const projects: PickerProject[] = (data ?? [])
    .filter((project) => project.boards.length > 0)
    .map((project) => ({
      ...project,
      boards: [...project.boards].sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return <BoardPickerMenu projects={projects} failed={!!error} />;
}
