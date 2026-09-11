import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const entry =
  process.env.CARDSTOCK_TEST_ENTRY ??
  fileURLToPath(new URL("../dist/index.js", import.meta.url));
const sheet = (id = 1) =>
  `---\nid: ${id}\ntitle: Example ${id}\nstatus: backlog\nepic: Platform\narea: UI\ntags: [bug]\ncustom: original\n---\n# Local heading\nOriginal body.\n`;
async function setup(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-apply-")),
    tracker = path.join(cwd, "tracker"),
    credentials = path.join(cwd, "credentials");
  await mkdir(tracker);
  await mkdir(path.join(credentials, "cardstock"), { recursive: true });
  await writeFile(path.join(tracker, "1.md"), sheet());
  const state = {
    cards: [
      {
        externalId: "1",
        cardId: randomUUID(),
        revision: "2026-09-06T00:00:00.000Z",
        markdown: sheet(),
      },
    ],
    requests: [],
    writes: 0,
    receipts: new Map(),
    hook: null,
    protocol: 5,
    drop: false,
    revision: 0,
    ignoreCardFilter: false,
  };
  const snapshot = () => ({
    syncProtocol: state.protocol,
    project: "demo",
    board: "test",
    etag: `v${state.revision}`,
    tagGroups: [{ key: "kind", tags: [{ key: "bug" }] }],
    cards: state.cards,
  });
  const server = createServer(async (req, res) => {
    try {
      state.requests.push(`${req.method} ${req.url}`);
      if (req.headers.authorization !== "Bearer test-token") {
        res.writeHead(401);
        res.end("{}");
        return;
      }
      if (state.hook) await state.hook(req);
      res.setHeader("content-type", "application/json");
      if (req.method === "GET") {
        const result = snapshot();
        const card = new URL(req.url, "http://localhost").searchParams.get(
          "card",
        );
        if (card && !state.ignoreCardFilter)
          result.cards = result.cards.filter(
            (item) => item.externalId === card,
          );
        res.end(JSON.stringify(result));
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      if (state.receipts.has(body.operationId)) {
        res.end(JSON.stringify(state.receipts.get(body.operationId)));
        return;
      }
      for (const change of body.cards) {
        const current = state.cards.find(
          (card) => card.externalId === change.externalId,
        );
        if (
          change.cardId === null
            ? !!current
            : !current ||
              current.cardId !== change.cardId ||
              current.revision !== change.revision
        ) {
          res.writeHead(409);
          res.end(JSON.stringify({ error: { message: "revision changed" } }));
          return;
        }
      }
      const applied = [];
      for (const change of body.cards) {
        const current = state.cards.find(
          (card) => card.externalId === change.externalId,
        );
        const next = {
          externalId: change.externalId,
          cardId: current?.cardId ?? randomUUID(),
          revision: `2026-09-06T00:00:${String(++state.revision).padStart(2, "0")}.000Z`,
          markdown: change.markdown,
          ...(change.deleted ? { deleted: true } : {}),
        };
        state.cards = state.cards
          .filter((card) => card.externalId !== change.externalId)
          .concat(next);
        applied.push({
          externalId: next.externalId,
          cardId: next.cardId,
          revision: next.revision,
        });
        state.writes++;
      }
      const receipt = { protocol: 5, operationId: body.operationId, applied };
      state.receipts.set(body.operationId, receipt);
      if (state.drop) {
        state.drop = false;
        req.socket.destroy();
        return;
      }
      res.end(JSON.stringify(receipt));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: { message: String(error) } }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(cwd, { recursive: true, force: true });
  });
  const remote = `http://127.0.0.1:${server.address().port}`;
  await writeFile(
    path.join(credentials, "cardstock", "credentials.json"),
    JSON.stringify([
      {
        remote,
        token: "test-token",
        email: "test@example.test",
        createdAt: "2026-09-06",
      },
    ]),
  );
  await writeFile(
    path.join(cwd, "cardstock.json"),
    JSON.stringify({
      version: 1,
      remote,
      project: "demo",
      board: "test",
      tracker: "tracker",
    }),
  );
  const cli = (...args) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [entry, ...args, "--json"], {
        cwd,
        env: {
          ...process.env,
          APPDATA: credentials,
          XDG_CONFIG_HOME: credentials,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      state.child = child;
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (code) =>
        resolve({
          code,
          stdout,
          stderr,
          ...(stdout.trim() ? { data: JSON.parse(stdout) } : {}),
        }),
      );
    });
  const baseline = async () => {
    const result = await cli("baseline");
    assert.equal(result.code, 0, result.stdout);
    return result.data.baseline.path;
  };
  return { cwd, tracker, state, cli, baseline };
}

