import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  unlink,
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
const sheet = `---
id: 1
title: Example
status: backlog
epic: Platform
area: UI
tags: [bug]
custom: original
---
# Example
## Ask
Preserve this content.
`;

async function setup(t) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-preview-"));
  const tracker = path.join(cwd, "tracker");
  const credentialsRoot = path.join(cwd, "credentials");
  await mkdir(tracker);
  await mkdir(path.join(credentialsRoot, "cardstock"), { recursive: true });
  await writeFile(path.join(tracker, "1.md"), sheet);
  const state = {
    metadata: {
      project: "demo",
      board: "backlog",
      etag: "v1",
      tagGroups: [{ key: "kind", tags: [{ key: "bug" }] }],
    },
    snapshot: {
      etag: "v1",
      cards: [{ externalId: "1", revision: "r1", markdown: sheet }],
    },
    status: 200,
    redirect: undefined,
    onRequest: undefined,
    requests: [],
  };
  const server = createServer(async (req, res) => {
    state.requests.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
    });
    try {
      if (state.onRequest) await state.onRequest(req);
      res.setHeader("content-type", "application/json");
      if (state.redirect) {
        res.writeHead(302, { location: state.redirect });
        res.end();
        return;
      }
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end("{}");
        return;
      }
      if (req.headers.authorization !== "Bearer test-token") {
        res.writeHead(401);
        res.end("{}");
        return;
      }
      res.writeHead(state.status);
      res.end(
        JSON.stringify(
          req.url.endsWith("/cards") ? state.snapshot : state.metadata,
        ),
      );
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(error) }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const remote = `http://127.0.0.1:${server.address().port}`;
  const credentials = path.join(
    credentialsRoot,
    "cardstock",
    "credentials.json",
  );
  await writeFile(
    credentials,
    JSON.stringify([
      {
        remote,
        token: "test-token",
        email: "test@example.test",
        createdAt: "2026-09-06",
      },
    ]),
  );
  const configPath = path.join(cwd, "cardstock.json");
  await writeFile(
    configPath,
    JSON.stringify({
      version: 1,
      project: "demo",
      board: "backlog",
      tracker: "tracker",
      remote,
    }),
  );
  async function cli(...args) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [entry, ...args], {
        cwd,
        env: {
          ...process.env,
          APPDATA: credentialsRoot,
          XDG_CONFIG_HOME: credentialsRoot,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
  }
  return { cwd, tracker, configPath, credentials, remote, state, cli };
}

test("status and dry-run are identical read-only previews; baseline is explicit", async (t) => {
  const ctx = await setup(t);
  const before = await readdir(ctx.cwd);
  const status = await ctx.cli("status", "--json");
  assert.equal(status.code, 0, status.stdout);
  const report = JSON.parse(status.stdout);
  assert.equal(report.clean, true);
  assert.equal(report.baseline.present, false);
  assert.deepEqual(await readdir(ctx.cwd), before);
  const dry = await ctx.cli("sync", "--dry-run", "--json");
  assert.deepEqual(JSON.parse(dry.stdout), report);
  const saved = await ctx.cli("baseline", "--json");
  assert.equal(saved.code, 0, saved.stdout);
  const file = JSON.parse(saved.stdout).baseline.path;
  const baselineBefore = await readFile(file, "utf8");
  assert.equal(JSON.parse(baselineBefore).cards[0].revision, "r1");
  assert.equal((await ctx.cli("status")).code, 0);
  assert.equal(await readFile(file, "utf8"), baselineBefore);
  assert.equal(await readFile(path.join(ctx.tracker, "1.md"), "utf8"), sheet);
  assert.ok(ctx.state.requests.every((request) => request.method === "GET"));
  const count = ctx.state.requests.length;
  const apply = await ctx.cli("sync", "--json");
  assert.equal(apply.code, 2);
  assert.match(JSON.parse(apply.stdout).error, /not implemented/);
  assert.equal(ctx.state.requests.length, count);
});

