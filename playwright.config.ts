import { loadEnvConfig } from "@next/env";
import { defineConfig } from "@playwright/test";

loadEnvConfig(process.cwd());

// Local stack: `bunx supabase start`, `bun run db:seed-members`, an import, then `bun run test:e2e`.
// Uses the installed Chrome (no browser download) and the dev sign-in button (no password).
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    channel: "chrome",
    headless: true,
    baseURL: "http://localhost:3000",
    viewport: { width: 1800, height: 1000 },
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
