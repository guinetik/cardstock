import { createClient } from "@supabase/supabase-js";

/** Service-role client for the ETL. Local tool only — never in the browser or on Vercel. */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (see .env.local)",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Db = ReturnType<typeof serviceClient>;

export async function loadBoard(
  db: Db,
  projectSlug: string,
  boardSlug: string,
) {
  const { data: project, error: pe } = await db
    .from("projects")
    .select("id, slug, name")
    .eq("slug", projectSlug)
    .single();
  if (pe || !project)
    throw new Error(`project '${projectSlug}' not found: ${pe?.message ?? ""}`);
  const { data: board, error: be } = await db
    .from("boards")
    .select("id, slug, name, settings")
    .eq("project_id", project.id)
    .eq("slug", boardSlug)
    .single();
  if (be || !board)
    throw new Error(
      `board '${boardSlug}' not found in '${projectSlug}': ${be?.message ?? ""}`,
    );
  const { data: lanes } = await db
    .from("lanes")
    .select("id, key, name, kind, position")
    .eq("board_id", board.id)
    .order("position");
  const { data: groups } = await db
    .from("tag_groups")
    .select("id, key, name, tags(id, key, name)")
    .eq("board_id", board.id);
  const tagByRef = new Map<string, string>();
  for (const g of groups ?? [])
    for (const t of (g as { tags: { id: string; key: string }[] }).tags)
      tagByRef.set(`${g.key}:${t.key}`, t.id);
  const laneByKey = new Map((lanes ?? []).map((l) => [l.key, l]));
  return {
    project,
    board,
    lanes: lanes ?? [],
    laneByKey,
    tagByRef,
    settings: (board.settings ?? {}) as Record<string, unknown>,
  };
}

export function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
