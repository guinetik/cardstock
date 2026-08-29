import { describe, expect, test } from "bun:test";
import {
  bodyOnImport,
  buildVocabulary,
  cardColorOnImport,
  laneForNewCard,
  laneMoveFromSource,
  type Mapping,
  mapAudience,
  mapTags,
  resolveTags,
  summaryOnImport,
  valueToPriority,
} from "./mapping";
import { bodyWithoutH1, dequote, extractAsk, parseFile } from "./parse";
import { isoOrNull, validateFrontmatter } from "./schema";

const FILE = `---
id: 157
title: "502 on \\"Submit\\" for review"
status: shipped
shipped: 2026-08-26
epic: Bugs & regressions
area: Designer
raised_by: Sam
raised: 2026-08-21
relates: [102, 56]
custom_key: keep me
tags:
  - designer
  - tracker-item
  - bug
---
# #157 — 502 on Submit

## Ask

On the [[2026-08-21]] session Sam hit **bold** and *italic* with \`code\` and [[157|#157]].
> quoted line

Second paragraph.

## Status

**Shipped.**
`;

describe("parseFile", () => {
  test("lenient frontmatter, lists, dequoting, body, hash", () => {
    const p = parseFile(FILE);
    expect(p.frontmatter.id).toBe("157");
    expect(p.frontmatter.title).toBe('502 on "Submit" for review');
    expect(p.frontmatter.relates).toEqual(["102", "56"]);
    expect(p.frontmatter.tags).toEqual(["designer", "tracker-item", "bug"]);
    expect(p.body.startsWith("# #157")).toBe(true);
    expect(p.hash).toHaveLength(64);
    expect(parseFile(FILE).hash).toBe(p.hash);
  });
  test("rejects a missing fence", () => {
    expect(() => parseFile("no fence")).toThrow(/fence/);
  });
  test("dequote", () => {
    expect(dequote('"a \\"b\\""')).toBe('a "b"');
    expect(dequote("plain")).toBe("plain");
  });
});

describe("validateFrontmatter", () => {
  test("types known keys, keeps unknown ones as extra", () => {
    const { data, extra } = validateFrontmatter(
      parseFile(FILE).frontmatter,
      "157.md",
    );
    expect(data.id).toBe(157);
    expect(data.relates).toEqual([102, 56]);
    expect(data.status).toBe("shipped");
    expect(extra).toEqual({ custom_key: "keep me" });
  });
  test("fails loudly on the required set", () => {
    expect(() =>
      validateFrontmatter({ id: "x", title: "", tags: ["designer"] }, "bad.md"),
    ).toThrow(/bad\.md/);
    expect(() =>
      validateFrontmatter({
        id: 1,
        title: "t",
        status: "backlog",
        epic: "E",
        area: "A",
        tags: ["designer"],
      }),
    ).toThrow(/tracker-item/);
  });
  test("date-ish keys accept free text; isoOrNull extracts the ISO ones", () => {
    const { data } = validateFrontmatter({
      id: 1,
      title: "t",
      status: "backlog",
      epic: "E",
      area: "A",
      tags: ["tracker-item"],
      reconfirmed: "2026-08-21, 2026-08-26",
      raised: "TBD",
      planned_start: "2026-09-01",
    });
    expect(data.reconfirmed).toBe("2026-08-21, 2026-08-26");
    expect(isoOrNull(data.raised)).toBeNull();
    expect(isoOrNull(data.planned_start)).toBe("2026-09-01");
    expect(isoOrNull("2026-08-26")).toBe("2026-08-26");
  });
  test("normalises effort/value", () => {
    const { data } = validateFrontmatter({
      id: 1,
      title: "t",
      status: "backlog",
      epic: "E",
      area: "A",
      tags: ["tracker-item"],
      effort: "medium",
      value: "h",
    });
    expect(data.effort).toBe("M");
    expect(data.value).toBe("H");
  });
});

describe("extractAsk / body", () => {
  test("first paragraph, plain text", () => {
    const b = parseFile(FILE).body;
    expect(extractAsk(b)).toBe(
      "On the 2026-08-21 session Sam hit bold and italic with code and #157. quoted line",
    );
    expect(bodyWithoutH1(b).startsWith("## Ask")).toBe(true);
  });
  test("no ask section", () => {
    expect(extractAsk("## Status\n\nx")).toBe("");
  });
});

