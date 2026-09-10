import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const entry =
  process.env.CARDSTOCK_TEST_ENTRY ??
  fileURLToPath(new URL("../dist/index.js", import.meta.url));

const sheet = `---
id: 4
title: Example
summary: An example card.
status: backlog
epic: Board & cards
area: UI
tags:
  - enhancement
lane: unsorted
---
# #4 — Example

## Ask

An example card.

## Status

Filed.
`;

const scheme = {
  required_keys: ["id", "title", "status", "epic", "area", "tags"],
  statuses: ["backlog", "wip", "built", "shipped", "done"],
  closed_statuses: ["shipped", "done"],
  lanes: ["unsorted", "now", "building", "shipped", "done"],
  lanes_for_status: { wip: ["now"], built: ["building"] },
  now_lane_requires_status: "wip",
  epics: ["Board & cards"],
  areas: ["UI"],
  tag_groups: {
    kind: {
      cardinality: "exactly-one",
      tags: ["bug", "enhancement"],
    },
    surface: { cardinality: "at-most-one", tags: ["board", "card"] },
  },
  sizes: ["H", "M", "L"],
  priorities: ["1", "2", "3"],
  required_sections: ["## Ask", "## Status"],
};

async function setup(t, { cards, syncProtocol = 5 } = {}) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-new-"));
  const tracker = path.join(cwd, "tracker");
  const credentialsRoot = path.join(cwd, "credentials");
  await mkdir(tracker);
  await mkdir(path.join(credentialsRoot, "cardstock"), { recursive: true });
  await writeFile(path.join(tracker, "4.md"), sheet);

  const state = {
    cards: cards ?? [{ externalId: "4", revision: "r1", markdown: sheet }],
    requests: [],
  };
  const server = createServer((req, res) => {
    state.requests.push(req.url);
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "Bearer test-token") {
      res.writeHead(401);
      res.end("{}");
      return;
    }
    const metadata = {
      syncProtocol,
      project: "demo",
      board: "backlog",
      etag: "v1",
      tagGroups: [{ key: "kind", tags: [{ key: "enhancement" }] }],
    };
    res.writeHead(200);
    res.end(
      JSON.stringify(
        req.url.endsWith("/sync") || req.url.endsWith("/cards")
          ? { ...metadata, etag: "v1", cards: state.cards }
          : metadata,
      ),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const remote = `http://127.0.0.1:${server.address().port}`;

  await writeFile(
    path.join(credentialsRoot, "cardstock", "credentials.json"),
    JSON.stringify([
      {
        remote,
        token: "test-token",
        email: "test@example.test",
        createdAt: "2026-09-09",
      },
    ]),
  );
  await writeFile(
    path.join(cwd, "cardstock.json"),
    JSON.stringify({
      version: 1,
      project: "demo",
      board: "backlog",
      tracker: "tracker",
      remote,
      scheme,
    }),
  );

  function cli(...args) {
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
  return { cwd, tracker, cli, state };
}

test("allocates the next ID above local and hosted cards", async (t) => {
  const { tracker, cli } = await setup(t, {
    cards: [
      { externalId: "4", revision: "r1", markdown: sheet },
      { externalId: "11", revision: "r2", markdown: sheet },
    ],
  });
  const result = await cli(
    "new",
    "Cards do not show how old they are",
    "--json",
  );
  assert.equal(result.code, 0, result.stderr);
  const { ok, id, file } = JSON.parse(result.stdout);
  assert.equal(ok, true);
  assert.equal(id, 12);
  assert.equal(file, "tracker/12.md");

  const text = await readFile(path.join(tracker, "12.md"), "utf8");
  assert.match(text, /^id: 12$/m);
  assert.match(text, /^title: "Cards do not show how old they are"$/m);
  assert.match(text, /^status: backlog$/m);
  assert.match(text, /^lane: unsorted$/m);
  assert.match(text, /^# #12 — Cards do not show how old they are$/m);
  // summary defaults to the title so an open item validates.
  assert.match(text, /^summary: "Cards do not show how old they are"$/m);
});

test("a deleted card's ID stays reserved", async (t) => {
  const { cli } = await setup(t, {
    cards: [
      { externalId: "4", revision: "r1", markdown: sheet },
      { externalId: "30", revision: "r2", markdown: "", deleted: true },
    ],
  });
  const result = await cli("new", "Another ask", "--json");
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).id, 31);
});

test("a clean board ending at 13 allocates 14, then counts the unsynced local card", async (t) => {
  const { cli } = await setup(t, {
    cards: [13, 2, 9, 1].map((id) => ({
      externalId: String(id),
      revision: `r${id}`,
      markdown: sheet,
    })),
  });
  const first = await cli("new", "Checklist review", "--json");
  assert.equal(first.code, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).id, 14);
  const second = await cli("new", "Next review", "--json");
  assert.equal(second.code, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).id, 15);
});

test("overrides land in the frontmatter", async (t) => {
  const { tracker, cli } = await setup(t);
  const result = await cli(
    "new",
    "Board is slow to load",
    "--summary",
    "Hap says the board takes ages to appear.",
    "--tags",
    "bug,board",
    "--area",
    "Platform",
    "--effort",
    "M",
    "--priority",
    "1",
    "--json",
  );
  assert.equal(result.code, 0, result.stderr);
  const text = await readFile(path.join(tracker, "5.md"), "utf8");
  assert.match(text, /^summary: "Hap says the board takes ages to appear\."$/m);
  assert.match(text, /^ {2}- bug$/m);
  assert.match(text, /^ {2}- board$/m);
  assert.match(text, /^area: "Platform"$/m);
  assert.match(text, /^effort: M$/m);
  assert.match(text, /^priority: 1$/m);
});

test("refuses a card the scheme would reject, and writes nothing", async (t) => {
  const { tracker, cli } = await setup(t);
  const result = await cli("new", "Bad tags", "--tags", "not-a-real-tag");
  assert.equal(result.code, 1);
  assert.match(result.stderr, /not-a-real-tag|kind/i);
  assert.deepEqual((await readdir(tracker)).sort(), ["4.md"]);
});

test("refuses to guess an ID without the board", async (t) => {
  const { tracker, cwd, cli } = await setup(t);
  await writeFile(
    path.join(cwd, "cardstock.json"),
    JSON.stringify({
      version: 1,
      project: "demo",
      board: "backlog",
      tracker: "tracker",
      scheme,
    }),
  );
  const result = await cli("new", "No remote here");
  assert.equal(result.code, 2);
  assert.match(result.stderr, /No remote configured/);
  assert.deepEqual((await readdir(tracker)).sort(), ["4.md"]);
});

test("requires exactly one quoted title", async (t) => {
  const { cli } = await setup(t);
  const result = await cli("new", "Two", "Words");
  assert.equal(result.code, 2);
  assert.match(result.stderr, /exactly one title/);
});