async function addAgreedCards(c, count) {
  for (let id = 2; id <= count; id++) {
    const markdown = sheet(id);
    c.state.cards.push({
      externalId: String(id),
      cardId: randomUUID(),
      revision: "original",
      markdown,
    });
    await writeFile(path.join(c.tracker, `${id}.md`), markdown);
  }
}

test("clean 29-card sync needs one snapshot and leaves baseline and journal files untouched", async (t) => {
  const c = await setup(t);
  await addAgreedCards(c, 29);
  const baseline = await c.baseline();
  const before = await readFile(baseline, "utf8");
  const stateFiles = await readdir(path.dirname(baseline));
  c.state.requests.length = 0;
  const result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.data.clean, true);
  assert.equal(result.data.baseline.saved, false);
  assert.deepEqual(result.data.applied, []);
  assert.deepEqual(c.state.requests, ["GET /api/v1/boards/demo/test/sync"]);
  assert.equal(await readFile(baseline, "utf8"), before);
  assert.deepEqual(await readdir(path.dirname(baseline)), stateFiles);
});

test("one edit on a 29-card board only journals and rechecks the changed card", async (t) => {
  const c = await setup(t);
  await addAgreedCards(c, 29);
  await c.baseline();
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Local change.\n`);
  c.state.requests.length = 0;
  const result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.data.clean, true);
  assert.deepEqual(result.data.applied, ["1"]);
  assert.equal(
    c.state.requests.filter((request) => request.startsWith("GET")).length,
    4,
  );
  const journal = JSON.parse(await readFile(result.data.journal, "utf8"));
  assert.deepEqual(
    journal.entries.map((entry) => entry.intent.externalId),
    ["1"],
  );
  assert.equal((await c.cli("status")).data.clean, true);
});

test("a skipped card edited remotely during sync stays pending against its old baseline", async (t) => {
  const c = await setup(t);
  await addAgreedCards(c, 2);
  const baseline = await c.baseline();
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Local change.\n`);
  c.state.hook = async (req) => {
    if (req.method === "POST") {
      c.state.cards[1].markdown += "Concurrent hosted change.\n";
      c.state.cards[1].revision = "concurrent";
    }
  };
  const result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.data.clean, false);
  assert.equal(result.data.remaining.downloads, 1);
  assert.equal(await readFile(path.join(c.tracker, "2.md"), "utf8"), sheet(2));
  assert.equal(
    JSON.parse(await readFile(baseline, "utf8")).cards.find(
      (card) => card.externalId === "2",
    ).markdown,
    sheet(2),
  );
});

test("equal edits and revision-only changes still refresh the saved baseline", async (t) => {
  const c = await setup(t);
  const baseline = await c.baseline();
  for (const markdown of [
    `${sheet()}Agreed edit.\n`,
    `${sheet()}Agreed edit.\n`,
  ]) {
    await writeFile(path.join(c.tracker, "1.md"), markdown);
    c.state.cards[0].markdown = markdown;
    c.state.cards[0].revision = randomUUID();
    const result = await c.cli("sync");
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.data.clean, true);
    assert.equal(result.data.baseline.saved, true);
    const saved = JSON.parse(await readFile(baseline, "utf8")).cards[0];
    assert.equal(saved.markdown, markdown);
    assert.equal(saved.revision, c.state.cards[0].revision);
    assert.equal(c.state.writes, 0);
  }
});

