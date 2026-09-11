import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { materializeSync, stableJson } from "@cardstock/core";
import { localBackupPath, publishLocal } from "../src/sync-files";
import {
  JournalStore,
  prepareJournal,
  verifyLocal,
  verifyRemote,
} from "../src/sync-journal";

const sheet =
  "---\nid: 1\ntitle: Test\nstatus: backlog\nepic: Platform\narea: UI\ntags: [bug]\n---\n# Test\nOriginal body.\n";
const updated = sheet.replace("Original body.", "Changed body.");
const vocabulary = { tagGroups: [{ key: "kind", tags: [{ key: "bug" }] }] };
const scope = {
  remote: "https://example.test",
  project: "demo",
  board: "backlog",
  tracker: "tracker",
  mapping: "{}",
};
const baseline = {
  version: 1 as const,
  scope,
  etag: "v1",
  cards: [{ externalId: "1", file: "1.md", revision: "r1", markdown: sheet }],
};
const intents = materializeSync({
  local: [{ file: "1.md", markdown: updated }],
  remote: baseline.cards,
  baseline,
  vocabulary,
});
const observed = { externalId: "1", revision: "r2", markdown: updated };
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function setup() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cardstock-journal-"));
  directories.push(directory);
  const baselinePath = path.join(directory, ".cardstock", "scope.json");
  const store = new JournalStore(baselinePath, scope);
  const journal = prepareJournal(scope, JSON.stringify(baseline), intents);
  return { directory, baselinePath, store, journal };
}

