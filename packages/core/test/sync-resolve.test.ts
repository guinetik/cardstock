import { describe, expect, test } from "bun:test";
import {
  materializeSync,
  parseConflictSelections,
  planSync,
  resolveSyncConflicts,
} from "../src";

const sheet =
  "---\nid: 1\ntitle: Test\nstatus: backlog\nepic: Platform\narea: UI\ntags: [bug]\ncustom: original\n---\n# Test\nOriginal body.\n";
const vocabulary = { tagGroups: [{ key: "kind", tags: [{ key: "bug" }] }] };
const baseline = {
  version: 1 as const,
  scope: {
    remote: "https://example.test",
    project: "demo",
    board: "backlog",
    tracker: "tracker",
    mapping: "{}",
  },
  etag: "v1",
  cards: [{ externalId: "1", file: "1.md", revision: "r1", markdown: sheet }],
};
const local = sheet
  .replace("Original body.", "Local body.")
  .replace("custom: original", "custom: local");
const remote = sheet
  .replace("Original body.", "Remote body.")
  .replace("status: backlog", "status: held");
const input = {
  local: [{ file: "1.md", markdown: local }],
  remote: [{ externalId: "1", revision: "r2", markdown: remote }],
  baseline,
  vocabulary,
};

describe("ours/theirs conflict resolution", () => {
  test("ours resolves only conflicting fields and retains remote-only changes", () => {
    const plan = planSync(input);
    const before = structuredClone(plan);
    const result = resolveSyncConflicts(plan, [
      { externalId: "1", side: "ours" },
    ]);
    expect(result.counts).toEqual({
      uploads: 1,
      downloads: 1,
      conflicts: 0,
      equal: 0,
    });
    expect(
      result.cards[0].changes.find((change) => change.field === "body")
        ?.resolution,
    ).toBe("ours");
    const [intent] = materializeSync(input, [
      { externalId: "1", side: "ours" },
    ]);
    expect(intent.after.local).toBe(
      local.replace("status: backlog", "status: held"),
    );
    expect(intent.after.remote).toBe(intent.after.local);
    expect(intent.resolutions).toEqual([{ field: "body", side: "ours" }]);
    expect(plan).toEqual(before);
  });
  test("theirs accepts remote conflict value without discarding local-only changes", () => {
    const [intent] = materializeSync(input, [
      { externalId: "1", field: "body", side: "theirs" },
    ]);
    expect(intent.after.local).toBe(
      remote.replace("custom: original", "custom: local"),
    );
    expect(intent.after.remote).toBe(intent.after.local);
  });
  test("unselected conflicts remain unresolved", () => {
    const both = {
      ...input,
      remote: [
        {
          ...input.remote[0],
          markdown: remote.replace("custom: original", "custom: remote"),
        },
      ],
    };
    const result = resolveSyncConflicts(planSync(both), [
      { externalId: "1", field: "body", side: "ours" },
    ]);
    expect(result.counts.conflicts).toBe(1);
    expect(() =>
      materializeSync(both, [{ externalId: "1", field: "body", side: "ours" }]),
    ).toThrow(/unresolved/);
    const [intent] = materializeSync(both, [
      { externalId: "1", field: "body", side: "ours" },
      { externalId: "1", field: "frontmatter.custom", side: "theirs" },
    ]);
    expect(intent.after.local).toContain("Local body.");
    expect(intent.after.local).toContain("custom: remote");
  });
  test("typos, duplicate or overlapping selections fail rather than silently doing nothing", () => {
    const plan = planSync(input);
    expect(() =>
      resolveSyncConflicts(plan, [{ externalId: "2", side: "ours" }]),
    ).toThrow(/No conflict/);
    expect(() =>
      resolveSyncConflicts(plan, [
        { externalId: "1", field: "frontmatter.status", side: "theirs" },
      ]),
    ).toThrow(/No matching/);
    expect(() =>
      resolveSyncConflicts(plan, [
        { externalId: "1", side: "ours" },
        { externalId: "1", field: "body", side: "theirs" },
      ]),
    ).toThrow(/more than once/);
    expect(() => parseConflictSelections(["../1"])).toThrow(/Use --ours/);
    expect(parseConflictSelections(["1:body"], ["2"])).toEqual([
      { externalId: "1", field: "body", side: "ours" },
      { externalId: "2", side: "theirs" },
    ]);
  });
  test("choosing content cannot override missing or ambiguous identity", () => {
    const missing = planSync({ ...input, remote: [] });
    expect(() =>
      resolveSyncConflicts(missing, [{ externalId: "1", side: "ours" }]),
    ).toThrow(/identity/);
    const collision = planSync({
      ...input,
      baseline: undefined,
      remote: [
        {
          ...input.remote[0],
          markdown: remote.replace("title: Test", "title: Different"),
        },
      ],
    });
    expect(() =>
      resolveSyncConflicts(collision, [{ externalId: "1", side: "theirs" }]),
    ).toThrow(/identity/);
  });
});