test("clean sync still rejects tracker scheme violations", async (t) => {
  const c = await setup(t);
  await c.baseline();
  const file = path.join(c.cwd, "cardstock.json");
  const config = JSON.parse(await readFile(file, "utf8"));
  config.scheme = {
    required_keys: ["id", "title", "status", "tags"],
    statuses: ["backlog"],
    lanes: ["unsorted"],
    sizes: ["H", "M", "L"],
    priorities: ["1", "2", "3"],
    required_sections: ["## Missing section"],
  };
  await writeFile(file, JSON.stringify(config));
  const result = await c.cli("sync");
  assert.equal(result.code, 1, result.stdout);
  assert.ok(result.data.diagnostics.length);
  assert.equal(c.state.writes, 0);
});

test("sync merges disjoint edits, publishes both sides and advances a clean baseline", async (t) => {
  const c = await setup(t),
    baseline = await c.baseline();
  const local = sheet().replace("custom: original", "custom: local");
  await writeFile(path.join(c.tracker, "1.md"), local);
  c.state.cards[0].markdown = sheet().replace(
    "status: backlog",
    "status: held",
  );
  c.state.cards[0].revision = "2026-09-06T00:01:00.000Z";
  const result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.data.clean, true);
  const wanted = local.replace("status: backlog", "status: held");
  assert.equal(await readFile(path.join(c.tracker, "1.md"), "utf8"), wanted);
  assert.equal(c.state.cards[0].markdown, wanted);
  assert.equal(
    JSON.parse(await readFile(baseline, "utf8")).cards[0].markdown,
    wanted,
  );
  assert.equal(c.state.writes, 1);
  assert.equal((await c.cli("status")).data.clean, true);
});

test("delete previews named IDs only, preserves backups, and never recreates tombstones", async (t) => {
  const c = await setup(t);
  const baseline = await c.baseline();
  await writeFile(path.join(c.tracker, "2.md"), sheet(2));
  const before = await readFile(baseline, "utf8");
  const preview = await c.cli("delete", "1", "--dry-run");
  assert.equal(preview.code, 0, preview.stdout);
  assert.deepEqual(
    preview.data.cards.map((card) => card.externalId),
    ["1"],
  );
  assert.equal(preview.data.cards[0].action, "delete_remote");
  assert.equal(c.state.writes, 0);
  assert.equal(await readFile(baseline, "utf8"), before);
  const result = await c.cli("delete", "1");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(c.state.cards[0].deleted, true);
  assert.equal(c.state.writes, 1);
  assert.equal(result.data.remaining.uploads, 1); // #2 was not silently uploaded.
  assert.equal((await readdir(c.tracker)).includes("1.md"), false);
  const journal = JSON.parse(await readFile(result.data.journal, "utf8"));
  const backup = path.join(`${baseline}.backups`, journal.id, "1.md.before");
  assert.equal(await readFile(backup, "utf8"), sheet());
  assert.equal(
    (await readdir(c.tracker)).some((file) => file.endsWith(".before")),
    false,
  );
  assert.equal((await c.cli("delete", "1")).code, 0);
  assert.equal(c.state.writes, 1);
  await writeFile(path.join(c.tracker, "1.md"), sheet());
  const resurrect = await c.cli("sync", "--dry-run");
  assert.equal(resurrect.code, 1, resurrect.stdout);
  assert.equal(resurrect.data.counts.conflicts, 1);
});

test("bulk deletion accepts an explicit ID file and rejects ambiguous input before writes", async (t) => {
  const c = await setup(t);
  await c.baseline();
  for (const args of [
    [],
    ["0"],
    ["../1"],
    ["1", "1"],
    ["9007199254740993"],
    ["1", "--ours", "2"],
  ]) {
    assert.equal((await c.cli("delete", ...args)).code, 2);
  }
  const list = path.join(c.cwd, "deletions.txt");
  await writeFile(list, "# Reviewed deletion list\n\n1\n");
  assert.equal((await c.cli("delete", "1", "--file", list)).code, 2);
  const result = await c.cli("delete", "--file", list);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(c.state.writes, 1);
  assert.equal((await c.cli("status")).data.clean, true);
});

