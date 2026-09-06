import type { Metadata } from "next";
import { oneRelated } from "@/lib/related";
import { boardTitleContext, CARDSTOCK_TITLE } from "@/lib/site-title";
import { supabaseServer } from "@/lib/supabase/server";

interface BoardIdentityRow {
  name: string;
  projects: { name: string } | { name: string }[] | null;
}

export async function generateMetadata(
  props: LayoutProps<"/p/[project]/b/[board]">,
): Promise<Metadata> {
  const { project: projectSlug, board: boardSlug } = await props.params;
  const db = await supabaseServer();
  const { data } = await db
    .from("boards")
    .select("name, projects!inner(name, slug)")
    .eq("slug", boardSlug)
    .eq("projects.slug", projectSlug)
    .maybeSingle();
  const board = data as BoardIdentityRow | null;
  const project = oneRelated(board?.projects ?? null);
  const context =
    board && project
      ? boardTitleContext(board.name, project.name)
      : "Board | Project";

  return {
    title: {
      default: context,
      template: `%s | ${context} - ${CARDSTOCK_TITLE}`,
    },
  };
}

/**
 * The board and anything laid over it. `modal` is the parallel slot the
 * intercepted card route renders into; it is empty everywhere else.
 */
export default function BoardLayout({
  children,
  modal,
}: LayoutProps<"/p/[project]/b/[board]">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
