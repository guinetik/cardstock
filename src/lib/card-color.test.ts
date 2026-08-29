import { describe, expect, test } from "bun:test";
import {
  CARD_COLORS,
  cardColorModifier,
  cardColorSurfaceToken,
  isCardColor,
  laneColorModifier,
  parseCardColor,
} from "./card-color";

describe("card color contract", () => {
  test("defines the nine standardized colors", () => {
    expect(CARD_COLORS).toEqual([
      "rose",
      "orange",
      "amber",
      "green",
      "cyan",
      "blue",
      "indigo",
      "violet",
      "pink",
    ]);
    for (const color of CARD_COLORS) expect(isCardColor(color)).toBe(true);
  });

  test("rejects arbitrary values and defensively maps them to neutral", () => {
    expect(isCardColor("chartreuse")).toBe(false);
    expect(isCardColor(null)).toBe(false);
    expect(parseCardColor("chartreuse")).toBeNull();
    expect(parseCardColor(null)).toBeNull();
  });

  test("maps a valid color to its CSS modifier and token", () => {
    expect(cardColorModifier("blue")).toBe("card-color--blue");
    expect(cardColorModifier(null)).toBeNull();
    expect(cardColorSurfaceToken("blue")).toBe("--surface-card-blue");
    expect(laneColorModifier("blue")).toBe("lane-color--blue");
    expect(laneColorModifier(null)).toBeNull();
  });
});
