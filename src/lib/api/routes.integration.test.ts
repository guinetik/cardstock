import { beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GET as getCards } from "@/app/api/v1/boards/[project]/[board]/cards/route";
import { GET as getBoard } from "@/app/api/v1/boards/[project]/[board]/route";
import { POST as postSync } from "@/app/api/v1/boards/[project]/[board]/sync/route";
import { GET as getBoards } from "@/app/api/v1/boards/route";
import { newToken } from "./token";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = !!url && !!key && /127\.0\.0\.1|localhost/.test(url);
const params = {
  params: Promise.resolve({ project: "demo", board: "backlog" }),
};

describe.skipIf(!local)("/api/v1 board routes", () => {
  let db: SupabaseClient;
  let authorization: string;

  beforeAll(async () => {
    db = createClient(url!, key!, { auth: { persistSession: false } });
    const { data: member, error } = await db
      .from("members")
      .select("id")
      .eq("email", process.env.OWNER_EMAIL!)
      .single();
    if (error || !member) throw new Error(`owner: ${error?.message}`);
    const token = newToken();
    const { error: tokenError } = await db.from("cli_tokens").upsert({
      id: token.id,
      member_id: member.id,
      name: `integration-${token.id}`,
      token_hash: token.hash,
    });
    if (tokenError) throw new Error(`token: ${tokenError.message}`);
    authorization = `Bearer ${token.plaintext}`;
  });

  const request = (body?: unknown) =>
    new Request("http://localhost/api/v1/boards", {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  test("requires a token", async () => {
    const response = await getBoards(
      new Request("http://localhost/api/v1/boards"),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  });

  test("discovers the demo board and returns vocabulary", async () => {
    const discovery = await getBoards(request());
    expect(discovery.status).toBe(200);
    const projects = (await discovery.json()).projects as { slug: string }[];
    expect(projects.some((project) => project.slug === "demo")).toBe(true);

    const vocabulary = await getBoard(request(), params);
    expect(vocabulary.status).toBe(200);
    const body = await vocabulary.json();
    expect(body.syncProtocol).toBe(5);
    expect(body.lanes.length).toBeGreaterThan(0);
    expect(body.etag).toMatch(/^[0-9a-f]{32}$/);
  });

  test("snapshots cards without rewriting stored markdown", async () => {
    const { data: before } = await db
      .from("cards")
      .select("id, source_text")
      .eq("board_id", await boardId());
    const response = await getCards(request(), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cards.length).toBeGreaterThan(0);
    expect(body.cards[0].revision).toBeTruthy();
    expect(body.cards[0].markdown).toContain("---");
    const { data: after } = await db
      .from("cards")
      .select("id, source_text")
      .eq("board_id", await boardId());
    expect(after).toEqual(before);
  });

  test("dry runs, rejects missing revisions, and applies a fresh revision", async () => {
    const snapshot = await (await getCards(request(), params)).json();
    const first = snapshot.cards[0] as {
      externalId: string;
      markdown: string;
      revision: string;
    };
    const changed = {
      ...first,
      markdown: `${first.markdown}\nIntegration change.\n`,
    };
    const dryRun = await postSync(
      request({ apply: false, cards: [changed] }),
      params,
    );
    expect(dryRun.status).toBe(200);
    expect((await dryRun.json()).plan.counts.changed).toBe(1);

    const missing = await postSync(
      request({
        apply: true,
        cards: [{ externalId: changed.externalId, markdown: changed.markdown }],
      }),
      params,
    );
    expect(missing.status).toBe(409);
    expect((await missing.json()).error.details.code).toBe("revision_required");

    const applied = await postSync(
      request({ apply: true, cards: [changed] }),
      params,
    );
    expect(applied.status).toBe(200);
    expect((await applied.json()).applied).toContain(first.externalId);
  });

  test("reports a stale revision and leaves the card alone", async () => {
    const snapshot = await (await getCards(request(), params)).json();
    const first = snapshot.cards[0] as {
      externalId: string;
      markdown: string;
      revision: string;
    };
    await db
      .from("cards")
      .update({ title: `Moved on ${Date.now()}` })
      .eq("board_id", await boardId())
      .eq("external_id", first.externalId);
    const response = await postSync(
      request({
        apply: true,
        cards: [{ ...first, markdown: `${first.markdown}\nStale change.\n` }],
      }),
      params,
    );
    expect(response.status).toBe(409);
    expect((await response.json()).conflicted).toContain(first.externalId);
  });

  async function boardId(): Promise<string> {
    const { data, error } = await db
      .from("boards")
      .select("id, projects!inner(slug)")
      .eq("slug", "backlog")
      .eq("projects.slug", "demo")
      .single();
    if (error || !data) throw new Error(`board: ${error?.message}`);
    return data.id as string;
  }
});
