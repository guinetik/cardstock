import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { laneMicrocosm } from "@/lib/lane-map";
import { LaneMap } from "./lane-map";

test("tinted slips use the card colour; untinted slips use the cockpit signal", () => {
  const rows = laneMicrocosm(
    [
      { id: "a", name: "Archive", kind: "archive", position: 99, color: null },
      { id: "u", name: "Unsorted", kind: "inbox", position: 0, color: null },
      { id: "n", name: "Now", kind: "work", position: 1, color: "blue" },
      { id: "w", name: "Needs Hap", kind: "waiting", position: 2, color: null },
      { id: "d", name: "Done", kind: "done", position: 3, color: null },
    ],
    [
      ...Array.from({ length: 7 }, (_, rank) => ({
        lane_id: "u",
        archived_at: null,
        color: null,
        rank,
      })),
      ...Array.from({ length: 4 }, (_, rank) => ({
        lane_id: "n",
        archived_at: null,
        color: null,
        rank,
      })),
      { lane_id: "w", archived_at: null, color: "rose", rank: 0 },
      { lane_id: "w", archived_at: null, color: null, rank: 1 },
      { lane_id: "n", archived_at: "2026-01-01", color: "green", rank: 0 },
      { lane_id: "d", archived_at: "2026-01-02", color: null, rank: 1 },
    ],
  );
  const html = renderToStaticMarkup(<LaneMap href="/p/x/b/y" rows={rows} />);
  expect(html).toContain("lane-map");
  expect(html).toContain("lane-map-pack");
  expect(html).toContain('data-kind="inbox"');
  expect(html).toContain("Needs Hap · 2");
  expect(html).toContain("archived · 2");
  expect(html).toContain("lane-map-cell--vacant");
  expect(html).toContain("lane-map-cell--queued");
  expect(html).toContain("lane-map-cell--blocked");
  expect(html).toContain("lane-map-cell--delivered");
  expect(html).toContain("card-color--rose");
  expect(html).toContain("card-color--green");
  expect(html).toContain("lane-color--blue");
  expect(html).not.toContain("lane-map-col--work");
  expect(html).not.toContain('class="stat');
});
