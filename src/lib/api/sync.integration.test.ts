import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GET as getMetadata } from "@/app/api/v1/boards/[project]/[board]/route";
import { POST as applyRoute } from "@/app/api/v1/boards/[project]/[board]/sync/apply/route";
import { GET as getSnapshot } from "@/app/api/v1/boards/[project]/[board]/sync/route";
import { syncColumns, syncRequestSchema, syncSnapshot } from "./sync";
import { newToken } from "./token";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local =
  !!url && !!key && ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
const sheet = (id: number, body = "Original.") =>
  `---\nid: ${id}\ntitle: Card ${id}\nstatus: backlog\nepic: Test\narea: Data\ntags: [bug]\ncustom:\n  order: [a, b]\n---\n# Card ${id}\n${body}\n`;
describe.skipIf(!local)("transactional CLI sync", () => {
  let db: SupabaseClient,
    board: string,
    project: string,
    member: string,
    projectSlug: string;
  beforeAll(async () => {
    db = createClient(url!, key!, { auth: { persistSession: false } });
    const suffix = randomUUID();
    const m = await db
      .from("members")
      .insert({ email: `cli-sync-${suffix}@example.test`, role: "member" })
      .select("id")
      .single();
    if (m.error) throw m.error;
    member = m.data.id;
    projectSlug = `cli-sync-${suffix}`;
    const p = await db
      .from("projects")
      .insert({ slug: projectSlug, name: "CLI sync test" })
      .select("id")
      .single();
    if (p.error) throw p.error;
    project = p.data.id;
    const pm = await db
      .from("project_members")
      .insert({ project_id: project, member_id: member, role: "admin" });
    if (pm.error) throw pm.error;
    const b = await db
      .from("boards")
      .insert({ project_id: project, slug: "test", name: "Sync test" })
      .select("id")
      .single();
    if (b.error) throw b.error;
    board = b.data.id;
    const g = await db
      .from("tag_groups")
      .insert({ board_id: board, key: "kind", name: "Kind" })
      .select("id")
      .single();
    if (g.error) throw g.error;
    const tags = await db
      .from("tags")
      .insert({ group_id: g.data.id, key: "bug", name: "Bug" });
    if (tags.error) throw tags.error;
  });
  afterAll(async () => {
    if (project) await db.from("projects").delete().eq("id", project);
    if (member) await db.from("members").delete().eq("id", member);
  });
  const snapshot = () => syncSnapshot(db, board, "test", "test");
  const request = (
    id: number,
    markdown = sheet(id),
    cardId: string | null = null,
    revision: string | null = null,
  ) => ({ externalId: String(id), markdown, cardId, revision });
  const apply = (
    cards: (ReturnType<typeof request> & { deleted?: boolean })[],
    operation = randomUUID(),
    actor = member,
  ) =>
    db.rpc("cli_apply_sync_v4", {
      p_board: board,
      p_member: actor,
      p_operation: operation,
      p_cards: cards.map((card) => syncColumns(card, {})),
    });

  test("creates cards and links in one batch, retaining exact nested source bytes", async () => {
    const first = sheet(1).replace("tags: [bug]", "tags: [bug]\nrelates: [2]");
    const result = await apply([request(1, first), request(2)]);
    expect(result.error).toBeNull();
    const snap = await snapshot();
    expect(snap.cards).toHaveLength(2);
    expect(snap.cards[0].cardId).toBeTruthy();
    expect(snap.cards.find((card) => card.externalId === "1")?.markdown).toBe(
      first,
    );
    const links = await db
      .from("card_links")
      .select("from_card")
      .eq("from_card", snap.cards[0].cardId);
    expect(links.data).toHaveLength(1);
  });
  test("removes optional fields and ignores legacy body ownership", async () => {
    const first = (await snapshot()).cards.find(
      (card) => card.externalId === "1",
    )!;
    await db
      .from("cards")
      .update({ body_edited_at: new Date().toISOString() })
      .eq("id", first.cardId);
    const current = (await snapshot()).cards.find(
      (card) => card.externalId === "1",
    )!;
    const md = sheet(1, "New body.").replace("custom:\n  order: [a, b]\n", "");
    expect(
      (await apply([request(1, md, current.cardId, current.revision)])).error,
    ).toBeNull();
    expect(
      (await snapshot()).cards.find((card) => card.externalId === "1")
        ?.markdown,
    ).toBe(md);
    const row = await db
      .from("cards")
      .select("frontmatter_extra,body_md,body_edited_at")
      .eq("id", first.cardId)
      .single();
    expect(row.data?.frontmatter_extra).toEqual({});
    expect(row.data?.body_md).toBe("New body.");
    expect(row.data?.body_edited_at).toBeNull();
  });
  test("stale revisions, replaced identities and racing creations reject the entire batch", async () => {
    const first = (await snapshot()).cards.find(
      (card) => card.externalId === "1",
    )!;
    for (const item of [
      request(1, sheet(1), first.cardId, "2000-01-01T00:00:00Z"),
      request(1, sheet(1), randomUUID(), first.revision),
      request(1),
    ]) {
      const result = await apply([request(3), item]);
      expect(result.error?.code).toBe("23514");
      expect(
        (await snapshot()).cards.some((card) => card.externalId === "3"),
      ).toBe(false);
    }
  });
  test("invalid tags roll back card text, new identities, relations and events", async () => {
    const snap = await snapshot(),
      first = snap.cards[0];
    const events = await db
      .from("card_events")
      .select("id")
      .eq("card_id", first.cardId);
    const result = await apply([
      request(3),
      request(
        Number(first.externalId),
        sheet(Number(first.externalId)).replace("[bug]", "[missing]"),
        first.cardId,
        first.revision,
      ),
    ]);
    expect(result.error?.code).toBe("22023");
    expect(await snapshot()).toEqual(snap);
    expect(
      (await db.from("card_events").select("id").eq("card_id", first.cardId))
        .data,
    ).toEqual(events.data);
  });
  test("same operation retries once; a different request cannot reuse its receipt", async () => {
    const op = randomUUID(),
      card = request(4);
    const one = await apply([card], op),
      two = await apply([card], op);
    expect(one.error).toBeNull();
    expect(two.data).toEqual(one.data);
    expect((await apply([request(5)], op)).error?.code).toBe("23514");
    const created = (await snapshot()).cards.find(
      (item) => item.externalId === "4",
    )!;
    expect(
      (await db.from("card_events").select("id").eq("card_id", created.cardId))
        .data,
    ).toHaveLength(1);
  });
  test("parallel same-ID creations cannot overwrite each other", async () => {
    const results = await Promise.all([
      apply([request(6, sheet(6, "One."))]),
      apply([request(6, sheet(6, "Two."))]),
    ]);
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(
      results.filter((result) => result.error?.code === "23514"),
    ).toHaveLength(1);
  });
  test("web field and tag changes rebase source without flattening unknown YAML", async () => {
    const card = (await snapshot()).cards.find(
      (item) => item.externalId === "2",
    )!;
    await db.from("cards").update({ status: "held" }).eq("id", card.cardId);
    const changed = (await snapshot()).cards.find(
      (item) => item.externalId === "2",
    )!;
    expect(changed.markdown).toBe(
      sheet(2).replace("status: backlog", "status: held"),
    );
    await db.from("card_tags").delete().eq("card_id", card.cardId);
    const after = (await snapshot()).cards.find(
      (item) => item.externalId === "2",
    )!;
    expect(after.revision).not.toBe(changed.revision);
    expect(after.markdown).toContain("tags: []");
    expect(after.markdown).toContain("  order: [a, b]");
  });
  test("revoked permissions and public RPC calls cannot write", async () => {
    const suffix = randomUUID();
    const outsider = await db
      .from("members")
      .insert({ email: `cli-read-${suffix}@example.test`, role: "member" })
      .select("id")
      .single();
    if (outsider.error) throw outsider.error;
    try {
      expect(
        (await apply([request(7)], randomUUID(), outsider.data.id)).error?.code,
      ).toBe("42501");
    } finally {
      await db.from("members").delete().eq("id", outsider.data.id);
    }
    const anon = createClient(
      url!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    expect(
      (
        await anon.rpc("cli_apply_sync_v4", {
          p_board: board,
          p_member: member,
          p_operation: randomUUID(),
          p_cards: [],
        })
      ).error,
    ).not.toBeNull();
  });

  test("lane positions reflect real ordering and conflicting positions roll back", async () => {
    const lane = await db.from("lanes").insert({
      board_id: board,
      key: "now",
      name: "Now",
      kind: "work",
      position: 0,
    });
    if (lane.error) throw lane.error;
    const at = (id: number, rank: number) =>
      sheet(id).replace("tags: [bug]", `tags: [bug]\nlane: now\nrank: ${rank}`);
    expect(
      (await apply([request(8, at(8, 1)), request(9, at(9, 2))])).error,
    ).toBeNull();
    const staleFirst = (await snapshot()).cards.find(
      (card) => card.externalId === "8",
    )!;
    const second = (await snapshot()).cards.find(
      (card) => card.externalId === "9",
    )!;
    expect(
      (await apply([request(9, at(9, 1), second.cardId, second.revision)]))
        .error,
    ).toBeNull();
    const snap = await snapshot();
    expect(
      snap.cards.find((card) => card.externalId === "9")?.markdown,
    ).toContain("rank: 1");
    expect(
      snap.cards.find((card) => card.externalId === "8")?.markdown,
    ).toContain("rank: 2");
    const first = snap.cards.find((card) => card.externalId === "8")!;
    expect(first.revision).not.toBe(staleFirst.revision);
    expect(
      (
        await apply([
          request(8, at(8, 1), staleFirst.cardId, staleFirst.revision),
        ])
      ).error?.code,
    ).toBe("23514");
    expect(
      (await apply([request(8, at(8, 999), first.cardId, first.revision)]))
        .error?.code,
    ).toBe("22023");
    expect(await snapshot()).toEqual(snap);
  });

  test("audience round-trips without an internal tag and legacy names do not classify cards", async () => {
    const text = sheet(30)
      .replace("epic: Test", "epic: Engineering (internal)")
      .replace("area: Data", "area: Unlisted area");
    expect((await apply([request(30, text)])).error).toBeNull();
    let card = (await snapshot()).cards.find((c) => c.externalId === "30")!;
    const row = await db
      .from("cards")
      .select("audience")
      .eq("id", card.cardId)
      .single();
    expect(row.data?.audience).toBe("all");
    const classified = text.replace(
      "tags: [bug]",
      "tags: [bug]\naudience: internal",
    );
    expect(
      (await apply([request(30, classified, card.cardId, card.revision)]))
        .error,
    ).toBeNull();
    card = (await snapshot()).cards.find((c) => c.externalId === "30")!;
    expect(card.markdown).toBe(classified);
    expect(
      (await apply([request(30, text, card.cardId, card.revision)])).error,
    ).toBeNull();
    expect(
      (await db.from("cards").select("audience").eq("id", card.cardId).single())
        .data?.audience,
    ).toBe("all");
    card = (await snapshot()).cards.find((c) => c.externalId === "30")!;
    expect(
      (await apply([request(30, classified, card.cardId, card.revision)]))
        .error,
    ).toBeNull();
    card = (await snapshot()).cards.find((c) => c.externalId === "30")!;
    await db.from("cards").update({ audience: "all" }).eq("id", card.cardId);
    const changed = (await snapshot()).cards.find(
      (c) => c.externalId === "30",
    )!;
    expect(changed.revision).not.toBe(card.revision);
    expect(changed.markdown).toContain("audience: all");
  });

  test("pre-audience stored projections export the existing classification, not old source conventions", async () => {
    expect((await apply([request(31)])).error).toBeNull();
    const card = (await snapshot()).cards.find((c) => c.externalId === "31")!;
    const saved = await db
      .from("cards")
      .select("sync_projection")
      .eq("id", card.cardId)
      .single();
    const projection = { ...saved.data!.sync_projection };
    delete projection["frontmatter.audience"];
    await db
      .from("cards")
      .update({ audience: "internal", sync_projection: projection })
      .eq("id", card.cardId);
    expect(
      (await snapshot()).cards.find((c) => c.externalId === "31")!.markdown,
    ).toContain("audience: internal");
    await db
      .from("cards")
      .update({ sync_projection: null })
      .eq("id", card.cardId);
    expect(
      (await snapshot()).cards.find((c) => c.externalId === "31")!.markdown,
    ).toContain("audience: internal");
  });

  test("new epic names are reused and clearing assignments does not delete the epic", async () => {
    const text = sheet(32).replace(
      "epic: Test",
      "epic: A brand-new initiative",
    );
    expect(
      (
        await apply([
          request(32, text),
          request(33, text.replaceAll("32", "33")),
        ])
      ).error,
    ).toBeNull();
    const epics = await db
      .from("epics")
      .select("id")
      .eq("board_id", board)
      .eq("source_name", "A brand-new initiative");
    expect(epics.data).toHaveLength(1);
    let card = (await snapshot()).cards.find((c) => c.externalId === "32")!;
    const cleared = text.replace("epic: A brand-new initiative\n", "");
    expect(
      (await apply([request(32, cleared, card.cardId, card.revision)])).error,
    ).toBeNull();
    expect(
      (
        await db
          .from("cards")
          .select("epic,epic_id")
          .eq("id", card.cardId)
          .single()
      ).data,
    ).toEqual({ epic: null, epic_id: null });
    expect(
      (await db.from("epics").select("id").eq("id", epics.data![0].id)).data,
    ).toHaveLength(1);
    await db
      .from("cards")
      .update({ epic: "A brand-new initiative", epic_id: epics.data![0].id })
      .eq("id", card.cardId);
    card = (await snapshot()).cards.find((c) => c.externalId === "32")!;
    expect(card.markdown).toContain("epic: A brand-new initiative");
  });

  test("built Node CLI round-trips through the real route and local database", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-real-sync-"));
    const tracker = path.join(cwd, "tracker"),
      credentials = path.join(cwd, "credentials");
    await mkdir(tracker);
    await mkdir(path.join(credentials, "cardstock"), { recursive: true });
    const token = newToken();
    const issued = await db.from("cli_tokens").insert({
      id: token.id,
      member_id: member,
      name: "sync-e2e",
      token_hash: token.hash,
    });
    if (issued.error) throw issued.error;
    const ctx = {
      params: Promise.resolve({ project: projectSlug, board: "test" }),
    };
    const server = createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: {
            authorization: String(req.headers.authorization ?? ""),
            "content-type": "application/json",
          },
          ...(req.method === "POST"
            ? { body: Buffer.concat(chunks).toString() }
            : {}),
        });
        const handler =
          req.method === "POST"
            ? applyRoute
            : req.url?.endsWith("/sync")
              ? getSnapshot
              : getMetadata;
        const response = await handler(request, ctx);
        res.writeHead(response.status, { "content-type": "application/json" });
        res.end(await response.text());
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: { message: String(error) } }));
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const remote = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const cli = (...args: string[]) =>
      new Promise<{ code: number | null; stdout: string }>((resolve) => {
        const child = spawn(
          "node",
          [path.resolve("packages/cli/dist/index.js"), ...args, "--json"],
          {
            cwd,
            env: {
              ...process.env,
              APPDATA: credentials,
              XDG_CONFIG_HOME: credentials,
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stdout = "";
        child.stdout.on("data", (chunk) => (stdout += chunk));
        child.on("close", (code) => resolve({ code, stdout }));
      });
    try {
      await writeFile(
        path.join(credentials, "cardstock", "credentials.json"),
        JSON.stringify([
          {
            remote,
            token: token.plaintext,
            email: "sync@example.test",
            createdAt: "2026-09-06",
          },
        ]),
      );
      await writeFile(
        path.join(cwd, "cardstock.json"),
        JSON.stringify({
          version: 1,
          remote,
          project: projectSlug,
          board: "test",
          tracker: "tracker",
        }),
      );
      for (const card of (await snapshot()).cards)
        await writeFile(
          path.join(tracker, `${card.externalId}.md`),
          card.markdown,
        );
      let result = await cli("baseline");
      expect(result.code, result.stdout).toBe(0);
      const target = path.join(tracker, "4.md"),
        original = await readFile(target, "utf8");
      await writeFile(target, `${original}CLI edit.\n`);
      const row = (await snapshot()).cards.find(
        (card) => card.externalId === "4",
      )!;
      await db.from("cards").update({ status: "held" }).eq("id", row.cardId);
      result = await cli("sync");
      expect(result.code, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout).clean).toBe(true);
      const changed = await readFile(target, "utf8");
      expect(changed).toContain("status: held");
      expect(changed).toContain("CLI edit.");
      expect(
        (await snapshot()).cards.find((card) => card.externalId === "4")
          ?.markdown,
      ).toBe(changed);
      await db
        .from("cards")
        .update({ audience: "internal", area: "A new web area" })
        .eq("id", row.cardId);
      result = await cli("sync");
      expect(result.code, result.stdout).toBe(0);
      expect(await readFile(target, "utf8")).toContain("audience: internal");
      expect(await readFile(target, "utf8")).toContain("area: A new web area");
      await writeFile(
        target,
        (await readFile(target, "utf8")).replace(
          "audience: internal",
          "audience: all",
        ),
      );
      result = await cli("sync");
      expect(result.code, result.stdout).toBe(0);
      expect(
        (
          await db
            .from("cards")
            .select("audience")
            .eq("id", row.cardId)
            .single()
        ).data?.audience,
      ).toBe("all");
      result = await cli("status");
      expect(result.code, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout).clean).toBe(true);
      // An independent checkout has its own baseline but uses the same real API.
      const secondRoot = path.join(cwd, "second");
      const secondTracker = path.join(secondRoot, "tracker");
      const secondConfig = path.join(secondRoot, "cardstock.json");
      await mkdir(secondTracker, { recursive: true });
      await writeFile(
        secondConfig,
        await readFile(path.join(cwd, "cardstock.json"), "utf8"),
      );
      result = await cli("sync", "--config", secondConfig);
      expect(result.code, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout).clean).toBe(true);
      const secondTarget = path.join(secondTracker, "4.md");
      const survivor = `${await readFile(secondTarget, "utf8")}Second checkout edit.\n`;
      await writeFile(secondTarget, survivor);
      result = await cli("delete", "4", "--dry-run");
      expect(result.code, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout).cards[0].action).toBe("delete_remote");
      result = await cli("delete", "4");
      expect(result.code, result.stdout).toBe(0);
      expect(
        (await snapshot()).cards.find((card) => card.externalId === "4")
          ?.deleted,
      ).toBe(true);
      result = await cli("sync", "--config", secondConfig);
      expect(result.code, result.stdout).toBe(1);
      expect(JSON.parse(result.stdout).counts.conflicts).toBe(1);
      result = await cli("sync", "--config", secondConfig, "--ours", "4");
      expect(result.code, result.stdout).toBe(0);
      expect(
        (await snapshot()).cards.find((card) => card.externalId === "4")
          ?.cardId,
      ).toBe(row.cardId);
      result = await cli("sync");
      expect(result.code, result.stdout).toBe(0);
      expect(await readFile(target, "utf8")).toBe(survivor);
      result = await cli("delete", "4");
      expect(result.code, result.stdout).toBe(0);
      result = await cli("sync", "--config", secondConfig);
      expect(result.code, result.stdout).toBe(0);
      expect(JSON.parse(result.stdout).clean).toBe(true);
      expect(
        await readFile(secondTarget, "utf8").catch((error) => error.code),
      ).toBe("ENOENT");
      // Unchanged deleted cards stay deleted on both checkouts.
      expect(JSON.parse((await cli("status")).stdout).clean).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(cwd, { recursive: true, force: true });
    }
  }, 30000);

  test("deletion is atomic, revision-checked, idempotent and reserves identity", async () => {
    expect((await apply([request(701), request(702)])).error).toBeNull();
    const first = (await snapshot()).cards.find(
      (card) => card.externalId === "701",
    )!;
    const second = (await snapshot()).cards.find(
      (card) => card.externalId === "702",
    )!;
    const deletion = {
      ...request(701, first.markdown, first.cardId, first.revision),
      deleted: true,
    };
    const stale = await apply([
      deletion,
      {
        ...request(702, second.markdown, second.cardId, "stale"),
        deleted: true,
      },
    ]);
    expect(stale.error?.code).toBe("23514");
    expect(
      (await snapshot()).cards.find((card) => card.externalId === "701")
        ?.deleted,
    ).toBeUndefined();
    const operation = randomUUID();
    const result = await apply([deletion], operation);
    expect(result.error).toBeNull();
    expect((await apply([deletion], operation)).data).toEqual(result.data);
    expect(
      (await apply([{ ...deletion, deleted: false }], operation)).error?.code,
    ).toBe("23514");
    const dead = (await snapshot()).cards.find(
      (card) => card.externalId === "701",
    )!;
    expect(dead.deleted).toBe(true);
    expect(dead.cardId).toBe(first.cardId);
    expect(dead.markdown).toBe(first.markdown);
    expect(dead.revision).not.toBe(first.revision);
    expect(
      (await db.from("cards").select("id").eq("id", first.cardId)).data,
    ).toHaveLength(0);
    expect((await apply([request(701)])).error?.code).toBe("23514");
    const legacy = await db.from("cards").insert({
      board_id: board,
      external_id: "701",
      title: "Accidental resurrection",
    });
    expect(legacy.error?.code).toBe("23514");
    const restore = await apply([
      request(
        701,
        sheet(701, "Explicit survivor."),
        dead.cardId,
        dead.revision,
      ),
    ]);
    expect(restore.error).toBeNull();
    const alive = (await snapshot()).cards.find(
      (card) => card.externalId === "701",
    )!;
    expect(alive.deleted).toBeUndefined();
    expect(alive.cardId).toBe(first.cardId);
    expect(alive.markdown).toContain("Explicit survivor.");
    expect((await apply([deletion])).error?.code).toBe("23514");
  });

  test("administrator deletes capture tombstones, including cards with tags and links", async () => {
    const md = sheet(703).replace("tags: [bug]", "tags: [bug]\nrelates: [704]");
    expect((await apply([request(703, md), request(704)])).error).toBeNull();
    const first = (await snapshot()).cards.find(
      (card) => card.externalId === "703",
    )!;
    const deletion = await db.from("cards").delete().eq("id", first.cardId);
    expect(deletion.error).toBeNull();
    const dead = (await snapshot()).cards.find(
      (card) => card.externalId === "703",
    )!;
    expect(dead.deleted).toBe(true);
    expect(dead.markdown).toContain("relates: [704]");
    expect(dead.markdown).toContain("tags: [bug]");
  });
});

test("sync wire validation rejects mismatched identity/revision pairs and duplicate IDs", () => {
  expect(
    syncRequestSchema.safeParse({
      protocol: 2,
      operationId: randomUUID(),
      cards: [],
    }).success,
  ).toBe(false);
  expect(
    syncRequestSchema.safeParse({
      protocol: 4,
      operationId: randomUUID(),
      cards: [
        {
          externalId: "1",
          markdown: sheet(1),
          cardId: randomUUID(),
          revision: null,
        },
      ],
    }).success,
  ).toBe(false);
  const card = {
    externalId: "1",
    markdown: sheet(1),
    cardId: null,
    revision: null,
  };
  expect(
    syncRequestSchema.safeParse({
      protocol: 4,
      operationId: randomUUID(),
      cards: [card, card],
    }).success,
  ).toBe(false);
});
