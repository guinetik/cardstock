/**
 * Rebuild the demo board from examples/tracker so the Playwright suite starts from a known state.
 * Deletes the demo board's cards (tags, links and events cascade) and re-imports.
 *
 *   bun run etl/e2e-reset.ts
 */
import { spawnSync } from "node:child_process";
import { loadBoard, serviceClient } from "./db";

const db = serviceClient();
const ctx = await loadBoard(db, "demo", "backlog");
const { error } = await db.from("cards").delete().eq("board_id", ctx.board.id);
if (error) throw new Error(error.message);

const r = spawnSync(
  process.execPath,
  [
    "run",
    "etl/import.ts",
    "--project",
    "demo",
    "--board",
    "backlog",
    "--source",
    "examples/tracker",
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) throw new Error(`demo import failed with ${r.status}`);