test("delete vs hosted edits requires a whole-card choice and keeps the chosen side", async (t) => {
  const c = await setup(t);
  await c.baseline();
  c.state.cards[0].markdown += "Hosted edit.\n";
  c.state.cards[0].revision = "edited";
  const blocked = await c.cli("delete", "1");
  assert.equal(blocked.code, 1, blocked.stdout);
  assert.equal(c.state.writes, 0);
  const keep = await c.cli("delete", "1", "--theirs", "1");
  assert.equal(keep.code, 0, keep.stdout);
  assert.match(
    await readFile(path.join(c.tracker, "1.md"), "utf8"),
    /Hosted edit/,
  );
  c.state.cards[0].markdown += "Another edit.\n";
  c.state.cards[0].revision = "edited-again";
  const deleted = await c.cli("delete", "1", "--ours", "1");
  assert.equal(deleted.code, 0, deleted.stdout);
  assert.equal(c.state.cards[0].deleted, true);
});

test("remote deletion removes unchanged local copies but conflicts with local edits", async (t) => {
  const c = await setup(t);
  await c.baseline();
  c.state.cards[0].deleted = true;
  c.state.cards[0].revision = "deleted";
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Local edit.\n`);
  const blocked = await c.cli("sync");
  assert.equal(blocked.code, 1, blocked.stdout);
  const restored = await c.cli("sync", "--ours", "1");
  assert.equal(restored.code, 0, restored.stdout);
  assert.equal(!!c.state.cards[0].deleted, false);
  assert.match(c.state.cards[0].markdown, /Local edit/);
  c.state.cards[0].deleted = true;
  c.state.cards[0].revision = "deleted-again";
  const deleted = await c.cli("sync");
  assert.equal(deleted.code, 0, deleted.stdout);
  assert.equal((await readdir(c.tracker)).includes("1.md"), false);
  assert.equal((await c.cli("status")).data.clean, true);
});

test("lost delete responses resume the same operation and preserve concurrent edits", async (t) => {
  const c = await setup(t);
  await c.baseline();
  c.state.drop = true;
  const first = await c.cli("delete", "1");
  assert.equal(first.code, 2);
  assert.equal(c.state.writes, 1);
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Concurrent edit.\n`);
  const blocked = await c.cli("sync", "--resume");
  assert.equal(blocked.code, 2, blocked.stdout);
  assert.match(
    await readFile(path.join(c.tracker, "1.md"), "utf8"),
    /Concurrent edit/,
  );
  await writeFile(path.join(c.tracker, "1.md"), sheet());
  const resumed = await c.cli("sync", "--resume");
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.equal(c.state.writes, 1);
  assert.equal((await c.cli("status")).data.clean, true);
});

test("bulk deletion resumes after a per-card deletion checkpoint", async (t) => {
  const c = await setup(t);
  c.state.cards.push({
    externalId: "2",
    cardId: randomUUID(),
    revision: "r2",
    markdown: sheet(2),
  });
  await writeFile(path.join(c.tracker, "2.md"), sheet(2));
  const baseline = await c.baseline();
  let killed = false;
  c.state.hook = async (req) => {
    if (!killed && req.method === "GET" && c.state.writes) {
      const saved = JSON.parse(await readFile(baseline, "utf8"));
      if (saved.cards.find((card) => card.externalId === "1")?.deleted) {
        killed = true;
        c.state.child.kill("SIGKILL");
      }
    }
  };
  assert.equal((await c.cli("delete", "1", "2")).code, null);
  assert.equal(await readFile(path.join(c.tracker, "2.md"), "utf8"), sheet(2));
  const resumed = await c.cli("sync", "--resume", "--recover-lock");
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.equal(resumed.data.clean, true);
  assert.equal(c.state.writes, 2);
  const journal = JSON.parse(await readFile(resumed.data.journal, "utf8"));
  assert.deepEqual(
    (await readdir(path.join(`${baseline}.backups`, journal.id))).sort(),
    ["1.md.before", "2.md.before"],
  );
});

test("new clients reject protocol 3 before deleting or modifying anything", async (t) => {
  const c = await setup(t);
  const baseline = await c.baseline();
  const before = await readFile(baseline, "utf8");
  c.state.protocol = 3;
  assert.equal((await c.cli("delete", "1", "--dry-run")).code, 2);
  assert.equal((await c.cli("delete", "1")).code, 2);
  assert.equal(c.state.writes, 0);
  assert.equal(await readFile(baseline, "utf8"), before);
  assert.equal(await readFile(path.join(c.tracker, "1.md"), "utf8"), sheet());
});

