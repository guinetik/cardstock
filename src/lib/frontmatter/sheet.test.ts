import { describe, expect, test } from "bun:test";
import { parseFile } from "./parse";
import { validateFrontmatter } from "./schema";
import { diffSheets, presentKeys, sheetFromFrontmatter } from "./sheet";

const FILE = `---
id: 7
title: Rename the button
status: backlog
epic: Billing
area: Product
value: H
target: 2026-10-01
custom: keep
tags:
  - kind:bug
---
# #7 — Rename the button

## Ask

Please.
`;

function load(text: string) {
  const parsed = parseFile(text);
  const { data, extra } = validateFrontmatter(parsed.frontmatter);
  return {
    sheet: sheetFromFrontmatter(data, extra, parsed.body, data.tags),
    present: presentKeys(parsed.frontmatter),
  };
}

describe("sheetFromFrontmatter", () => {
  test("maps value to priority, keeps extra, strips the H1", () => {
    const { sheet } = load(FILE);
    expect(sheet.priority).toBe(1);
    expect(sheet.extra).toEqual({ custom: "keep" });
    expect(sheet.bodyMd.startsWith("## Ask")).toBe(true);
    expect(sheet.summary).toBe("Please.");
    expect(sheet.target).toBe("2026-10-01");
  });
});

describe("presentKeys", () => {
  test("value counts as priority; body is always present", () => {
    const { present } = load(FILE);
    expect(present.has("priority")).toBe(true);
    expect(present.has("effort")).toBe(false);
    expect(present.has("body")).toBe(true);
  });
});

describe("diffSheets", () => {
  test("reports only keys the file states and that differ", () => {
    const { sheet, present } = load(FILE);
    const board = {
      ...sheet,
      priority: 2 as const,
      effort: "M" as const,
      title: "Old",
    };
    const changes = diffSheets(sheet, board, present);
    expect(changes).toEqual([
      { key: "title", from: "Old", to: "Rename the button" },
      { key: "priority", from: "2", to: "1" },
    ]);
  });
  test("tags compare as a set, body as text", () => {
    const { sheet, present } = load(FILE);
    const board = {
      ...sheet,
      tags: ["kind:bug", "area:billing"],
      bodyMd: "## Ask\n\nNo.",
    };
    const changes = diffSheets(sheet, board, present);
    expect(changes.map((c) => c.key)).toEqual(["tags", "body"]);
  });
});
