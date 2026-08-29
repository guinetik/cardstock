import { resetDemoBoard } from "./support/reset";

/** Reset the demo board before the suite; the tests move, rate and archive cards. */
export default function globalSetup() {
  if (process.env.E2E_SKIP_RESET === "1") return;
  resetDemoBoard();
}
