import { expect, test } from "bun:test";
import {
  parseBoardPins,
  pinnedLaneId,
  type StoredBoardPins,
  setBoardPin,
} from "./lane-pin";

test("parseBoardPins keeps string pairs and drops everything else", () => {
  const parsed = parseBoardPins({
    "board-a": "lane-1",
    "board-b": "",
    "board-c": null,
    "board-d": 7,
    "board-e": { lane: "lane-2" },
    "board-f": ["lane-3"],
  });
  expect(parsed).toEqual({ "board-a": "lane-1" });
});

test("parseBoardPins survives whatever storage hands back", () => {
  expect(parseBoardPins(null)).toEqual({});
  expect(parseBoardPins(undefined)).toEqual({});
  expect(parseBoardPins("not an object")).toEqual({});
  expect(parseBoardPins(["board-a", "lane-1"])).toEqual({});
  expect(parseBoardPins(42)).toEqual({});
});

test("setBoardPin leaves other boards alone", () => {
  const before: StoredBoardPins = { "board-a": "lane-1", "board-b": "lane-2" };
  const after = setBoardPin(before, "board-b", "lane-9");
  expect(after).toEqual({ "board-a": "lane-1", "board-b": "lane-9" });
});

test("setBoardPin with null removes the entry rather than emptying it", () => {
  const after = setBoardPin(
    { "board-a": "lane-1", "board-b": "lane-2" },
    "board-a",
    null,
  );
  expect(after).toEqual({ "board-b": "lane-2" });
  expect("board-a" in after).toBe(false);
});

test("setBoardPin does not mutate what it was given", () => {
  const before: StoredBoardPins = { "board-a": "lane-1" };
  setBoardPin(before, "board-a", "lane-2");
  expect(before).toEqual({ "board-a": "lane-1" });
});

test("pinnedLaneId returns the pin when the lane still exists", () => {
  expect(
    pinnedLaneId({ "board-a": "lane-1" }, "board-a", ["lane-1", "lane-2"]),
  ).toBe("lane-1");
});

test("a pin naming a deleted lane reads as no pin, not a stuck empty column", () => {
  expect(
    pinnedLaneId({ "board-a": "lane-gone" }, "board-a", ["lane-1"]),
  ).toBeNull();
});

test("pinnedLaneId ignores another board's pin", () => {
  expect(
    pinnedLaneId({ "board-b": "lane-1" }, "board-a", ["lane-1"]),
  ).toBeNull();
});

test("pinnedLaneId with nothing stored is null", () => {
  expect(pinnedLaneId(null, "board-a", ["lane-1"])).toBeNull();
  expect(pinnedLaneId({}, "board-a", ["lane-1"])).toBeNull();
});