describe("mapping", () => {
  const mapping: Mapping = {
    by_tag: { bug: ["kind:bug"], meta: ["kind:internal-tooling"] },
    by_epic: {
      "bugs & regressions": ["kind:bug"],
      "public website relaunch": ["objective:website"],
    },
    by_area: { designer: ["area:ui"] },
    audience_internal_when: { tags: ["meta"], areas: ["platform"] },
  };
  const fm = validateFrontmatter({
    id: 1,
    title: "t",
    status: "backlog",
    epic: "Bugs & regressions",
    area: "Designer",
    tags: ["tracker-item", "bug"],
  }).data;
  // A board's own tags are the taxonomy — these are the ones staffeto declares.
  const vocab = buildVocabulary([
    "area:terminations",
    "area:cross-cutting",
    "step:step-2",
    "step:login",
    "kind:bug",
    "objective:self-serve",
  ]);

  test("a bare tag resolves to whichever group declares it", () => {
    const f2 = {
      ...fm,
      tags: ["tracker-item", "step-2", "bug", "self-serve", "cross-cutting"],
    };
    expect(mapTags(f2, {}, vocab).refs).toEqual([
      "step:step-2",
      "kind:bug",
      "objective:self-serve",
      "area:cross-cutting",
    ]);
  });

  test("group:tag is explicit, and aliases rename the group", () => {
    const f2 = { ...fm, tags: ["int:terminations", "area:cross-cutting"] };
    expect(mapTags(f2, { group_aliases: { int: "area" } }, vocab).refs).toEqual(
      ["area:terminations", "area:cross-cutting"],
    );
  });

  test("a tag no group declares is left for the unresolved report", () => {
    const f2 = { ...fm, tags: ["tracker-item", "not-a-real-tag"] };
    expect(mapTags(f2, {}, vocab).refs).toEqual([]);
  });

  test("a tag two groups claim is ambiguous, and applied to neither", () => {
    // Guessing would file cards under the wrong concept without saying so.
    const both = buildVocabulary(["kind:internal", "objective:internal"]);
    const f2 = { ...fm, tags: ["internal"] };
    const out = mapTags(f2, {}, both);
    expect(out.refs).toEqual([]);
    expect(out.ambiguous).toEqual(["internal"]);
  });

  test("an ambiguous tag can still be named explicitly", () => {
    const both = buildVocabulary(["kind:internal", "objective:internal"]);
    const f2 = { ...fm, tags: ["kind:internal"] };
    expect(mapTags(f2, {}, both).refs).toEqual(["kind:internal"]);
  });

  test("nothing is hardcoded: a board that declares nothing resolves nothing", () => {
    // The old importer knew `bug` was a Kind regardless of the board.
    const empty = buildVocabulary([]);
    const f2 = { ...fm, tags: ["bug", "self-serve", "step-2"] };
    expect(mapTags(f2, {}, empty).refs).toEqual([]);
  });

  test("JSON overrides still apply and dedupe", () => {
    expect(mapTags(fm, mapping, vocab).refs).toEqual(["kind:bug", "area:ui"]);
  });
  test("internal kind or engineering epic → internal audience", () => {
    expect(mapAudience({ ...fm, tags: ["tracker-item", "internal"] }, {})).toBe(
      "internal",
    );
    expect(mapAudience({ ...fm, epic: "Engineering (internal)" }, {})).toBe(
      "internal",
    );
  });
  test("audience", () => {
    expect(mapAudience(fm, mapping)).toBe("all");
    expect(
      mapAudience({ ...fm, tags: ["tracker-item", "meta"] }, mapping),
    ).toBe("internal");
    expect(mapAudience({ ...fm, area: "Platform" }, mapping)).toBe("internal");
  });
  test("value → priority", () => {
    expect(valueToPriority("H")).toBe(1);
    expect(valueToPriority("M")).toBe(2);
    expect(valueToPriority("L")).toBe(3);
    expect(valueToPriority(null)).toBeNull();
  });
  test("a new card takes the lane its file names", () => {
    const keys = ["unsorted", "now", "gate-1", "done"];
    expect(laneForNewCard("gate-1", keys, "unsorted")).toBe("gate-1");
    expect(laneForNewCard("now", keys, "unsorted")).toBe("now");
  });

  test("a new card with no lane lands in the inbox", () => {
    const keys = ["triage", "now", "done"];
    expect(laneForNewCard(null, keys, "triage")).toBe("triage");
    expect(laneForNewCard(undefined, keys, "triage")).toBe("triage");
  });

  test("a lane the board does not have falls back to the inbox", () => {
    // A tracker may name a lane from another board, or one since deleted.
    // Inventing a column for it would be worse than filing it for triage.
    expect(laneForNewCard("gate-9", ["unsorted", "now"], "unsorted")).toBe(
      "unsorted",
    );
  });

  test("status has no say in where a new card lands", () => {
    // The whole point: two cards differing only in status land together.
    const keys = ["unsorted", "now", "done"];
    expect(laneForNewCard(null, keys, "unsorted")).toBe(
      laneForNewCard(null, keys, "unsorted"),
    );
    expect(laneForNewCard("now", keys, "unsorted")).toBe("now");
  });
});