test("preview shows both directions and conflicts without advancing the baseline", async (t) => {
  const ctx = await setup(t);
  const initial = JSON.parse((await ctx.cli("baseline", "--json")).stdout);
  const before = await readFile(initial.baseline.path, "utf8");
  await writeFile(
    path.join(ctx.tracker, "1.md"),
    sheet.replace("custom: original", "custom: local"),
  );
  ctx.state.snapshot.cards[0].markdown = sheet.replace(
    "status: backlog",
    "status: held",
  );
  ctx.state.snapshot.cards[0].revision = "r2";
  const result = await ctx.cli("status", "--json");
  assert.equal(result.code, 0, result.stdout);
  assert.deepEqual(JSON.parse(result.stdout).counts, {
    uploads: 1,
    downloads: 1,
    equal: 0,
    conflicts: 0,
  });
  const rejected = await ctx.cli("baseline", "--json");
  assert.equal(rejected.code, 1);
  assert.equal(await readFile(initial.baseline.path, "utf8"), before);
  ctx.state.snapshot.cards[0].markdown = sheet.replace(
    "custom: original",
    "custom: remote",
  );
  const conflict = await ctx.cli("sync", "--dry-run", "--json");
  assert.equal(conflict.code, 1);
  assert.equal(JSON.parse(conflict.stdout).counts.conflicts, 1);
  assert.equal(await readFile(initial.baseline.path, "utf8"), before);
});

test("first contact reports differing identities and refuses baseline creation", async (t) => {
  const ctx = await setup(t);
  ctx.state.snapshot.cards[0].markdown = sheet.replace(
    "title: Example",
    "title: Different card",
  );
  const result = await ctx.cli("baseline", "--json");
  assert.equal(result.code, 1);
  assert.match(
    JSON.parse(result.stdout).cards[0].changes[0].reason,
    /identity_collision/,
  );
  assert.ok(!(await readdir(ctx.cwd)).includes(".cardstock"));
});

test("an empty tracker previews remote cards; an empty board previews local cards", async (t) => {
  const ctx = await setup(t);
  await unlink(path.join(ctx.tracker, "1.md"));
  const download = await ctx.cli("status", "--json");
  assert.equal(download.code, 0, download.stdout);
  assert.equal(JSON.parse(download.stdout).cards[0].action, "create_local");
  assert.deepEqual(await readdir(ctx.tracker), []);
  ctx.state.snapshot.cards = [];
  await writeFile(path.join(ctx.tracker, "1.md"), sheet);
  assert.equal(
    JSON.parse((await ctx.cli("status", "--json")).stdout).cards[0].action,
    "create_remote",
  );
});

test("credentials, permission failures and redirects never make writes or leak tokens", async (t) => {
  const ctx = await setup(t);
  for (const code of [401, 403, 404, 500]) {
    ctx.state.status = code;
    const result = await ctx.cli("status", "--json");
    assert.equal(result.code, 2);
    assert.ok(!result.stdout.includes("test-token"));
    assert.ok(!(await readdir(ctx.cwd)).includes(".cardstock"));
  }
  ctx.state.status = 200;
  ctx.state.redirect = `${ctx.remote}/unexpected`;
  const redirected = await ctx.cli("status", "--json");
  assert.equal(redirected.code, 2);
  assert.ok(
    ctx.state.requests.every((request) => request.url !== "/unexpected"),
  );
  await writeFile(ctx.credentials, "[]");
  const count = ctx.state.requests.length;
  const missing = await ctx.cli("status", "--json");
  assert.equal(missing.code, 2);
  assert.match(JSON.parse(missing.stdout).error, /Not signed in/);
  assert.equal(ctx.state.requests.length, count);
});

test("inconsistent snapshots and changing local files cause an explicit retry error", async (t) => {
  const ctx = await setup(t);
  ctx.state.snapshot.etag = "different";
  const result = await ctx.cli("status", "--json");
  assert.equal(result.code, 2);
  assert.match(JSON.parse(result.stdout).error, /changed while reading/);
  ctx.state.snapshot.etag = "v1";
  ctx.state.onRequest = async (req) => {
    if (req.url.endsWith("/cards"))
      await writeFile(
        path.join(ctx.tracker, "1.md"),
        `${sheet}Changed mid-preview.\n`,
      );
  };
  const localRace = await ctx.cli("status", "--json");
  assert.equal(localRace.code, 2);
  assert.match(JSON.parse(localRace.stdout).error, /Tracker files changed/);
  assert.ok(!(await readdir(ctx.cwd)).includes(".cardstock"));
});

test("corrupt and mismatched baselines fail without reset or overwrite", async (t) => {
  const ctx = await setup(t);
  const saved = JSON.parse((await ctx.cli("baseline", "--json")).stdout);
  const file = saved.baseline.path;
  const state = JSON.parse(await readFile(file, "utf8"));
  state.scope.board = "different";
  await writeFile(file, JSON.stringify(state));
  const mismatch = await ctx.cli("status", "--json");
  assert.equal(mismatch.code, 2);
  assert.match(JSON.parse(mismatch.stdout).error, /another board/);
  await writeFile(file, "broken");
  assert.equal((await ctx.cli("baseline", "--json")).code, 2);
  assert.equal(await readFile(file, "utf8"), "broken");
});

