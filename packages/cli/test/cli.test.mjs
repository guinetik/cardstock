import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const entry =
  process.env.CARDSTOCK_TEST_ENTRY ??
  fileURLToPath(new URL("../dist/index.js", import.meta.url));
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

const legacyFixtures = JSON.parse(
  await readFile(
    new URL("./fixtures/legacy-boards.json", import.meta.url),
    "utf8",
  ),
);

async function legacyWorkspace(fixture) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "cardstock-migration-"));
  const root = path.join(cwd, "old");
  await mkdir(path.join(root, "tracker"), { recursive: true });
  await mkdir(path.join(root, "cardstock"));
  await mkdir(path.dirname(path.join(cwd, fixture.board.scheme.scheme_doc)), {
    recursive: true,
  });
  await writeFile(
    path.join(cwd, fixture.board.scheme.scheme_doc),
    "# Tracker rules\n",
  );
  await writeFile(path.join(root, "board.json"), JSON.stringify(fixture.board));
  await writeFile(
    path.join(root, fixture.board.mapping),
    JSON.stringify(fixture.mapping),
  );
  await writeFile(
    path.join(root, fixture.board.seed),
    "-- Fixture only; must never execute.\n",
  );
  const scheme = fixture.board.scheme;
  const tags = [
    ...scheme.required_tags,
    ...Object.values(scheme.tag_groups)
      .filter((group) =>
        ["exactly-one", "at-least-one"].includes(group.cardinality),
      )
      .map((group) => group.tags[0]),
  ];
  const text = `---\r\nid: 1\r\ntitle: Synthetic migration example\r\nsummary: Preserve this tracker.\r\nstatus: wip\r\nlane: now\r\nepic: ${scheme.epics[0]}\r\narea: ${scheme.areas[0]}\r\ntags: [${tags.join(", ")}]\r\ncustom: preserved\r\n---\r\n## Ask\r\nKeep this content.\r\n## Status\r\nBeing built.\r\n`;
  await writeFile(path.join(root, "tracker", "1.md"), text);
  return { cwd, root, text };
}

for (const fixture of legacyFixtures)
  test(`migrate ${fixture.name}: preview, path rebasing, standalone validation and relocation`, async () => {
    const { cwd, root, text } = await legacyWorkspace(fixture);
    const sourceBefore = await readFile(path.join(root, "board.json"), "utf8");
    const preview = cli(
      cwd,
      "init",
      "--from",
      "old/board.json",
      "--dry-run",
      "--json",
    );
    assert.equal(preview.status, 0, preview.stdout);
    assert.deepEqual(
      await readdir(cwd),
      ["old", fixture.board.scheme.scheme_doc.split("/")[0]].sort(),
    );
    const result = JSON.parse(preview.stdout);
    assert.equal(result.dryRun, true);
    assert.equal(result.config.tracker, "old/tracker");
    assert.equal(
      result.config.scheme.scheme_doc,
      fixture.board.scheme.scheme_doc,
    );
    assert.deepEqual(result.config.mapping, fixture.mapping);
    assert.equal(result.config.provisioning.seed, `old/${fixture.board.seed}`);
    assert.ok(result.notes.some((note) => note.includes("no SQL is executed")));
    const created = cli(
      cwd,
      "init",
      "--from",
      "old/board.json",
      "--remote",
      "https://example.test",
      "--json",
    );
    assert.equal(created.status, 0, created.stdout);
    const config = JSON.parse(
      await readFile(path.join(cwd, "cardstock.json"), "utf8"),
    );
    assert.equal(config.remote, "https://example.test");
    assert.equal(
      cli(path.join(root, "tracker"), "validate", "--json").status,
      0,
    );
    assert.equal(
      await readFile(path.join(root, "tracker", "1.md"), "utf8"),
      text,
    );
    assert.equal(
      await readFile(path.join(root, "board.json"), "utf8"),
      sourceBefore,
    );
    assert.equal(cli(cwd, "init", "--from", "old/board.json").status, 2);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(cwd, "cardstock.json"), "utf8")),
      config,
    );
    const alternative = cli(
      root,
      "init",
      "--from",
      "board.json",
      "--out",
      "alternate.json",
      "--json",
    );
    assert.equal(alternative.status, 0, alternative.stdout);
    assert.equal(
      cli(cwd, "validate", "--config", "old/alternate.json", "--json").status,
      0,
    );
    const relocated = `${cwd}-relocated`;
    await rename(cwd, relocated);
    // Validation only needs the migrated config and tracker: legacy files are unused.
    await rename(
      path.join(relocated, "old", "board.json"),
      path.join(relocated, "old", "retired-board.json"),
    );
    await rename(
      path.join(relocated, "old", "cardstock"),
      path.join(relocated, "old", "retired-cardstock"),
    );
    const valid = cli(relocated, "validate", "--json");
    assert.equal(valid.status, 0, valid.stdout);
    assert.deepEqual(JSON.parse(valid.stdout), {
      ok: true,
      files: 1,
      diagnostics: [],
    });
  });

