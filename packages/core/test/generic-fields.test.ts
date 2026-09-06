import { describe, expect, test } from "bun:test";
import { comparisonFields, materializeSync, planSync } from "../src";
import { validateFrontmatter } from "../src/schema";

const vocabulary = { tagGroups: [] };
const markdown =
  "---\nid: 1\ntitle: Generic card\nstatus: backlog\narea: Any department\nepic: Any initiative\ntags: []\n---\n# Generic card\n\nBody.\n";
const remote = (text = markdown) => ({
  externalId: "1",
  cardId: "00000000-0000-4000-8000-000000000001",
  revision: "r1",
  markdown: text,
});
const baseline = {
  version: 1 as const,
  scope: {
    remote: "https://example.test",
    project: "p",
    board: "b",
    tracker: ".",
    mapping: "{}",
  },
  etag: "e",
  cards: [{ ...remote(), file: "1.md" }],
};
const internal = markdown.replace("tags: []", "tags: []\naudience: internal");

describe("generic card fields", () => {
  test("audience is typed, optional, and independent of tag vocabulary", () => {
    expect(
      comparisonFields(markdown, vocabulary).fields["frontmatter.audience"],
    ).toBe("all");
    expect(
      comparisonFields(internal, vocabulary).fields["frontmatter.audience"],
    ).toBe("internal");
    expect(() =>
      comparisonFields(
        internal.replace("audience: internal", "audience: private"),
        vocabulary,
      ),
    ).toThrow();
    expect(
      validateFrontmatter({
        id: 1,
        title: "Card",
        status: "backlog",
        area: "Whatever",
        tags: [],
      }).data.epic,
    ).toBeUndefined();
  });
  test("an old baseline downloads the board audience without inferring it from tags or epics", () => {
    const input = {
      local: [{ file: "1.md", markdown }],
      remote: [remote(internal)],
      baseline,
      vocabulary,
    };
    expect(planSync(input).counts).toMatchObject({
      uploads: 0,
      downloads: 1,
      conflicts: 0,
    });
    expect(materializeSync(input)[0].after.local).toContain(
      "audience: internal",
    );
    expect(
      comparisonFields(
        markdown
          .replace("Any initiative", "Engineering (internal)")
          .replace("tags: []", "tags: [internal]"),
        vocabulary,
      ).fields["frontmatter.audience"],
    ).toBe("all");
  });
  test("removing a previously explicit internal audience resets it to all", () => {
    const input = {
      local: [{ file: "1.md", markdown }],
      remote: [remote(internal)],
      baseline: { ...baseline, cards: [{ ...remote(internal), file: "1.md" }] },
      vocabulary,
    };
    const intent = materializeSync(input)[0];
    expect(
      comparisonFields(intent.after.remote, vocabulary).fields[
        "frontmatter.audience"
      ],
    ).toBe("all");
    expect(intent.writeRemote).toBe(true);
  });
  test("different fields merge without making area/epic names influence audience", () => {
    const local = markdown.replace("Any department", "Engineering (internal)");
    const intent = materializeSync({
      local: [{ file: "1.md", markdown: local }],
      remote: [remote(internal)],
      baseline,
      vocabulary,
    })[0];
    for (const text of [intent.after.local, intent.after.remote]) {
      expect(text).toContain("area: Engineering (internal)");
      expect(text).toContain("audience: internal");
    }
  });
  test("an epic can be unassigned without treating another name as a convention", () => {
    const local = markdown.replace("epic: Any initiative\n", "");
    const intent = materializeSync({
      local: [{ file: "1.md", markdown: local }],
      remote: [remote()],
      baseline,
      vocabulary,
    })[0];
    expect(
      comparisonFields(intent.after.remote, vocabulary).fields[
        "frontmatter.epic"
      ],
    ).toBeNull();
  });
});
