import { describe, expect, it } from "bun:test";
import {
  type CardStencil,
  stencilInitialValues,
  stencilInputSchema,
  stencilStepCount,
  stencilTemplateBody,
} from "./stencils";

const stencil: CardStencil = {
  id: "s1",
  board_id: "b1",
  name: "Integration",
  title: "Integration — ",
  summary: "Stand up one client integration.",
  body_md: "## Ask\n\n## Checklist\n- [ ] Credentialing\n- [ ] Field mapping\n",
  area: "Delivery",
  effort: "M",
  tag_ids: ["t1", "t2"],
};

describe("stencilInitialValues", () => {
  it("seeds the create dialog from the stencil", () => {
    expect(stencilInitialValues(stencil)).toEqual({
      title: "Integration — ",
      summary: "Stand up one client integration.",
      bodyMarkdown:
        "## Ask\n\n## Checklist\n- [ ] Credentialing\n- [ ] Field mapping\n",
      area: "Delivery",
      effort: "M",
      tagIds: ["t1", "t2"],
    });
  });

  it("never seeds a priority, because triage is per card", () => {
    expect(stencilInitialValues(stencil)).not.toHaveProperty("priority");
  });

  it("turns absent fields into empty strings the dialog can hold", () => {
    const bare: CardStencil = {
      ...stencil,
      title: null,
      summary: null,
      area: null,
      effort: null,
      tag_ids: [],
    };
    const seed = stencilInitialValues(bare);
    expect(seed.title).toBe("");
    expect(seed.summary).toBe("");
    expect(seed.area).toBe("");
    expect(seed.effort).toBeNull();
    expect(seed.tagIds).toEqual([]);
  });
});

describe("stencilStepCount", () => {
  it("counts the checklist items in the body", () => {
    expect(stencilStepCount(stencil)).toBe(2);
  });

  it("is zero when the body has no checklist section", () => {
    expect(stencilStepCount({ body_md: "## Ask\n\nJust prose.\n" })).toBe(0);
  });
});

describe("stencilTemplateBody", () => {
  it("imports unbulleted checkboxes while preserving surrounding content", () => {
    const template =
      "## Problem\r\n[ ] Keep this note\r\n\r\n## Approach\r\n\r\n## Checklist\r\n\r\n[ ] T1\r\n[x] T2\r\n- [ ] T3\r\n\r\n## Notes\r\n[ ] Keep this too\r\n";
    expect(stencilTemplateBody(template)).toBe(
      template
        .replace("## Checklist\r\n\r\n", "## Checklist\r\n")
        .replace("[ ] T1", "- [ ] T1")
        .replace("[x] T2", "- [ ] T2"),
    );
  });

  it("preserves valid templates and checkbox examples outside the checklist", () => {
    const template =
      "## Ask\n[ ] A note\n\n```md\n## Checklist\n[ ] Example\n```\n";
    expect(stencilTemplateBody(template)).toBe(template);
    expect(stencilTemplateBody(stencil.body_md)).toBe(stencil.body_md);
  });

  it("still rejects empty labels, nested items and prose without relaxing saved stencils", () => {
    for (const line of ["[ ] ", "  [ ] Nested", "A note", "- [ ] "]) {
      expect(() => stencilTemplateBody(`## Checklist\n${line}\n`)).toThrow();
    }
    expect(() =>
      stencilStepCount({ body_md: "## Checklist\n[ ] T1\n" }),
    ).toThrow();
  });
});

describe("stencil validation", () => {
  const input = {
    name: "Integration",
    title: "",
    summary: "",
    area: "",
    effort: "",
    tagIds: [],
    body: "## Ask\n\n## Checklist\n- [ ] Step\n",
  };
  it("validates limits, effort and malformed checklists", () => {
    for (const change of [
      { name: " " },
      { name: "a".repeat(81) },
      { title: "a".repeat(241) },
      { body: "a".repeat(20001) },
      { effort: "XL" },
      { tagIds: ["bad"] },
      { body: "## Checklist\nnot an item" },
      { body: "## Checklist\n## Checklist\n" },
    ]) {
      expect(
        stencilInputSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
    }
  });
  it("preserves exact body bytes when checklist semantics do not change", () => {
    const body =
      "## Ask\r\n\r\nKeep **this**.\r\n\r\n## Checklist\r\n* [ ] Step\r\n\r\n## Notes\r\nTail.\r\n";
    expect(stencilInputSchema.parse({ ...input, body }).body).toBe(body);
  });
  it("clears completion on saving and stamping without inheriting per-card facts", () => {
    const body = "## Checklist\n- [x] Done\n";
    expect(stencilInputSchema.parse({ ...input, body }).body).toContain(
      "- [ ] Done",
    );
    const seed = stencilInitialValues({ ...stencil, body_md: body });
    expect(seed.bodyMarkdown).toContain("- [ ] Done");
    for (const field of [
      "epicId",
      "laneId",
      "assigneeId",
      "plannedStartDate",
      "targetDate",
      "priority",
    ])
      expect(seed).not.toHaveProperty(field);
    seed.tagIds.push("other");
    expect(stencil.tag_ids).toEqual(["t1", "t2"]);
  });
});
