import { expect, test } from "bun:test";
import type { Lane } from "@/lib/types";
import { laneActionCopy } from "./lane-action-dialog";

const lane = (id: string, name: string): Lane => ({
  id,
  key: id,
  name,
  position: 1,
  kind: "work",
  sla_days: null,
  wip_limit: null,
  color: null,
});

test("bulk move confirmation names both lanes and ignores filters", () => {
  const copy = laneActionCopy({
    type: "move-cards",
    lane: lane("now", "Now"),
    destination: lane("next", "Next"),
    cardCount: 12,
  });
  expect(copy.title).toBe("Move all cards from Now?");
  expect(copy.description).toContain("12 cards will be moved to Next");
  expect(copy.description).toContain("current order will be preserved");
});

test("sort confirmation warns that manual order is replaced", () => {
  const copy = laneActionCopy({
    type: "sort-cards",
    lane: lane("later", "Later"),
    direction: "desc",
    cardCount: 4,
  });
  expect(copy.description).toContain("card number descending");
  expect(copy.description).toContain(
    "replaces the lane’s current manual order",
  );
});