test("a stale deletion request preserves the live card and its local file", async (t) => {
  const c = await setup(t);
  await c.baseline();
  c.state.hook = async (req) => {
    if (req.method === "POST") c.state.cards[0].revision = "concurrent-edit";
  };
  const result = await c.cli("delete", "1");
  assert.equal(result.code, 2, result.stdout);
  assert.match(result.data.error, /revision changed/);
  assert.equal(c.state.writes, 0);
  assert.equal(!!c.state.cards[0].deleted, false);
  assert.equal(await readFile(path.join(c.tracker, "1.md"), "utf8"), sheet());
});

test("first contact with tombstones records absence without downloading deleted files", async (t) => {
  const c = await setup(t);
  c.state.cards[0].deleted = true;
  await rm(path.join(c.tracker, "1.md"));
  const synced = await c.cli("sync");
  assert.equal(synced.code, 0, synced.stdout);
  assert.equal(synced.data.clean, true);
  assert.equal(c.state.writes, 0);
  assert.deepEqual(await readdir(c.tracker), []);
  const state = JSON.parse(await readFile(synced.data.baseline.path, "utf8"));
  assert.equal(state.cards[0].deleted, true);
});

test("conflicts write nothing until explicit ours or theirs is chosen", async (t) => {
  const c = await setup(t);
  await c.baseline();
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Ours.\n`);
  c.state.cards[0].markdown = `${sheet()}Theirs.\n`;
  assert.equal((await c.cli("sync")).code, 1);
  assert.equal(c.state.writes, 0);
  const resolved = await c.cli("sync", "--theirs", "1:body");
  assert.equal(resolved.code, 0, resolved.stdout);
  assert.equal(
    await readFile(path.join(c.tracker, "1.md"), "utf8"),
    `${sheet()}Theirs.\n`,
  );
  assert.equal(c.state.writes, 0);
});

test("explicit audience downloads, uploads and defaults independently of legacy rules", async (t) => {
  const c = await setup(t);
  const configPath = path.join(c.cwd, "cardstock.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.mapping = {
    audience_internal_when: { tags: ["bug"], epics: ["Platform"] },
  };
  await writeFile(configPath, JSON.stringify(config));
  await c.baseline();
  c.state.cards[0].markdown = sheet().replace(
    "custom: original",
    "custom: original\naudience: internal",
  );
  let result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.data.clean, true);
  assert.match(
    await readFile(path.join(c.tracker, "1.md"), "utf8"),
    /audience: internal/,
  );
  await writeFile(path.join(c.tracker, "1.md"), sheet());
  result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.data.clean, true);
  assert.doesNotMatch(c.state.cards[0].markdown, /audience: internal/);
  assert.equal((await c.cli("status")).data.clean, true);
});

test("lost response resumes the same operation without duplicate writes or events", async (t) => {
  const c = await setup(t),
    baseline = await c.baseline(),
    before = await readFile(baseline, "utf8");
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Upload.\n`);
  c.state.drop = true;
  const failed = await c.cli("sync");
  assert.equal(failed.code, 2);
  assert.equal(c.state.writes, 1);
  assert.equal(await readFile(baseline, "utf8"), before);
  assert.equal((await c.cli("sync")).code, 2);
  assert.equal((await c.cli("baseline")).code, 2);
  const resumed = await c.cli("sync", "--resume");
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.equal(resumed.data.clean, true);
  assert.equal(c.state.writes, 1);
});

test("concurrent local edits are not overwritten after remote commit", async (t) => {
  const c = await setup(t);
  await c.baseline();
  await writeFile(
    path.join(c.tracker, "1.md"),
    sheet().replace("custom: original", "custom: local"),
  );
  c.state.cards[0].markdown = sheet().replace(
    "status: backlog",
    "status: held",
  );
  let done = false;
  c.state.hook = async (req) => {
    if (!done && req.method === "GET" && c.state.writes) {
      done = true;
      await writeFile(
        path.join(c.tracker, "1.md"),
        `${sheet()}Concurrent edit.\n`,
      );
    }
  };
  const result = await c.cli("sync");
  assert.equal(result.code, 2);
  assert.equal(
    await readFile(path.join(c.tracker, "1.md"), "utf8"),
    `${sheet()}Concurrent edit.\n`,
  );
  const aborted = await c.cli("sync", "--abort");
  assert.equal(aborted.code, 0, aborted.stdout);
  assert.equal(c.state.writes, 1);
});

