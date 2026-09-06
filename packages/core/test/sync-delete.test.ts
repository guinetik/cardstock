import { describe, expect, test } from "bun:test";
import { materializeSync } from "../src/sync-materialize";
import { type Baseline, planSync, type RemoteCard } from "../src/sync-plan";
import { resolveSyncConflicts } from "../src/sync-resolve";

const markdown =
  "---\nid: 1\ntitle: Example\nstatus: backlog\narea: UI\ntags: []\n---\nOriginal.\n";
const card: RemoteCard = {
  externalId: "1",
  cardId: "00000000-0000-4000-8000-000000000001",
  revision: "r1",
  markdown,
};
const baseline: Baseline = {
  version: 1,
  scope: {
    remote: "https://example.test",
    project: "test",
    board: "test",
    tracker: ".",
    mapping: "{}",
  },
  etag: "r1",
  cards: [{ ...card, file: "1.md" }],
};
const input = () => ({
  local: [{ file: "1.md", markdown }],
  remote: [card],
  baseline,
  vocabulary: { tagGroups: [] },
});

describe("explicit deletion planning", () => {
  test("missing files still restore; explicit deletion requires immutable baseline", () => {
    expect(planSync({ ...input(), local: [] }).cards[0].action).toBe(
      "create_local",
    );
    expect(() =>
      planSync({ ...input(), baseline: undefined, deleteIds: ["1"] }),
    ).toThrow("baseline");
    expect(() => planSync({ ...input(), deleteIds: ["2"] })).toThrow(
      "no remote identity",
    );
  });
  test("explicit deletion produces a recoverable null local outcome", () => {
    const request = { ...input(), deleteIds: ["1"] };
    expect(planSync(request).cards[0].action).toBe("delete_remote");
    expect(materializeSync(request)[0]).toMatchObject({
      before: { local: markdown, remote: card },
      after: { local: null, deleted: true },
      writeRemote: true,
      writeLocal: true,
    });
  });
  test("delete vs hosted edit has explicit delete and keep resolutions", () => {
    const request = {
      ...input(),
      deleteIds: ["1"],
      remote: [{ ...card, markdown: `${markdown}Remote edit.\n` }],
    };
    expect(planSync(request).counts.conflicts).toBe(1);
    expect(
      materializeSync(request, [{ externalId: "1", side: "ours" }])[0].after
        .local,
    ).toBeNull();
    const keep = materializeSync(request, [
      { externalId: "1", side: "theirs" },
    ])[0];
    expect(keep.after.local).toBe(request.remote[0].markdown);
    expect(keep.writeRemote).toBe(false);
  });
  test("remote tombstone downloads only when local content is unchanged", () => {
    const request = { ...input(), remote: [{ ...card, deleted: true }] };
    expect(planSync(request).cards[0].action).toBe("delete_local");
    expect(materializeSync(request)[0]).toMatchObject({
      after: { local: null, deleted: true },
      writeRemote: false,
    });
    expect(planSync({ ...request, local: [] }).clean).toBe(true);
    expect(planSync({ ...request, baseline: undefined }).counts.conflicts).toBe(
      1,
    );
  });
  test("ours restores a locally edited survivor with the same remote identity", () => {
    const request = {
      ...input(),
      local: [{ file: "1.md", markdown: `${markdown}Edit.\n` }],
      remote: [{ ...card, deleted: true }],
    };
    const plan = resolveSyncConflicts(planSync(request), [
      { externalId: "1", side: "ours" },
    ]);
    expect(plan.cards[0].action).toBe("restore_remote");
    expect(
      materializeSync(request, [{ externalId: "1", side: "ours" }])[0],
    ).toMatchObject({
      before: { remote: { cardId: card.cardId, deleted: true } },
      after: { local: request.local[0].markdown, deleted: false },
      writeRemote: true,
    });
    expect(
      materializeSync(request, [{ externalId: "1", side: "theirs" }])[0].after
        .local,
    ).toBeNull();
  });
  test("known deleted identities never resurrect merely because a file appears", () => {
    const request = {
      ...input(),
      baseline: {
        ...baseline,
        cards: [{ ...baseline.cards[0], deleted: true }],
      },
      remote: [{ ...card, deleted: true }],
    };
    expect(planSync(request).counts.conflicts).toBe(1);
    expect(planSync({ ...request, local: [] }).clean).toBe(true);
  });
  test("identity replacement is not resolvable by choosing deletion", () => {
    const request = {
      ...input(),
      deleteIds: ["1"],
      remote: [{ ...card, cardId: "00000000-0000-4000-8000-000000000002" }],
    };
    expect(() =>
      materializeSync(request, [{ externalId: "1", side: "ours" }]),
    ).toThrow("identity");
  });
});
