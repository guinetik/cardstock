import { spawnSync } from "node:child_process";

/**
 * Put the demo board back the way `examples/tracker` states it.
 *
 * `global-setup` runs this once for the suite, but a spec that asserts a file
 * byte for byte cannot rely on that: another spec may have edited a card
 * first, and Playwright's file order is not a contract. Those specs call this
 * again in a `test.beforeAll` and stand on their own.
 */
export function resetDemoBoard() {
  const bun = process.platform === "win32" ? "bun.exe" : "bun";
  const r = spawnSync(bun, ["run", "etl/e2e-reset.ts"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) throw new Error(`e2e reset failed with ${r.status}`);
}