test("stale server revision aborts writes and retains recovery intent", async (t) => {
  const c = await setup(t),
    baseline = await c.baseline(),
    before = await readFile(baseline, "utf8");
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Upload.\n`);
  c.state.hook = async (req) => {
    if (req.method === "POST")
      c.state.cards[0].revision = "2026-09-06T00:05:00.000Z";
  };
  const result = await c.cli("sync");
  assert.equal(result.code, 2);
  assert.match(result.data.error, /409/);
  assert.equal(c.state.writes, 0);
  assert.equal(await readFile(baseline, "utf8"), before);
});

test("new local and remote cards sync, missing files restore, missing remote IDs never delete", async (t) => {
  const c = await setup(t);
  await c.baseline();
  await writeFile(path.join(c.tracker, "2.md"), sheet(2));
  c.state.cards.push({
    externalId: "3",
    cardId: randomUUID(),
    revision: "2026-09-06T00:00:00.000Z",
    markdown: sheet(3),
  });
  let result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(await readFile(path.join(c.tracker, "3.md"), "utf8"), sheet(3));
  await rm(path.join(c.tracker, "1.md"));
  result = await c.cli("sync");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(await readFile(path.join(c.tracker, "1.md"), "utf8"), sheet());
  c.state.cards = c.state.cards.filter((card) => card.externalId !== "2");
  result = await c.cli("sync");
  assert.equal(result.code, 1);
  assert.equal(await readFile(path.join(c.tracker, "2.md"), "utf8"), sheet(2));
});

test("same external ID with a new UUID is an unresolvable identity conflict", async (t) => {
  const c = await setup(t);
  await c.baseline();
  c.state.cards[0].cardId = randomUUID();
  const result = await c.cli("sync");
  assert.equal(result.code, 1);
  assert.match(result.data.cards[0].reason, /identity_changed/);
  assert.equal((await c.cli("sync", "--ours", "1")).code, 2);
  assert.equal(c.state.writes, 0);
});

test("unsupported server cannot receive writes; legacy baseline adoption is explicit", async (t) => {
  const c = await setup(t),
    file = await c.baseline();
  c.state.protocol = 2;
  assert.equal((await c.cli("sync")).code, 2);
  assert.equal(c.state.writes, 0);
  c.state.protocol = 5;
  const baseline = JSON.parse(await readFile(file, "utf8"));
  delete baseline.cards[0].cardId;
  await writeFile(file, JSON.stringify(baseline));
  assert.equal((await c.cli("sync")).code, 2);
  const result = await c.cli("sync", "--adopt-identities");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(
    JSON.parse(await readFile(file, "utf8")).cards[0].cardId,
    c.state.cards[0].cardId,
  );
});

test("resume recovers a file moved to its before-image without losing the original", async (t) => {
  const c = await setup(t);
  await c.baseline();
  await writeFile(
    path.join(c.tracker, "1.md"),
    sheet().replace("custom: original", "custom: local"),
  );
  c.state.cards[0].markdown = sheet().replace(
    "status: backlog",
    "status: held",
  );
  c.state.drop = true;
  const failed = await c.cli("sync"),
    journal = JSON.parse(await readFile(failed.data.journal, "utf8"));
  // Simulate a journal written by an older CLI, which kept backups beside cards.
  delete journal.backups;
  await writeFile(failed.data.journal, JSON.stringify(journal));
  await rename(
    path.join(c.tracker, "1.md"),
    `${path.join(c.tracker, "1.md")}.cardstock-${journal.id}.before`,
  );
  const resumed = await c.cli("sync", "--resume");
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.equal(resumed.data.clean, true);
});

test("an active process lock is never stolen by recovery", async (t) => {
  const c = await setup(t),
    file = await c.baseline();
  await writeFile(
    `${file}.lock`,
    JSON.stringify({ pid: process.pid, hostname: os.hostname() }),
  );
  const result = await c.cli("sync", "--recover-lock");
  assert.equal(result.code, 2);
  assert.match(result.data.error, /still running/);
});

test("a killed CLI resumes after remote commit with the same receipt", async (t) => {
  const c = await setup(t);
  await c.baseline();
  await writeFile(
    path.join(c.tracker, "1.md"),
    `${sheet()}Upload before kill.\n`,
  );
  let killed = false;
  c.state.hook = async (req) => {
    if (!killed && req.method === "GET" && c.state.writes) {
      killed = true;
      c.state.child.kill("SIGKILL");
    }
  };
  const interrupted = await c.cli("sync");
  assert.equal(interrupted.code, null);
  assert.equal(c.state.writes, 1);
  const resumed = await c.cli("sync", "--resume", "--recover-lock");
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.equal(resumed.data.clean, true);
  assert.equal(c.state.writes, 1);
});

test("a killed CLI resumes from a per-card local/baseline checkpoint", async (t) => {
  const c = await setup(t);
  c.state.cards.push({
    externalId: "2",
    cardId: randomUUID(),
    revision: "2026-09-06T00:00:00.000Z",
    markdown: sheet(2),
  });
  await writeFile(path.join(c.tracker, "2.md"), sheet(2));
  const baseline = await c.baseline();
  c.state.cards = c.state.cards.map((card) => ({
    ...card,
    markdown: `${card.markdown}Remote checkpoint.\n`,
  }));
  let killed = false;
  c.state.hook = async (req) => {
    if (!killed && req.method === "GET") {
      const saved = JSON.parse(await readFile(baseline, "utf8"));
      if (
        saved.cards
          .find((card) => card.externalId === "1")
          ?.markdown.includes("Remote checkpoint.")
      ) {
        killed = true;
        c.state.child.kill("SIGKILL");
      }
    }
  };
  const interrupted = await c.cli("sync");
  assert.equal(interrupted.code, null);
  assert.equal(await readFile(path.join(c.tracker, "2.md"), "utf8"), sheet(2));
  const resumed = await c.cli("sync", "--resume", "--recover-lock");
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.equal(resumed.data.clean, true);
  assert.match(
    await readFile(path.join(c.tracker, "2.md"), "utf8"),
    /Remote checkpoint/,
  );
  assert.equal(
    (await readdir(c.tracker)).some((file) => file.endsWith(".before")),
    false,
  );
  const journal = JSON.parse(await readFile(resumed.data.journal, "utf8"));
  assert.equal(
    await readFile(
      path.join(
        `${resumed.data.baseline.path}.backups`,
        journal.id,
        "2.md.before",
      ),
      "utf8",
    ),
    sheet(2),
  );
});

test("single-card preview and apply isolate unrelated edits, conflicts and invalid Markdown", async (t) => {
  const c = await setup(t);
  await addAgreedCards(c, 4);
  const baseline = await c.baseline();
  const before = JSON.parse(await readFile(baseline, "utf8"));
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Selected upload.\n`);
  await writeFile(
    path.join(c.tracker, "2.md"),
    `${sheet(2)}Unrelated local edit.\n`,
  );
  c.state.cards[1].markdown = `${sheet(2)}Unrelated remote edit.\n`;
  await writeFile(path.join(c.tracker, "3.md"), "invalid yaml and Markdown");
  c.state.cards[3].markdown = "invalid remote Markdown";
  c.state.requests.length = 0;
  const preview = await c.cli("sync", "--card", "1", "--dry-run");
  assert.equal(preview.code, 0, preview.stdout);
  assert.equal(preview.data.card, "1");
  assert.deepEqual(
    preview.data.cards.map((card) => card.externalId),
    ["1"],
  );
  assert.deepEqual(c.state.requests, [
    "GET /api/v1/boards/demo/test/sync?card=1",
  ]);
  assert.deepEqual(JSON.parse(await readFile(baseline, "utf8")), before);
  const result = await c.cli("sync", "--card", "1");
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.data.clean, true);
  assert.equal(result.data.card, "1");
  assert.deepEqual(result.data.applied, ["1"]);
  assert.equal(c.state.writes, 1);
  const after = JSON.parse(await readFile(baseline, "utf8"));
  assert.deepEqual(after.cards.slice(1), before.cards.slice(1));
  assert.equal(
    await readFile(path.join(c.tracker, "2.md"), "utf8"),
    `${sheet(2)}Unrelated local edit.\n`,
  );
  assert.equal(
    await readFile(path.join(c.tracker, "3.md"), "utf8"),
    "invalid yaml and Markdown",
  );
  assert.ok(
    c.state.requests
      .filter((req) => req.startsWith("GET"))
      .every((req) => req.endsWith("?card=1")),
  );
  const status = await c.cli("status", "--card", "1");
  assert.equal(status.data.clean, true, status.stdout);
  c.state.requests.length = 0;
  const noop = await c.cli("sync", "--card", "1");
  assert.equal(noop.data.baseline.saved, false, noop.stdout);
  assert.deepEqual(c.state.requests, [
    "GET /api/v1/boards/demo/test/sync?card=1",
  ]);
});

