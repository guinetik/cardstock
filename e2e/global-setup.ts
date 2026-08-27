import { spawnSync } from "node:child_process";

/** Reset the demo board before the suite; the tests move, rate and archive cards. */
export default function globalSetup() {
  if (process.env.E2E_SKIP_RESET === "1") return;
  const bun = process.platform === "win32" ? "bun.exe" : "bun";
  const r = spawnSync(bun, ["run", "etl/e2e-reset.ts"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) throw new Error(`e2e reset failed with ${r.status}`);
}