describe("laneMoveFromSource", () => {
  test("moves when the file has changed its mind", () => {
    expect(laneMoveFromSource("gate-2", "gate-1")).toBe("gate-2");
  });

  test("does not move when the file says what it said last time", () => {
    // The card may have been dragged to Gate 3 since; the file is silent about
    // that, and silence must not be read as a request to move it back.
    expect(laneMoveFromSource("gate-1", "gate-1")).toBeNull();
  });

  test("does not move when the file names no lane", () => {
    expect(laneMoveFromSource(null, "gate-1")).toBeNull();
    expect(laneMoveFromSource(undefined, "gate-1")).toBeNull();
    expect(laneMoveFromSource("", "gate-1")).toBeNull();
  });

  test("never moves a card that has no merge base yet", () => {
    // Null base means this board predates lane tracking. Treating the file as
    // authoritative here would stampede every card to whatever its file says,
    // discarding the arrangement someone already built by hand.
    expect(laneMoveFromSource("gate-1", null)).toBeNull();
    expect(laneMoveFromSource("gate-1", undefined)).toBeNull();
  });

  test("a file that clears its lane is not a move", () => {
    expect(laneMoveFromSource(null, "gate-1")).toBeNull();
  });
});

describe("resolveTags", () => {
  const byRef = new Map([
    ["area:designer", "id-designer"],
    ["kind:bug", "id-bug"],
  ]);

  test("returns ids for refs the board knows", () => {
    const r = resolveTags(["area:designer", "kind:bug"], byRef);
    expect(r.ids).toEqual(["id-designer", "id-bug"]);
    expect(r.unresolved).toEqual([]);
  });

  test("reports refs the board does not declare instead of dropping them", () => {
    const r = resolveTags(["area:designer", "area:nope", "kind:ghost"], byRef);
    expect(r.ids).toEqual(["id-designer"]);
    expect(r.unresolved).toEqual(["area:nope", "kind:ghost"]);
  });

  test("is empty-safe", () => {
    expect(resolveTags([], byRef)).toEqual({ ids: [], unresolved: [] });
  });
});

describe("summaryOnImport", () => {
  const edited = {
    summary: "typed in the app",
    summary_edited_at: "2026-08-27T00:00:00Z",
  };
  const untouched = {
    summary: "seeded from markdown",
    summary_edited_at: null,
  };
  const blank = { summary: null, summary_edited_at: null };

  test("never overwrites a summary edited in the app", () => {
    expect(
      summaryOnImport(edited, "from frontmatter", "from ask"),
    ).toBeUndefined();
    expect(summaryOnImport(edited, null, "from ask")).toBeUndefined();
  });

  test("frontmatter wins while the app has not touched it", () => {
    expect(summaryOnImport(untouched, "from frontmatter", "from ask")).toBe(
      "from frontmatter",
    );
  });

  test("falls back to the Ask paragraph only when there is no summary yet", () => {
    expect(summaryOnImport(blank, null, "from ask")).toBe("from ask");
    expect(summaryOnImport(untouched, null, "from ask")).toBeUndefined();
  });
});

describe("card color frontmatter", () => {
  test("accepts an allowed color", () => {
    const result = validateFrontmatter({
      ...parseFile(FILE).frontmatter,
      color: "blue",
    });
    expect(result.data.color).toBe("blue");
    expect(cardColorOnImport(result.data.color)).toBe("blue");
  });

  test("accepts omission and maps it to a cleared mirror", () => {
    const result = validateFrontmatter(parseFile(FILE).frontmatter);
    expect(result.data.color).toBeUndefined();
    expect(cardColorOnImport(result.data.color)).toBeNull();
  });

  test("rejects an unknown color with the source filename", () => {
    expect(() =>
      validateFrontmatter(
        { ...parseFile(FILE).frontmatter, color: "chartreuse" },
        "bad.md",
      ),
    ).toThrow(/bad\.md.*color/);
  });
});

describe("bodyOnImport", () => {
  const edited = {
    body_md: "## Ask\n\napp",
    body_edited_at: "2026-08-27T00:00:00Z",
  };
  const untouched = { body_md: "## Ask\n\nfile", body_edited_at: null };

  test("never overwrites a body edited in the app", () => {
    expect(bodyOnImport(edited, "## Ask\n\nfrom file")).toBeUndefined();
  });

  test("file wins while the app has not touched it", () => {
    expect(bodyOnImport(untouched, "## Ask\n\nfrom file")).toBe(
      "## Ask\n\nfrom file",
    );
  });

  test("new card takes the file body", () => {
    expect(bodyOnImport(null, "## Ask\n\nfrom file")).toBe(
      "## Ask\n\nfrom file",
    );
  });
});
