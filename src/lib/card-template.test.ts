import { describe, expect, test } from "bun:test";
import { CARD_TEMPLATE_SETTING, cardTemplate } from "./card-template";

describe("cardTemplate", () => {
  test("returns the trimmed template markdown from board settings", () => {
    expect(
      cardTemplate({ [CARD_TEMPLATE_SETTING]: "## Problem\n\n## Approach\n" }),
    ).toBe("## Problem\n\n## Approach");
  });

  test("empty for missing, blank, or non-string values", () => {
    expect(cardTemplate(undefined)).toBe("");
    expect(cardTemplate(null)).toBe("");
    expect(cardTemplate({})).toBe("");
    expect(cardTemplate({ [CARD_TEMPLATE_SETTING]: "   " })).toBe("");
    expect(cardTemplate({ [CARD_TEMPLATE_SETTING]: 42 })).toBe("");
  });
});
