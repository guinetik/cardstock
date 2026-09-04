import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lane } from "@/lib/types";
import { LaneCrudDialog, laneDialogCopy } from "./lane-crud-dialog";

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

test("the name field is not read-only for a done lane", () => {
  const html = renderToStaticMarkup(
    <LaneCrudDialog
      mode={{ type: "rename", lane: lane("done", "Done", "done") }}
      lanes={[lane("done", "Done", "done")]}
      cardCount={0}
      onClose={() => {}}
      onCreate={async () => null}
      onRename={async () => null}
      onDelete={async () => null}
    />,
  );
  expect(html).not.toContain("readonly");
});
