import { describe, expect, test } from "bun:test";
import { cardAgeState } from "./card-age";

const card = {
  raised_on: "2026-08-01",
  shipped_on: null,
  status: "backlog",
  target_date: null,
  target_label: null,
  lane_id: null,
};

describe("cardAgeState", () => {
  const today = "2026-08-31";
  const watchDays = 14;

  test("fills the ring toward the watch window", () => {
    const state = cardAgeState(card, today, watchDays, []);
    expect(state.ageDays).toBe(30);
    expect(state.progress).toBe(1);
    expect(state.pastWindow).toBeCloseTo((30 - 14) / 14);
    expect(state.signal).toBe("forgotten");
  });

  test("stays open inside the watch window", () => {
    const state = cardAgeState(
      { ...card, raised_on: "2026-08-20" },
      today,
      watchDays,
      [],
    );
    expect(state.progress).toBeCloseTo(11 / 14);
    expect(state.pastWindow).toBe(0);
    expect(state.signal).toBe("active");
  });
});