test("migration errors are actionable, structured and never create a destination", async () => {
  const { cwd, root } = await legacyWorkspace(legacyFixtures[0]);
  const source = path.join(root, "board.json");
  for (const [override, pattern] of [
    [{ unexpected: true }, /unexpected/],
    [{ mapping: "missing.json" }, /missing.json/],
    [{ seed: "missing.sql" }, /missing.sql/],
    [{ tracker: "missing-tracker" }, /missing-tracker/],
    [
      {
        scheme: {
          ...legacyFixtures[0].board.scheme,
          scheme_doc: "missing-doc.md",
        },
      },
      /scheme_doc/,
    ],
    [
      { scheme: { ...legacyFixtures[0].board.scheme, unexpected: true } },
      /unexpected/,
    ],
  ]) {
    await writeFile(
      source,
      JSON.stringify({ ...legacyFixtures[0].board, ...override }),
    );
    const result = cli(cwd, "init", "--from", "old/board.json", "--json");
    assert.equal(result.status, 2);
    assert.match(JSON.parse(result.stdout).error, pattern);
    assert.ok(!(await readdir(cwd)).includes("cardstock.json"));
  }
  await writeFile(source, JSON.stringify(legacyFixtures[0].board));
  await writeFile(
    path.join(root, legacyFixtures[0].board.mapping),
    JSON.stringify({ group_alias: {} }),
  );
  const invalidMapping = cli(cwd, "init", "--from", "old/board.json", "--json");
  assert.equal(invalidMapping.status, 2);
  assert.match(JSON.parse(invalidMapping.stdout).error, /group_alias/);
  assert.equal(
    cli(cwd, "init", "--from", "old/board.json", "--project", "other").status,
    2,
  );
  assert.ok(!(await readdir(cwd)).includes("cardstock.json"));
});

test("migrated validation catches a workflow mismatch with JSON and human diagnostics", async () => {
  const { cwd, root, text } = await legacyWorkspace(legacyFixtures[0]);
  assert.equal(cli(cwd, "init", "--from", "old/board.json").status, 0);
  await writeFile(
    path.join(root, "tracker", "1.md"),
    text.replace("lane: now", "lane: next"),
  );
  const invalid = cli(cwd, "validate", "--json");
  assert.equal(invalid.status, 1);
  assert.ok(
    JSON.parse(invalid.stdout).diagnostics.some(
      (d) => d.code === "status_lane" && d.field === "lane",
    ),
  );
  assert.match(cli(cwd, "validate").stderr, /README-scheme.md/);
  await writeFile(
    path.join(root, "tracker", "1.md"),
    text
      .replace("lane: now", "lane: next")
      .replace("status: wip", "status: held"),
  );
  assert.equal(cli(cwd, "validate").status, 0);
});
