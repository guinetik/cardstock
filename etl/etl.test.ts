import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PIN_STATUSES,
  isPinnedStatus,
  laneForStatus,
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
    });
    expect(data.reconfirmed).toBe("2026-08-21, 2026-08-26");
    expect(isoOrNull(data.raised)).toBeNull();
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
  test("scheme tags map 1:1 onto groups; JSON overrides still apply and dedupe", () => {
    const f2 = {
      ...fm,
      tags: [
        "tracker-item",
        "int:terminations",
        "step-2",
        "bug",
        "self-serve",
        "cross-cutting",
      ],
    };
    expect(mapTags(f2, {})).toEqual([
      "area:terminations",
      "step:step-2",
      "kind:bug",
      "objective:self-serve",
      "area:cross-cutting",
    ]);
    expect(mapTags(fm, mapping)).toEqual(["kind:bug", "area:ui"]);
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
  test("lane for status", () => {
    const s = {
      status_to_lane: {
        backlog: "unsorted",
        wip: "now",
        shipped: "done",
        built: "built",
      },
      needs_lane: "needs-input",
    };
    expect(laneForStatus("backlog", null, s)).toBe("unsorted");
    expect(laneForStatus("wip", null, s)).toBe("now");
    expect(laneForStatus("backlog", "Owner", s)).toBe("needs-input");
    expect(laneForStatus("shipped", "Owner", s)).toBe("done"); // pins beat needs
    expect(laneForStatus("weird", null, s)).toBe("unsorted");
    expect(isPinnedStatus("handed")).toBe("built");
    expect(isPinnedStatus("done")).toBe("done");
    expect(isPinnedStatus("wip")).toBeNull();
  });

  test("a board can narrow which statuses pin", () => {
    // A board with delivery gates knows a card is built but not which gate it
    // reached, so it leaves `built` to the board and still pins the rest.
    const s = { pin_statuses: ["shipped", "done", "handed", "held"] };
    expect(isPinnedStatus("built", s)).toBeNull();
    expect(isPinnedStatus("shipped", s)).toBe("done");
    expect(isPinnedStatus("handed", s)).toBe("built");
    expect(isPinnedStatus("held", s)).toBe("built");
  });

  test("an unpinned status lets `needs` choose the lane again", () => {
    const s = {
      status_to_lane: { built: "done" },
      needs_lane: "needs-input",
      pin_statuses: ["shipped", "done"],
    };
    expect(laneForStatus("built", "Owner", s)).toBe("needs-input");
    // With no `needs`, the status mapping still applies.
    expect(laneForStatus("built", null, s)).toBe("done");
  });

  test("an empty pin list pins nothing", () => {
    expect(isPinnedStatus("shipped", { pin_statuses: [] })).toBeNull();
    expect(isPinnedStatus("done", { pin_statuses: [] })).toBeNull();
  });

  test("a board that says nothing keeps the default five", () => {
    for (const st of DEFAULT_PIN_STATUSES)
      expect(isPinnedStatus(st, {})).not.toBeNull();
    expect(DEFAULT_PIN_STATUSES).toEqual([
      "built",
      "handed",
      "held",
      "shipped",
      "done",
    ]);
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
