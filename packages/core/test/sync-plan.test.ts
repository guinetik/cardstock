import { describe, expect, test } from "bun:test";
import { type Baseline, comparisonFields, planSync } from "../src";

const markdown = `---
id: 1
title: Example
status: wip
epic: Platform
area: UI
tags: [bug]
priority: 2
custom: original
---
# Example
## Ask
Please keep this card.
`;
const vocabulary = {
  tagGroups: [
    { key: "kind", tags: [{ key: "bug" }, { key: "enhancement" }] },
    { key: "area", tags: [{ key: "test" }] },
  ],
};
const base: Baseline = {
  version: 1,
  scope: {
    remote: "https://example.test",
    project: "demo",
    board: "backlog",
    tracker: "tracker",
    mapping: "{}",
  },
  etag: "old",
  cards: [{ file: "1.md", externalId: "1", revision: "r1", markdown }],
};
function plan(
  local = markdown,
  remote = markdown,
  baseline: Baseline | undefined = base,
) {
  return planSync({
    local: [{ file: "1.md", markdown: local }],
    remote: [{ externalId: "1", revision: "r2", markdown: remote }],
    baseline,
    vocabulary,
  });
}

describe("three-way sync planner", () => {
  test("agreed unchanged cards produce an empty clean plan", () => {
    expect(plan()).toEqual({
      clean: true,
      counts: { uploads: 0, downloads: 0, equal: 0, conflicts: 0 },
      cards: [],
    });
  });
  test("local and remote changes on different fields merge without selecting a whole-card winner", () => {
    const result = plan(
      markdown.replace("custom: original", "custom: local"),
      markdown.replace("priority: 2", "priority: 1"),
    );
    expect(result.counts).toEqual({
      uploads: 1,
      downloads: 1,
      equal: 0,
      conflicts: 0,
    });
    expect(
      result.cards[0].changes.map((change) => [change.field, change.direction]),
    ).toEqual([
      ["frontmatter.custom", "upload"],
      ["frontmatter.priority", "download"],
    ]);
    expect(result.cards[0].revision).toBe("r2");
  });
  test("different edits to one field are conflicts with all three values", () => {
    const result = plan(
      markdown.replace("custom: original", "custom: local"),
      markdown.replace("custom: original", "custom: remote"),
    );
    expect(result.cards[0].action).toBe("conflict");
    expect(result.cards[0].changes[0]).toEqual({
      field: "frontmatter.custom",
      direction: "conflict",
      base: { present: true, value: "original" },
      local: { present: true, value: "local" },
      remote: { present: true, value: "remote" },
      reason: "both_changed",
    });
  });
  test("identical edits since baseline are reported as equal with no pending writes", () => {
    const changed = markdown.replace("priority: 2", "priority: 1");
    expect(plan(changed, changed).counts.equal).toBe(1);
    expect(plan(changed, changed).clean).toBe(true);
  });
  test("no baseline never chooses a winner on differing existing cards", () => {
    const result = planSync({
      local: [{ file: "1.md", markdown }],
      remote: [
        {
          externalId: "1",
          revision: "r1",
          markdown: markdown.replace("title: Example", "title: Another card"),
        },
      ],
      vocabulary,
    });
    expect(result.counts.conflicts).toBe(1);
    expect(result.cards[0].changes[0].reason).toContain("identity_collision");
    expect(
      planSync({
        local: [{ file: "1.md", markdown }],
        remote: [{ externalId: "1", revision: "r1", markdown }],
        vocabulary,
      }).clean,
    ).toBe(true);
  });
  test("new cards are uploads or downloads without deletion inference", () => {
    expect(
      planSync({ local: [{ file: "1.md", markdown }], remote: [], vocabulary })
        .cards[0].action,
    ).toBe("create_remote");
    expect(
      planSync({ local: [], remote: base.cards, vocabulary }).cards[0].action,
    ).toBe("create_local");
    const missingLocal = planSync({
      local: [],
      remote: base.cards,
      baseline: base,
      vocabulary,
    });
    expect(missingLocal.cards[0].action).toBe("create_local");
    expect(missingLocal.cards[0].reason).toContain("not a deletion");
    for (const local of [[], [{ file: "1.md", markdown }]]) {
      const missingRemote = planSync({
        local,
        remote: [],
        baseline: base,
        vocabulary,
      });
      expect(missingRemote.cards[0].action).toBe("conflict");
      expect(missingRemote.clean).toBe(false);
    }
  });
  test("added, removed and null-valued fields are distinct", () => {
    const removed = plan(markdown.replace("custom: original\n", ""));
    expect(removed.cards[0].changes[0].local).toEqual({ present: false });
    expect(removed.cards[0].changes[0].direction).toBe("upload");
    const cleared = plan(markdown.replace("custom: original", "custom: null"));
    expect(cleared.cards[0].changes[0].local).toEqual({
      present: true,
      value: null,
    });
    const added = plan(
      markdown.replace("custom: original", "custom: original\nextra: new"),
    );
    expect(added.cards[0].changes[0].base).toEqual({ present: false });
    expect(added.cards[0].changes[0].direction).toBe("upload");
  });
  test("body changes are compared without the redundant H1 or newline format", () => {
    expect(plan(markdown.replaceAll("\n", "\r\n")).clean).toBe(true);
    expect(plan(markdown.replace("# Example\n", "")).clean).toBe(true);
    expect(
      plan(`${markdown}A local comment.\n`).cards[0].changes[0].field,
    ).toBe("body");
  });
  test("canonical tags compare aliases and bare names but preserve unknown ambiguity", () => {
    const a = markdown.replace("tags: [bug]", "tags: [int:test, bug]");
    const b = markdown.replace("tags: [bug]", "tags: [kind:bug, area:test]");
    expect(
      planSync({
        local: [{ file: "1.md", markdown: a }],
        remote: [{ externalId: "1", revision: "r1", markdown: b }],
        mapping: { group_aliases: { int: "area" } },
        vocabulary,
      }).clean,
    ).toBe(true);
    const ambiguous = {
      tagGroups: [
        ...vocabulary.tagGroups,
        { key: "other", tags: [{ key: "bug" }] },
      ],
    };
    expect(
      comparisonFields(markdown, ambiguous).fields["frontmatter.tags"],
    ).toEqual(["bug"]);
  });
  test("nested unknown YAML is compared without flattening or losing array order", () => {
    const nested = markdown.replace(
      "custom: original",
      "custom:\n  owner: original\n  sequence: [a, b]",
    );
    const baseline = {
      ...base,
      cards: [{ ...base.cards[0], markdown: nested }],
    };
    const result = plan(nested.replace("[a, b]", "[b, a]"), nested, baseline);
    expect(result.cards[0].changes[0].field).toBe("frontmatter.custom");
    expect(result.cards[0].changes[0].direction).toBe("upload");
    expect(
      plan(
        nested.replace(
          "  owner: original\n  sequence: [a, b]",
          "  sequence: [a, b]\n  owner: original",
        ),
        nested,
        baseline,
      ).clean,
    ).toBe(true);
  });
  test("invalid YAML, duplicate identities and filename collisions cannot produce a clean plan", () => {
    expect(() =>
      plan(
        markdown.replace("custom: original", "custom: first\ncustom: second"),
      ),
    ).toThrow(/YAML/);
    expect(() =>
      planSync({ local: [{ file: "2.md", markdown }], remote: [], vocabulary }),
    ).toThrow(/identity/);
    expect(() =>
      planSync({
        local: [],
        remote: [...base.cards, ...base.cards],
        vocabulary,
      }),
    ).toThrow(/duplicate remote/);
    expect(() =>
      planSync({
        local: [],
        remote: [],
        baseline: { ...base, cards: [...base.cards, ...base.cards] },
        vocabulary,
      }),
    ).toThrow(/duplicate baseline/);
  });
  test("planning does not mutate inputs", () => {
    const input = {
      local: [{ file: "1.md", markdown }],
      remote: base.cards,
      baseline: base,
      vocabulary,
    };
    const before = structuredClone(input);
    planSync(input);
    expect(input).toEqual(before);
  });
});