test("single-card download and first contact preserve other baseline entries and retained originals", async (t) => {
  const c = await setup(t);
  await addAgreedCards(c, 2);
  const result = await c.cli("sync", "--card", "2");
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(
    JSON.parse(await readFile(result.data.baseline.path, "utf8")).cards.map(
      (card) => card.externalId,
    ),
    ["2"],
  );
  c.state.cards[0].markdown = `${sheet()}Downloaded change.\n`;
  const conflict = await c.cli("sync", "--card", "1");
  assert.equal(conflict.code, 1, conflict.stdout);
  const downloaded = await c.cli("sync", "--card", "1", "--theirs", "1:body");
  assert.equal(downloaded.code, 0, downloaded.stdout);
  assert.match(
    await readFile(path.join(c.tracker, "1.md"), "utf8"),
    /Downloaded change/,
  );
  const journal = JSON.parse(await readFile(downloaded.data.journal, "utf8"));
  const backup = path.join(
    `${downloaded.data.baseline.path}.backups`,
    journal.id,
    "1.md.before",
  );
  assert.equal(await readFile(backup, "utf8"), sheet());
  assert.deepEqual((await readdir(c.tracker)).sort(), ["1.md", "2.md"]);
});

test("single-card create and missing ID handling never select other cards", async (t) => {
  const c = await setup(t);
  await writeFile(path.join(c.tracker, "2.md"), sheet(2));
  assert.equal((await c.cli("sync", "--card", "2")).code, 0);
  c.state.cards.push({
    externalId: "3",
    cardId: randomUUID(),
    revision: "r3",
    markdown: sheet(3),
  });
  assert.equal((await c.cli("sync", "--card", "3")).code, 0);
  assert.equal(await readFile(path.join(c.tracker, "3.md"), "utf8"), sheet(3));
  for (const args of [
    ["sync", "--card", "99"],
    ["status", "--card", "99"],
    ["sync", "--card", "../1"],
    ["sync", "--card", "01"],
    ["baseline", "--card", "1"],
    ["sync", "--card", "1", "--resume"],
    ["sync", "--card", "1", "--abort"],
  ]) {
    const failed = await c.cli(...args);
    assert.equal(failed.code, 2, failed.stdout);
  }
});

test("single-card resume retains selection and retry ID on servers that ignore filtering", async (t) => {
  const c = await setup(t);
  await addAgreedCards(c, 2);
  await c.baseline();
  c.state.ignoreCardFilter = true;
  await writeFile(path.join(c.tracker, "1.md"), `${sheet()}Selected upload.\n`);
  await writeFile(path.join(c.tracker, "2.md"), "unrelated invalid file");
  c.state.drop = true;
  const failed = await c.cli("sync", "--card", "1");
  assert.equal(failed.code, 2, failed.stdout);
  const journal = JSON.parse(await readFile(failed.data.journal, "utf8"));
  assert.equal(journal.card, "1");
  assert.deepEqual(
    journal.entries.map((entry) => entry.intent.externalId),
    ["1"],
  );
  c.state.requests.length = 0;
  const resumed = await c.cli("sync", "--resume");
  assert.equal(resumed.code, 0, resumed.stdout);
  assert.equal(resumed.data.card, "1");
  assert.equal(c.state.receipts.size, 1);
  assert.equal(c.state.writes, 1);
  assert.ok(
    c.state.requests
      .filter((req) => req.startsWith("GET"))
      .every((req) => req.endsWith("?card=1")),
  );
});
