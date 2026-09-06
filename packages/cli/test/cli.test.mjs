import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const sheet = `---
id: 1
title: A title: with a colon
status: backlog
epic: Platform
area: UI
tags: [bug]
custom: preserved
---
# A title
## Ask
Keep existing parsing conventions.
`;

function cli(cwd, ...args) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd,
    encoding: "utf8",
  });
  assert.ifError(result.error);
  return result;
}

test("init, parent discovery, offline validation and JSON diagnostics", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-validation-"));
  const tracker = path.join(cwd, "issues");
  await mkdir(tracker);
  const initialized = cli(
    cwd,
    "init",
    "--project",
    "demo",
    "--board",
    "backlog",
    "--dir",
    "issues",
  );
  assert.equal(initialized.status, 0, initialized.stderr);
  const before = await readFile(path.join(cwd, "cardstock.json"), "utf8");
  assert.equal(
    cli(cwd, "init", "--project", "other", "--board", "other").status,
    2,
  );
  assert.equal(
    await readFile(path.join(cwd, "cardstock.json"), "utf8"),
    before,
  );
  await writeFile(path.join(tracker, "1.md"), sheet);
  await writeFile(
    path.join(tracker, "README.md"),
    "Documentation is not an issue.",
  );
  const valid = cli(tracker, "validate", "--json");
  assert.equal(valid.status, 0, valid.stdout);
  assert.deepEqual(JSON.parse(valid.stdout), {
    ok: true,
    files: 1,
    diagnostics: [],
  });
  assert.equal(await readFile(path.join(tracker, "1.md"), "utf8"), sheet);
  await writeFile(path.join(tracker, "2.md"), sheet);
  await writeFile(path.join(tracker, "3.md"), "broken frontmatter");
  const invalid = cli(cwd, "validate", "--json");
  assert.equal(invalid.status, 1);
  const report = JSON.parse(invalid.stdout);
  assert.equal(report.files, 3);
  assert.equal(report.diagnostics.length, 3);
  assert.match(report.diagnostics[0].message, /Duplicate id/);
  const explicit = cli(
    tracker,
    "validate",
    "--config",
    "../cardstock.json",
    "--json",
  );
  assert.deepEqual(JSON.parse(explicit.stdout), report);
});

test("configuration errors and unsupported arguments fail without writes", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-config-"));
  assert.equal(cli(cwd, "init", "--project", "demo").status, 2);
  assert.equal(cli(cwd, "validate", "--unknown").status, 2);
  assert.equal(cli(cwd, "sync").status, 2);
  await writeFile(
    path.join(cwd, "cardstock.json"),
    JSON.stringify({ version: 99 }),
  );
  const invalid = cli(cwd, "validate", "--json");
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stdout).ok, false);
  await writeFile(
    path.join(cwd, "cardstock.json"),
    JSON.stringify({
      version: 1,
      project: "demo",
      board: "backlog",
      tracker: ".",
    }),
  );
  const empty = cli(cwd, "validate", "--json");
  assert.equal(empty.status, 2);
  assert.match(JSON.parse(empty.stdout).error, /No <id>.md files/);
});

test("help documents browser sign-in and its options", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-help-"));
  const general = cli(cwd, "--help");
  assert.equal(general.status, 0, general.stderr);
  assert.match(general.stdout, /login --remote <url> \[--no-browser\]/);
  const login = cli(cwd, "login", "--help");
  assert.equal(login.status, 0, login.stderr);
  assert.match(login.stdout, /Sign in through Cardstock in your browser/);
  assert.match(login.stdout, /--no-browser/);
});