test("changed payloads with unchanged etags are retried instead of accepted", async (t) => {
  const ctx = await setup(t);
  let sequence = 0;
  ctx.state.onRequest = async (req) => {
    if (req.url.endsWith("/cards"))
      ctx.state.snapshot.cards[0].markdown = `${sheet}Edit ${++sequence}.\n`;
  };
  const result = await ctx.cli("status", "--json");
  assert.equal(result.code, 2);
  assert.match(JSON.parse(result.stdout).error, /changed while reading/);
  assert.ok(!(await readdir(ctx.cwd)).includes(".cardstock"));
});

test("board selection and metadata responses are validated", async (t) => {
  const ctx = await setup(t);
  ctx.state.metadata.board = "wrong";
  assert.match(
    JSON.parse((await ctx.cli("status", "--json")).stdout).error,
    /identity/,
  );
  ctx.state.metadata.board = "backlog";
  ctx.state.snapshot.cards.push(ctx.state.snapshot.cards[0]);
  assert.match(
    JSON.parse((await ctx.cli("status", "--json")).stdout).error,
    /duplicate remote/,
  );
  const remote = await ctx.cli(
    "status",
    "--remote",
    "https://user:password@example.test",
    "--json",
  );
  assert.equal(remote.code, 2);
  assert.match(JSON.parse(remote.stdout).error, /must not contain credentials/);
});

test("ours/theirs preview resolves only selected conflicts and never writes", async (t) => {
  const ctx = await setup(t);
  const saved = JSON.parse((await ctx.cli("baseline", "--json")).stdout);
  const baselineBefore = await readFile(saved.baseline.path, "utf8");
  const local = `${sheet.replace("custom: original", "custom: local")}Local body.\n`;
  const remote = `${sheet.replace("status: backlog", "status: held")}Remote body.\n`;
  await writeFile(path.join(ctx.tracker, "1.md"), local);
  ctx.state.snapshot.cards[0] = {
    externalId: "1",
    revision: "r2",
    markdown: remote,
  };
  for (const side of ["ours", "theirs"]) {
    const result = await ctx.cli(
      "sync",
      "--dry-run",
      `--${side}`,
      "1:body",
      "--json",
    );
    assert.equal(result.code, 0, result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.counts.conflicts, 0);
    const changes = report.cards[0].changes;
    assert.equal(
      changes.find((change) => change.field === "body").resolution,
      side,
    );
    assert.equal(
      changes.find((change) => change.field === "body").direction,
      side === "ours" ? "upload" : "download",
    );
    assert.equal(
      changes.find((change) => change.field === "frontmatter.custom").direction,
      "upload",
    );
    assert.equal(
      changes.find((change) => change.field === "frontmatter.status").direction,
      "download",
    );
  }
  assert.equal(
    (await ctx.cli("sync", "--dry-run", "--ours", "1", "--json")).code,
    0,
  );
  assert.equal((await ctx.cli("sync", "--dry-run", "--json")).code, 1);
  assert.equal(await readFile(saved.baseline.path, "utf8"), baselineBefore);
  assert.equal(await readFile(path.join(ctx.tracker, "1.md"), "utf8"), local);
  assert.ok(ctx.state.requests.every((request) => request.method === "GET"));
});

test("invalid and overlapping conflict selections are explicit errors", async (t) => {
  const ctx = await setup(t);
  await ctx.cli("baseline", "--json");
  await writeFile(path.join(ctx.tracker, "1.md"), `${sheet}Local body.\n`);
  ctx.state.snapshot.cards[0].markdown = `${sheet}Remote body.\n`;
  for (const flags of [
    ["--ours", "1", "--theirs", "1:body"],
    ["--ours", "2"],
    ["--theirs", "1:frontmatter.typo"],
    ["--ours", "../1"],
  ]) {
    const result = await ctx.cli("sync", "--dry-run", ...flags, "--json");
    assert.equal(result.code, 2, result.stdout);
    assert.equal(JSON.parse(result.stdout).ok, false);
  }
  assert.equal((await ctx.cli("baseline", "--ours", "1", "--json")).code, 2);
  assert.equal((await ctx.cli("status", "--theirs", "1", "--json")).code, 2);
});
