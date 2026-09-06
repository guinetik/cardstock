import { describe, expect, test } from "bun:test";
import fixtures from "../../cli/test/fixtures/legacy-boards.json";
import { parseConfig, schemeSchema, validateTracker } from "../src";

const fixture = fixtures[0];
const scheme = schemeSchema.parse(fixture.board.scheme);
const good = `---
id: 9
title: A useful card
summary: Keep the board understandable.
status: wip
lane: now
epic: Board & cards
area: Data
tags: [enhancement, board]
effort: H
priority: 1
custom: preserved
---
# A useful card
## Ask
Make the change.
## Status
Being built.
`;
const validate = (text = good) =>
  validateTracker([{ name: "9.md", text }], scheme);

describe("configuration contract", () => {
  test("minimal v1 stays compatible and all three schemes and mappings are accepted", () => {
    expect(
      parseConfig({ version: 1, project: "demo", board: "demo", tracker: "." })
        .scheme,
    ).toBeUndefined();
    for (const { board, mapping } of fixtures) {
      const config = parseConfig({
        version: 1,
        project: board.project,
        board: board.board,
        tracker: "tracker",
        scheme: board.scheme,
        mapping,
      });
      expect(config.scheme).toEqual(board.scheme);
      expect(config.mapping).toEqual(mapping);
    }
  });
  test("invalid rule names and dangling vocabulary references are configuration errors", () => {
    for (const override of [
      { misspelled_rule: true },
      { tag_groups: { kind: { cardinality: "exacty-one", tags: ["bug"] } } },
      { lanes_for_status: { wip: ["missing"] } },
      { lanes_for_status: { missing: ["now"] } },
      { closed_statuses: ["missing"] },
      { now_lane_requires_status: "missing" },
      { required_tags: ["missing"] },
      { required_sections: ["Ask"] },
    ])
      expect(schemeSchema.safeParse({ ...scheme, ...override }).success).toBe(
        false,
      );
    expect(() =>
      parseConfig({
        version: 1,
        project: "a",
        board: "b",
        tracker: ".",
        mapping: { group_alias: {} },
      }),
    ).toThrow();
  });
});

describe("scheme validation", () => {
  test("accepts valid data, unknown frontmatter and CRLF without mutating inputs", () => {
    const files = [{ name: "9.md", text: good.replaceAll("\n", "\r\n") }];
    const before = structuredClone(files);
    expect(validateTracker(files, scheme).ok).toBe(true);
    expect(files).toEqual(before);
  });
  test("catches the #9 status/lane mismatch and accepts the held correction", () => {
    const text = good.replace("lane: now", "lane: next");
    expect(validate(text).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "status_lane",
        field: "lane",
        reference: scheme.scheme_doc,
      }),
    );
    expect(validate(text.replace("status: wip", "status: held")).ok).toBe(true);
    expect(
      validate(good.replace("status: wip", "status: held")).diagnostics.some(
        (d) => d.code === "now_status",
      ),
    ).toBe(true);
  });
  for (const [from, to, code] of [
    ["tags: [enhancement, board]", "tags: enhancement", "field_type"],
    ["tags: [enhancement, board]", "tags: [board]", "tag_cardinality"],
    [
      "tags: [enhancement, board]",
      "tags: [bug, enhancement]",
      "tag_cardinality",
    ],
    [
      "tags: [enhancement, board]",
      "tags: [bug, board, card]",
      "tag_cardinality",
    ],
    ["tags: [enhancement, board]", "tags: [bug, unknown]", "unknown_tag"],
    ["tags: [enhancement, board]\n", "", "required_key"],
    ["area: Data", "area: Unknown", "vocabulary"],
    ["epic: Board & cards", "epic: Unknown", "vocabulary"],
    ["lane: now", "lane: unknown", "vocabulary"],
    ["effort: H", "effort: high", "vocabulary"],
    ["effort: H", "effort:", "field_type"],
    ["effort: H", "value:", "field_type"],
    ["status: wip", "status:", "field_type"],
    ["area: Data", "area:", "field_type"],
    ["priority: 1", "priority: 4", "priority"],
    ["summary: Keep the board understandable.", "summary:", "open_summary"],
    ["## Status\nBeing built.", "## Status\n", "empty_section"],
    ["## Ask", "This mentions ## Ask in prose", "required_section"],
  ])
    test(`${code}: ${to || `missing ${from.trim()}`}`, () => {
      expect(
        validate(good.replace(from, to)).diagnostics.some(
          (d) => d.code === code,
        ),
      ).toBe(true);
    });
  test("closed items need no summary; an absent optional lane/size is allowed", () => {
    expect(
      validate(
        good
          .replace("status: wip", "status: done")
          .replace("lane: now\n", "")
          .replace("effort: H\n", "")
          .replace("summary: Keep the board understandable.\n", ""),
      ).ok,
    ).toBe(true);
  });
  test("strict YAML is an additional gate only for a configured scheme", () => {
    const bad = good.replace(
      "title: A useful card",
      "title: A useful card: extra context",
    );
    expect(validate(bad).diagnostics[0].code).toBe("invalid_yaml");
    expect(validateTracker([{ name: "9.md", text: bad }]).ok).toBe(true);
    expect(
      validate(
        bad.replace(
          "title: A useful card: extra context",
          'title: "A useful card: extra context"',
        ),
      ).ok,
    ).toBe(true);
    expect(
      validate(good.replace("priority: 1", "priority: 1\npriority: 2"))
        .diagnostics[0].code,
    ).toBe("invalid_yaml");
  });
  test("headings inside fenced code cannot satisfy a required section", () => {
    const text = good.replace(
      "## Ask\nMake the change.",
      "```md\n## Ask\nMake the change.\n```",
    );
    expect(
      validate(text).diagnostics.some((d) => d.code === "required_section"),
    ).toBe(true);
  });
  test("strict YAML reports unresolved aliases, unknown tags and incomplete quoting", () => {
    for (const value of [
      "*missing",
      "!custom data",
      '"quoted" trailing words',
    ]) {
      expect(
        validate(good.replace("custom: preserved", `custom: ${value}`))
          .diagnostics[0].code,
      ).toBe("invalid_yaml");
    }
  });
  test("Designer requires integration and tracker-item tags; Website does not", () => {
    const designer = schemeSchema.parse(fixtures[1].board.scheme);
    const website = schemeSchema.parse(fixtures[2].board.scheme);
    const text = good
      .replace("epic: Board & cards", "epic: Pages & visuals")
      .replace("area: Data", "area: UI")
      .replace("tags: [enhancement, board]", "tags: [enhancement, home]");
    expect(validateTracker([{ name: "9.md", text }], website).ok).toBe(true);
    const failures = validateTracker(
      [{ name: "9.md", text }],
      designer,
    ).diagnostics;
    expect(failures.some((d) => d.code === "required_tag")).toBe(true);
    expect(
      failures.some(
        (d) =>
          d.code === "tag_cardinality" && d.message.includes("integration"),
      ),
    ).toBe(true);
    const validDesigner = text
      .replace("epic: Pages & visuals", "epic: Validation Tables")
      .replace(
        "tags: [enhancement, home]",
        "tags: [enhancement, tracker-item, int:validation-tables, cross-cutting, home, step-1]",
      );
    expect(
      validateTracker([{ name: "9.md", text: validDesigner }], designer).ok,
    ).toBe(true);
  });
});