describe("sync recovery journal", () => {
  test("state backups retain editor writes to displaced files and reject unsafe resume", async () => {
    const { directory, journal } = await setup();
    const file = path.join(directory, "1.md");
    const backups = path.join(directory, ".cardstock", "backups", journal.id);
    await writeFile(file, sheet);
    const editor = await open(file, "r+");
    try {
      await publishLocal(file, sheet, updated, journal.id, backups);
      expect(await readFile(file, "utf8")).toBe(updated);
      const backup = localBackupPath(file, journal.id, backups);
      expect(await readFile(backup, "utf8")).toBe(sheet);
      await editor.write("EDIT", 0, "utf8");
      await editor.sync();
      expect(await readFile(backup, "utf8")).toStartWith("EDIT");
      await expect(
        publishLocal(file, sheet, updated, journal.id, backups),
      ).rejects.toThrow("editor changed");
      expect(await readFile(file, "utf8")).toBe(updated);
    } finally {
      await editor.close();
    }
  });
  test("deletion verifies a matching tombstone and an absent file, never a live lookalike", () => {
    const card = {
      ...baseline.cards[0],
      cardId: "00000000-0000-4000-8000-000000000001",
    };
    const deletes = materializeSync({
      local: [{ file: "1.md", markdown: sheet }],
      remote: [card],
      baseline: { ...baseline, cards: [card] },
      vocabulary,
      deleteIds: ["1"],
    });
    const journal = prepareJournal(scope, JSON.stringify(baseline), deletes);
    expect(() => verifyRemote(journal, "1", card, vocabulary)).toThrow(
      "differs",
    );
    const dead = { ...card, deleted: true, revision: "deleted-r1" };
    expect(() =>
      verifyRemote(
        journal,
        "1",
        { ...dead, cardId: "00000000-0000-4000-8000-000000000002" },
        vocabulary,
      ),
    ).toThrow("differs");
    const remote = verifyRemote(journal, "1", dead, vocabulary);
    expect(() => verifyLocal(remote, "1", sheet)).toThrow("differs");
    expect(verifyLocal(remote, "1", null).entries[0].phase).toBe("verified");
  });
  test("reads are pure; prepare records original bytes, intent and scope without changing baseline", async () => {
    const { directory, store, journal } = await setup();
    expect(await store.read()).toBeNull();
    expect(await readdir(directory)).toEqual([]);
    await store.create(journal);
    expect(await store.read()).toEqual(journal);
    expect((await store.read())?.entries[0].intent.before.local).toBe(updated);
    expect(
      (await store.read())?.entries[0].intent.before.remote?.markdown,
    ).toBe(sheet);
    expect(await readdir(path.dirname(store.file))).toEqual([
      path.basename(store.file),
    ]);
  });
  test("acknowledgements cannot advance without verified remote content and exact local bytes", async () => {
    const { store, journal, baselinePath } = await setup();
    await store.create(journal);
    await writeFile(baselinePath, journal.baselineBefore!);
    expect(() => verifyLocal(journal, "1", updated)).toThrow(/out of order/);
    expect(() =>
      verifyRemote(journal, "1", { ...observed, markdown: sheet }, vocabulary),
    ).toThrow(/differs/);
    expect(() =>
      verifyRemote(journal, "1", { ...observed, externalId: "2" }, vocabulary),
    ).toThrow(/differs/);
    const remote = verifyRemote(journal, "1", observed, vocabulary);
    await store.replace(journal, remote);
    expect(() => verifyLocal(remote, "1", `${updated}\n`)).toThrow(/differs/);
    const verified = verifyLocal(remote, "1", updated);
    await store.replace(remote, verified);
    expect((await store.read())?.entries[0].phase).toBe("verified");
    expect(await readFile(baselinePath, "utf8")).toBe(journal.baselineBefore!);
    expect(journal.generation).toBe(0);
  });
  test("restart loads partial progress and original content; no blind reapplication", async () => {
    const { store, journal, baselinePath } = await setup();
    await store.create(journal);
    const remote = verifyRemote(journal, "1", observed, vocabulary);
    await store.replace(journal, remote);
    const restarted = new JournalStore(baselinePath, scope);
    const recovered = (await restarted.read())!;
    expect(recovered).toEqual(remote);
    expect(recovered.entries[0].intent.before.remote?.revision).toBe("r1");
    expect(() => verifyRemote(recovered, "1", observed, vocabulary)).toThrow(
      /out of order/,
    );
    await restarted.replace(recovered, verifyLocal(recovered, "1", updated));
  });
  test("stale generations and overlapping writers cannot replace newer progress", async () => {
    const { store, journal } = await setup();
    await store.create(journal);
    const remote = verifyRemote(journal, "1", observed, vocabulary);
    const results = await Promise.allSettled([
      store.replace(journal, remote),
      store.replace(journal, remote),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await store.read()).toEqual(remote);
    await expect(store.replace(journal, remote)).rejects.toThrow(/changed/);
    await expect(store.create(journal)).rejects.toThrow(/changed/);
  });
  test("crash-left locks and temp files remain available for operator inspection", async () => {
    const { store, journal } = await setup();
    await store.create(journal);
    await writeFile(`${store.file}.lock`, "crashed writer");
    await writeFile(`${store.file}.crashed.tmp`, "incomplete new data");
    const remote = verifyRemote(journal, "1", observed, vocabulary);
    await expect(store.replace(journal, remote)).rejects.toThrow();
    expect(await store.read()).toEqual(journal);
    expect(await readFile(`${store.file}.lock`, "utf8")).toBe("crashed writer");
    expect(await readFile(`${store.file}.crashed.tmp`, "utf8")).toBe(
      "incomplete new data",
    );
  });
  test("corrupt state and mismatched scope never reset or overwrite the journal", async () => {
    const { store, journal, baselinePath } = await setup();
    await store.create(journal);
    const other = new JournalStore(baselinePath, { ...scope, board: "other" });
    await expect(other.read()).rejects.toThrow(/another board/);
    await writeFile(store.file, "broken");
    await expect(store.read()).rejects.toThrow();
    await expect(store.create(journal)).rejects.toThrow();
    expect(await readFile(store.file, "utf8")).toBe("broken");
  });
  test("intent mutation, skipped verification and duplicate identities are rejected", async () => {
    const { store, journal } = await setup();
    await store.create(journal);
    const remote = verifyRemote(journal, "1", observed, vocabulary);
    const changed = structuredClone(remote);
    changed.entries[0].intent.after.local = sheet;
    await expect(store.replace(journal, changed)).rejects.toThrow(
      /preserve intent/,
    );
    const skipped = verifyLocal(remote, "1", updated);
    skipped.generation = 1;
    await expect(store.replace(journal, skipped)).rejects.toThrow(/skip/);
    expect(() => prepareJournal(scope, null, [...intents, ...intents])).toThrow(
      /identity/,
    );
    expect(stableJson(await store.read())).toBe(stableJson(journal));
  });
  test("an unreadable destination fails without replacing it or leaking an acquired lock", async () => {
    const { store, journal } = await setup();
    await mkdir(store.file, { recursive: true });
    await expect(store.create(journal)).rejects.toThrow();
    expect(await readdir(path.dirname(store.file))).toEqual([
      path.basename(store.file),
    ]);
  });
});
