import { describe, expect, test } from "bun:test";
import {
  boardTitleContext,
  CARDSTOCK_SLOGAN,
  CARDSTOCK_TITLE,
} from "./site-title";

describe("site titles", () => {
  test("keeps the provisional slogan and brand suffix together", () => {
    expect(CARDSTOCK_SLOGAN).toBe("project zen, on paper");
    expect(CARDSTOCK_TITLE).toBe("cardstock: project zen, on paper");
  });

  test("orders board context from specific to broad", () => {
    expect(boardTitleContext("Roadmap", "Atlas")).toBe("Roadmap | Atlas");
  });
});
