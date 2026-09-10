import { describe, expect, test } from "bun:test";
import {
  type Baseline,
  checklistSection,
  comparisonFields,
  materializeSync,
  parseChecklist,
  planSync,
  writeChecklist,
} from "../src";

const body =
  "## Ask\nKeep this.\n\n## Checklist\n- [x] One\n- [ ] One\n\n## Comments\nKeep comments.\n";
const sheet = (content = body) =>
  `---\nid: 1\ntitle: Example\nstatus: backlog\narea: UI\ntags: []\n---\n# Example\n\n${content}`;
const baseline: Baseline = {
  version: 1,
  scope: {
    remote: "https://example.test",
    project: "p",
    board: "b",
    tracker: ".",
    mapping: "{}",
  },
  etag: "a",
  cards: [{ file: "1.md", externalId: "1", revision: "r1", markdown: sheet() }],
};
const input = (
  local: string,
  remote: string,
  base: Baseline | undefined = baseline,
) => ({
  local: [{ file: "1.md", markdown: local }],
  remote: [{ externalId: "1", revision: "r2", markdown: remote }],
  baseline: base,
  vocabulary: { tagGroups: [] },
});

describe("portable checklist", () => {
  test("leaves the Subtasks heading available for linked cards", () => {
    const linked = "## Subtasks\n- [ ] Linked card reference\n\n";
    expect(parseChecklist(linked)).toMatchObject({
      present: false,
      items: [],
      body: linked,
    });
    const combined = `${linked}## Checklist\n- [x] Acceptance step\n`;
    expect(parseChecklist(combined).body).toBe(linked);
    expect(parseChecklist(combined).items).toEqual([
      { label: "Acceptance step", completed: true },
    ]);
    expect(writeChecklist(combined, { present: true, items: [] })).toBe(
      `${linked}## Checklist\n`,
    );
  });
  test("extracts ordered duplicates and removes only the section", () => {
    const parsed = parseChecklist(body);
    expect(parsed.items).toEqual([
      { label: "One", completed: true },
      { label: "One", completed: false },
    ]);
    expect(parsed.body).toBe(
      "## Ask\nKeep this.\n\n## Comments\nKeep comments.\n",
    );
    expect(writeChecklist(body, checklistSection(parsed))).toBe(body);
  });
  test("supports uppercase checks, alternate bullets, empty sections and CRLF", () => {
    expect(
      parseChecklist("## Checklist\r\n* [X] Done\r\n+ [ ] Next\r\n").items,
    ).toEqual([
      { label: "Done", completed: true },
      { label: "Next", completed: false },
    ]);
    expect(parseChecklist("## Checklist\n\n").present).toBe(true);
    expect(parseChecklist("ordinary body").present).toBe(false);
    const crlf = body.replaceAll("\n", "\r\n");
    expect(
      writeChecklist(crlf, {
        present: true,
        items: [
          { label: "One", completed: false },
          { label: "One", completed: false },
        ],
      }),
    ).toBe(crlf.replace("[x]", "[ ]"));
  });
  test("ignores fenced and quoted examples; recognizes a real section afterward", () => {
    for (const fence of ["```", "~~~~"]) {
      const example = `${fence}md\n## Checklist\n- [ ] Example\n${fence}\n> ## Checklist\n> - [ ] Quoted\n`;
      expect(parseChecklist(example).present).toBe(false);
      expect(
        parseChecklist(`${example}## Checklist\n- [ ] Real`).items,
      ).toHaveLength(1);
    }
  });
  test("rejects ambiguous sections without losing text", () => {
    for (const invalid of [
      "## Checklist\n- [ ] A\n## Checklist\n",
      "## Checklist\nnotes",
      "## Checklist\n- [ ] ",
      "## Checklist\n- [ ] Parent\n  - [ ] Child",
      "## Checklist\n### Nested\n",
    ])
      expect(() => parseChecklist(invalid)).toThrow();
  });
  test("new sections precede comments and clearing keeps an explicit empty header", () => {
    const added = writeChecklist("## Ask\nBody\n\n## Comments\nComment\n", {
      present: true,
      items: [{ label: "A", completed: false }],
    });
    expect(added.indexOf("## Checklist")).toBeLessThan(
      added.indexOf("## Comments"),
    );
    expect(writeChecklist(added, { present: true, items: [] })).toContain(
      "## Checklist\n\n## Comments",
    );
  });
  test("body edits and checkbox changes merge independently", () => {
    const [intent] = materializeSync(
      input(
        sheet(body.replace("Keep this.", "Changed body.")),
        sheet(body.replace("- [ ] One", "- [x] One")),
      ),
    );
    expect(intent.after.local).toContain("Changed body.");
    expect(
      parseChecklist(intent.after.local!).items.every((i) => i.completed),
    ).toBe(true);
    expect(
      comparisonFields(intent.after.local!, { tagGroups: [] }).fields,
    ).toEqual(comparisonFields(intent.after.remote, { tagGroups: [] }).fields);
  });
  test("competing checklist edits conflict as one field", () => {
    const plan = planSync(
      input(
        sheet(body.replace("[x]", "[ ]")),
        sheet(body.replace("[ ] One", "[x] One")),
      ),
    );
    expect(
      plan.cards[0].changes
        .filter((c) => c.direction === "conflict")
        .map((c) => c.field),
    ).toEqual(["checklist"]);
  });
  test("without a baseline, omission downloads the existing list", () => {
    const [intent] = materializeSync({
      ...input(sheet(parseChecklist(body).body), sheet()),
      baseline: undefined,
    });
    expect(parseChecklist(intent.after.local!).items).toHaveLength(2);
    expect(intent.writeRemote).toBe(false);
  });
  test("baseline detects deliberately removed section", () => {
    const plan = planSync(input(sheet(parseChecklist(body).body), sheet()));
    expect(
      plan.cards[0].changes.find((c) => c.field === "checklist")?.direction,
    ).toBe("upload");
    const [intent] = materializeSync(
      input(sheet(parseChecklist(body).body), sheet()),
    );
    expect(parseChecklist(intent.after.local!).present).toBe(true);
    expect(parseChecklist(intent.after.remote).items).toEqual([]);
  });
});
