import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { admin } from "./support/sign-in";

/**
 * Lane is board state, and two writers can move a card: a person dragging it,
 * and a file declaring `lane:`. Whoever writes last must not silently undo the
 * other, so the importer merges against a base — the lane the file claimed at
 * the last sync — instead of comparing the file to where the card sits.
 *
 * These are the two halves of that rule. Both have to hold at once, which is
 * why they are one file: a fix for either that breaks the other is not a fix.
 *
 * Runs against the demo board and a private copy of examples/tracker, so it
 * never touches a real tracker, and puts the card back when it is done.
 */

const CARD = "3";
let dir = "";
let boardId = "";
let laneByKey = new Map<string, string>();
let keyByLane = new Map<string, string>();

/** Run the importer against the throwaway tracker copy. */
function importTracker() {
  const r = spawnSync(
    process.platform === "win32" ? "bun.exe" : "bun",
    [
      "run",
      "etl/import.ts",
      "--project",
      "demo",
      "--board",
      "backlog",
      "--source",
      dir,
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (r.status !== 0)
    throw new Error(`import failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

function exportTracker() {
  const r = spawnSync(
    process.platform === "win32" ? "bun.exe" : "bun",
    [
      "run",
      "etl/export.ts",
      "--project",
      "demo",
      "--board",
      "backlog",
      "--source",
      dir,
    ],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  if (r.status !== 0)
    throw new Error(`export failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

/** Rewrite the card file's `lane:` the way an agent finishing work would. */
function setFileLane(lane: string) {
  const file = path.join(dir, `${CARD}.md`);
  const text = readFileSync(file, "utf8");
  const next = /^lane:.*$/m.test(text)
    ? text.replace(/^lane:.*$/m, `lane: ${lane}`)
    : text.replace(/^---\n/, `---\nlane: ${lane}\n`);
  writeFileSync(file, next, "utf8");
  // The importer skips a file whose hash is unchanged; rewriting the lane
  // changes it, which is exactly what makes this a real edit.
}

/**
 * Edit the file's prose, leaving `lane:` alone.
 *
 * This is the case the merge exists for — an agent rewrites a Status section
 * while the card sits where someone dragged it — and it is the only way to
 * reach the merge at all: the importer skips a file whose hash is unchanged,
 * so a test that re-imports an untouched file exercises nothing.
 */
function touchFile() {
  const file = path.join(dir, `${CARD}.md`);
  writeFileSync(
    file,
    `${readFileSync(file, "utf8").trimEnd()}\n\nAgent note ${Date.now()}.\n`,
    "utf8",
  );
}

function fileLane(): string | null {
  const text = readFileSync(path.join(dir, `${CARD}.md`), "utf8");
  return text.match(/^lane:\s*(\S+)\s*$/m)?.[1] ?? null;
}

async function card() {
  const { data } = await admin
    .from("cards")
    .select("id, lane_id, lane_from_source")
    .eq("board_id", boardId)
    .eq("external_id", CARD)
    .single();
  return {
    id: data?.id as string,
    lane: keyByLane.get(data?.lane_id ?? "") ?? null,
    base: (data?.lane_from_source as string | null) ?? null,
  };
}

/** Move the card the way a person dragging it in the UI does. */
async function drag(to: string) {
  const { id } = await card();
  const { error } = await admin
    .from("cards")
    .update({ lane_id: laneByKey.get(to) })
    .eq("id", id);
  expect(error).toBeNull();
}

test.beforeAll(async () => {
  const { data: board } = await admin
    .from("boards")
    .select("id, projects!inner(slug)")
    .eq("slug", "backlog")
    .eq("projects.slug", "demo")
    .single();
  boardId = board?.id as string;
  const { data: lanes } = await admin
    .from("lanes")
    .select("id, key")
    .eq("board_id", boardId);
  laneByKey = new Map((lanes ?? []).map((l) => [l.key as string, l.id]));
  keyByLane = new Map((lanes ?? []).map((l) => [l.id, l.key as string]));

  dir = mkdtempSync(path.join(tmpdir(), "cardstock-tracker-"));
  const src = path.join(process.cwd(), "examples", "tracker");
  const { readdirSync, copyFileSync } = await import("node:fs");
  for (const f of readdirSync(src).filter((f) => f.endsWith(".md")))
    copyFileSync(path.join(src, f), path.join(dir, f));
});

/**
 * Put the card, its file and its merge base into one known state.
 *
 * Without this a test reads as passing when it only inherited the answer from
 * whatever ran before it: an import that is *meant* to move a card does nothing
 * when the base already matches the lane the file names.
 */
test.beforeEach(async () => {
  setFileLane("unsorted");
  const { id } = await card();
  await admin
    .from("cards")
    .update({
      lane_id: laneByKey.get("unsorted"),
      lane_from_source: "unsorted",
    })
    .eq("id", id);
});

test.afterAll(async () => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  // Put the demo board back the way the suite's reset left it.
  spawnSync(
    process.platform === "win32" ? "bun.exe" : "bun",
    ["run", "etl/e2e-reset.ts"],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
});

test("a file that changes its lane moves the card", async () => {
  setFileLane("now");
  importTracker();
  expect((await card()).lane).toBe("now");

  // An agent finishing work writes a new lane; the card follows.
  setFileLane("done");
  importTracker();
  const after = await card();
  expect(after.lane).toBe("done");
  expect(after.base).toBe("done");
});

test("a drag survives an import whose file has not changed its mind", async () => {
  setFileLane("now");
  importTracker();
  expect((await card()).base).toBe("now");

  // Someone drags the card onward. The file still says `now` — it is silent
  // about the move, and silence must not be read as a request to undo it.
  await drag("next");
  expect((await card()).lane).toBe("next");

  // An agent then rewrites the card's prose. The file changes, so the importer
  // has real work to do; its `lane:` does not, so it has no opinion on where
  // the card sits.
  touchFile();
  importTracker();
  expect((await card()).lane).toBe("next");

  // Still true on a second run: this must not be a one-import reprieve.
  touchFile();
  importTracker();
  expect((await card()).lane).toBe("next");
});

test("an export makes the file agree and does not move the card back", async () => {
  setFileLane("now");
  importTracker();
  await drag("later");

  exportTracker();
  expect(fileLane()).toBe("later");
  expect((await card()).base).toBe("later");

  // The lane the export just wrote must not read as the file moving the card.
  touchFile();
  importTracker();
  expect((await card()).lane).toBe("later");
});

test("status does not decide the lane", async () => {
  // Two imports of the same file differing only in status must not move it.
  setFileLane("now");
  importTracker();
  const file = path.join(dir, `${CARD}.md`);
  for (const status of ["wip", "built", "shipped", "done"]) {
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(/^status:.*$/m, `status: ${status}`),
      "utf8",
    );
    importTracker();
    expect((await card()).lane).toBe("now");
  }
});
