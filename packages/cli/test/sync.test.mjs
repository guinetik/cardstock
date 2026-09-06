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
    protocol: 2,
    drop: false,
    revision: 0,
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
        res.end(JSON.stringify(snapshot()));
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
      const receipt = { protocol: 2, operationId: body.operationId, applied };
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
  c.state.protocol = 1;
  assert.equal((await c.cli("sync")).code, 2);
  assert.equal(c.state.writes, 0);
  c.state.protocol = 2;
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
  assert.ok(
    (await readdir(c.tracker)).some((file) => file.endsWith(".before")),
  );
});
