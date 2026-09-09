import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canManageProject } from "@/lib/access";
import { apiError } from "./errors";
import { type TokenMember, verifyToken } from "./token";

export interface ApiContext {
  member: TokenMember;
  project: { id: string; slug: string };
  board: { id: string; slug: string; settings: Record<string, unknown> };
  canManage: boolean;
  db: SupabaseClient;
}

export interface RootContext {
  member: TokenMember;
  db: SupabaseClient;
}

export function serviceDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Supabase service credentials are required");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Resolved =
  | {
      ok: true;
      project: ApiContext["project"];
      board: ApiContext["board"];
      canManage: boolean;
    }
  | { ok: false; code: "not_found" };

/** Resolve a board only after verifying that its project is visible. */
export async function resolveAccess(
  db: SupabaseClient,
  member: TokenMember,
  projectSlug: string,
  boardSlug: string,
): Promise<Resolved> {
  const { data: project } = await db
    .from("projects")
    .select("id, slug")
    .eq("slug", projectSlug)
    .maybeSingle();
  if (!project) return { ok: false, code: "not_found" };

  const { data: membership } = await db
    .from("project_members")
    .select("role")
    .eq("project_id", project.id as string)
    .eq("member_id", member.id)
    .maybeSingle();
  const projectRole = (membership?.role ?? null) as string | null;
  if (!projectRole && member.role !== "owner")
    return { ok: false, code: "not_found" };

  const { data: board } = await db
    .from("boards")
    .select("id, slug, settings")
    .eq("project_id", project.id as string)
    .eq("slug", boardSlug)
    .maybeSingle();
  if (!board) return { ok: false, code: "not_found" };

  return {
    ok: true,
    project: { id: project.id as string, slug: project.slug as string },
    board: {
      id: board.id as string,
      slug: board.slug as string,
      settings: (board.settings ?? {}) as Record<string, unknown>,
    },
    canManage: canManageProject({ siteRole: member.role, projectRole }),
  };
}

async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    console.error("api/v1:", error);
    return apiError("internal", "Something went wrong.");
  }
}

/** The authorization gate for every board-scoped API route. */
export function withToken(
  handler: (ctx: ApiContext, request: Request) => Promise<Response>,
) {
  return async (
    request: Request,
    ctx: { params: Promise<{ project: string; board: string }> },
  ): Promise<Response> =>
    guarded(async () => {
      const db = serviceDb();
      const auth = await verifyToken(db, request.headers.get("authorization"));
      if (!auth.ok)
        return apiError("unauthenticated", "Provide a valid CLI token.");
      const { project, board } = await ctx.params;
      const access = await resolveAccess(db, auth.member, project, board);
      if (!access.ok) return apiError("not_found", "No such board.");
      return handler({ member: auth.member, db, ...access }, request);
    });
}

/** The authorization gate for root-level API routes. */
export function withTokenNoBoard(
  handler: (ctx: RootContext, request: Request) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> =>
    guarded(async () => {
      const db = serviceDb();
      const auth = await verifyToken(db, request.headers.get("authorization"));
      if (!auth.ok)
        return apiError("unauthenticated", "Provide a valid CLI token.");
      return handler({ member: auth.member, db }, request);
    });
}
