import { describe, expect, test } from "bun:test";
import { parseFile } from "./parse";
import { validateFrontmatter } from "./schema";
import { type CardSheet, sheetFromFrontmatter } from "./sheet";
import { cardToMarkdown, writeSheet } from "./write";

const FILE = `---
id: 152
title: "Filter what to sync — drop the yes/no gate"
status: backlog
epic: Validation Tables
area: Designer
raised_by: Sam
raised: 2026-08-21
effort: L
target: after the September release
relates: [63, 78]
custom_key: keep me
tags:
  - designer
  - wizard
lane: next
rank: 2
---
# #152 — Filter what to sync

## Ask

Body stays byte-identical.
`;

function sheetOf(text: string): CardSheet {
  const p = parseFile(text);
  const { data, extra } = validateFrontmatter(p.frontmatter);
  return sheetFromFrontmatter(data, extra, p.body, data.tags);
}

describe("writeSheet", () => {
  test("a sheet the board agrees with comes back byte-identical", () => {
    expect(writeSheet(FILE, sheetOf(FILE))).toBe(FILE);
  });
  test("a changed priority rewrites one line, appended in schema order", () => {
    const out = writeSheet(FILE, { ...sheetOf(FILE), priority: 1 });
    const a = FILE.split("\n");
    const b = out.split("\n");
    expect(b.filter((l) => !a.includes(l))).toEqual(["priority: 1"]);
    expect(b.indexOf("priority: 1")).toBe(b.indexOf("rank: 2") + 1);
  });
  test("a changed key present in the file is rewritten in place", () => {
    const out = writeSheet(FILE, { ...sheetOf(FILE), lane: "now", rank: 1 });
    const lines = out.split("\n");
    expect(lines[lines.indexOf("custom_key: keep me") + 4]).toBe("lane: now");
    expect(lines).toContain("rank: 1");
    expect(lines).not.toContain("lane: next");
  });
  test("a nulled key is removed", () => {
    const out = writeSheet(FILE, { ...sheetOf(FILE), effort: null });
    expect(out).not.toContain("effort:");
    expect(out).toContain("raised: 2026-08-21");
  });
  test("tags keep file order and append new refs", () => {
    const out = writeSheet(FILE, {
      ...sheetOf(FILE),
      tags: ["wizard", "designer", "kind:bug"],
    });
    expect(out).toContain("tags:\n  - designer\n  - wizard\n  - kind:bug\n");
  });
  test("an appended comment is written as an append", () => {
    const s = sheetOf(FILE);
    const out = writeSheet(FILE, {
      ...s,
      bodyMd: `${s.bodyMd}\n\n## Comments\n\n### 2026-08-29 10:00 · joao\n\n> Looks good.`,
    });
    expect(out.startsWith(FILE.replace(/\n$/, ""))).toBe(true);
    expect(out.endsWith("> Looks good.\n")).toBe(true);
  });
  test("an edited body is replaced with the H1 restored", () => {
    const out = writeSheet(FILE, {
      ...sheetOf(FILE),
      bodyMd: "## Ask\n\nNew.",
    });
    expect(
      out.endsWith(
        "---\n# #152 — Filter what to sync — drop the yes/no gate\n\n## Ask\n\nNew.\n",
      ),
    ).toBe(true);
  });
  test("unknown keys survive, CRLF stays CRLF", () => {
    const crlf = FILE.replace(/\n/g, "\r\n");
    const out = writeSheet(crlf, { ...sheetOf(crlf), priority: 2 });
    expect(out).toContain("custom_key: keep me\r\n");
    expect(out.split("\r\n").join("").includes("\n")).toBe(false);
  });
  test("an unmapped bare tag is not the board's to remove", () => {
    const file = FILE.replace(
      "tags:\n  - designer\n  - wizard\n",
      "tags:\n  - known\n  - mystery\n",
    );
    const tagRef = (t: string) => (t === "known" ? "g:known" : null);
    const out = writeSheet(
      file,
      { ...sheetOf(file), tags: ["g:known"] },
      { tagRef },
    );
    expect(out).toBe(file);
  });
  test("an unmapped bare tag survives a new tag being appended", () => {
    const file = FILE.replace(
      "tags:\n  - designer\n  - wizard\n",
      "tags:\n  - known\n  - mystery\n",
    );
    const tagRef = (t: string) => (t === "known" ? "g:known" : null);
    const out = writeSheet(
      file,
      { ...sheetOf(file), tags: ["g:known", "g:new"] },
      { tagRef },
    );
    expect(out).toContain("tags:\n  - known\n  - mystery\n  - g:new\n");
    expect(out.replace("  - g:new\n", "")).toBe(file);
  });
});

// Free-text date-ish values, `effort` in lower case, `value:` standing in for
// `priority:`, and a lone `archived_by:` — every shape the old raw comparison
// mistook for a difference and deleted from an untouched sheet.
const LOOSE = `---
id: 7
title: A loose sheet
status: wip
epic: Round trip
area: Designer
raised: TBD
reconfirmed: 2026-08-21, 2026-08-26
planned_start: soon
effort: m
value: H
archived_by: bob
branch: feat/x
tags: [designer, wizard]
---
# #7 — A loose sheet

## Ask

Nothing here should move.
`;

describe("writeSheet on a loose sheet", () => {
  test("free text, lower-case effort, value and a lone archived_by all survive untouched", () => {
    expect(writeSheet(LOOSE, sheetOf(LOOSE))).toBe(LOOSE);
  });
  test("priority the file already states through value: is not written again", () => {
    const out = writeSheet(LOOSE, { ...sheetOf(LOOSE), priority: 1 });
    expect(out).toBe(LOOSE);
  });
  test("a priority that disagrees with value: appends exactly one line", () => {
    const out = writeSheet(LOOSE, { ...sheetOf(LOOSE), priority: 2 });
    const a = LOOSE.split("\n");
    const b = out.split("\n");
    expect(b.filter((l) => !a.includes(l))).toEqual(["priority: 2"]);
    expect(a.filter((l) => !b.includes(l))).toEqual([]);
  });
  test("an inline tags list plus a new ref rewrites only the tags lines", () => {
    const out = writeSheet(LOOSE, {
      ...sheetOf(LOOSE),
      tags: ["designer", "wizard", "kind:bug"],
    });
    expect(out).toContain("kind:bug");
    // every other line of the file is still there, in order
    const kept = out.split("\n").filter((l) => !/^(tags:|\s*- |\[)/.test(l));
    expect(kept).toEqual(
      LOOSE.split("\n").filter((l) => !l.startsWith("tags:")),
    );
  });
});

describe("cardToMarkdown", () => {
  test("writes schema order, extras, managed block, H1, body — and round-trips", () => {
    const s = sheetOf(FILE);
    const out = cardToMarkdown(s);
    expect(out.startsWith("---\nid: 152\ntitle:")).toBe(true);
    expect(out).toContain("custom_key: keep me");
    expect(out).toContain(
      "# #152 — Filter what to sync — drop the yes/no gate",
    );
    expect(sheetOf(out)).toEqual(s);
    expect(writeSheet(out, s)).toBe(out);
  });
});
