import { expect, test } from "bun:test";
import type { Lane } from "@/lib/types";
import { laneDialogCopy } from "./lane-crud-dialog";

const lane = (key: string, name: string, kind: Lane["kind"]): Lane => ({
  id: `id-${key}`,
  key,
  name,
  position: 1,
  kind,
  sla_days: null,
  wip_limit: null,
  color: null,
});

test("renaming any lane promises the ID will not change", () => {
  const done = laneDialogCopy(
    { type: "rename", lane: lane("done", "Done", "done") },
    0,
  );
  const work = laneDialogCopy(
    { type: "rename", lane: lane("now", "Now", "work") },
    0,
  );
  expect(done).toBe(work);
  expect(done).toContain("the ID stays the same");
  expect(done).not.toMatch(/stay fixed/i);
});

// The former "the name field is not read-only for a done lane" test is gone:
// DialogContent requires a Dialog.Root context (base-ui throws
// "DialogRootContext is missing" without one), so LaneDialogForm cannot be
// rendered standalone under renderToStaticMarkup, and rendering it through
// LaneCrudDialog's real <Dialog> hits the portal and yields an empty string
// either way — the exact vacuous assertion this test used to make. A green
// light that means nothing is worse than no light.
