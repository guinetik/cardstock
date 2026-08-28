import { describe, expect, test } from "bun:test";
import { formatScalar, writeManaged } from "./frontmatter-write";
import { parseFile } from "./parse";
import { validateFrontmatter } from "./schema";

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
  - tracker-item
  - wizard
---
# #152 — Filter what to sync

## Ask

Body stays byte-identical.
`;

describe("writeManaged", () => {
  test("appends the managed block, replaces existing managed keys, keeps everything else", () => {
    const out = writeManaged(FILE, {
      lane: "next",
      rank: 2,
      priority: 1,
      effort: "M",
      planned_start: "2026-10-01",
      target: "2026-10-15",
    });
    const { frontmatter, body } = parseFile(out);
    expect(frontmatter.lane).toBe("next");
    expect(frontmatter.rank).toBe("2");
    expect(frontmatter.priority).toBe("1");
    expect(frontmatter.effort).toBe("M"); // replaced, not duplicated
    expect(frontmatter.planned_start).toBe("2026-10-01");
    expect(frontmatter.target).toBe("2026-10-15");
    expect(frontmatter.custom_key).toBe("keep me");
    expect(frontmatter.tags).toEqual(["designer", "tracker-item", "wizard"]);
    expect(out.split("\n").filter((l) => l.startsWith("effort:"))).toHaveLength(
      1,
    );
    expect(out.split("\n").filter((l) => l.startsWith("target:"))).toHaveLength(
      1,
    );
    expect(body).toBe(parseFile(FILE).body);
    // the tracker's own contract still holds
    expect(() => validateFrontmatter(frontmatter)).not.toThrow();
  });
  test("omits unset keys and is idempotent", () => {
    const once = writeManaged(FILE, {
      lane: "unsorted",
      rank: 7,
      priority: null,
      effort: null,
      target: null,
    });
    expect(once).not.toContain("priority:");
    expect(once).not.toContain("target:");
    expect(writeManaged(once, { lane: "unsorted", rank: 7 })).toBe(once);
  });
  test("keeps CRLF files CRLF", () => {
    const crlf = FILE.replace(/\n/g, "\r\n");
    const out = writeManaged(crlf, { lane: "now", rank: 1 });
    expect(out.includes("\r\n")).toBe(true);
    expect(out.split("\r\n").join("").includes("\n")).toBe(false); // no lone LF anywhere
    expect(out.includes("\r\nlane: now\r\n")).toBe(true);
  });
  test("archived stamps both keys", () => {
    const out = writeManaged(FILE, {
      lane: "archive",
      rank: 1,
      archived: "2026-08-27 10:00:00",
      archived_by: "owner@example.com",
    });
    expect(out).toContain("archived: 2026-08-27 10:00:00");
    expect(out).toContain("archived_by: owner@example.com");
  });
  test("accepts a stable key from a lane created in the UI", () => {
    const out = writeManaged(FILE, {
      lane: "design-review-next",
      rank: 1,
    });
    expect(parseFile(out).frontmatter.lane).toBe("design-review-next");
  });
});

describe("formatScalar", () => {
  test("quotes only when the lenient parser needs it", () => {
    expect(formatScalar("2026-10-15")).toBe("2026-10-15");
    expect(formatScalar("after new hire")).toBe("after new hire");
    expect(formatScalar('say "hi": now')).toBe('"say \\"hi\\": now"');
    expect(formatScalar("[not a list]")).toBe('"[not a list]"');
    expect(formatScalar(2)).toBe("2");
    expect(formatScalar(2.5)).toBe("2.5");
  });
});
