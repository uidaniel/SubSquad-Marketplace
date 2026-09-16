import { defineConfig } from "@playwright/test";
import path from "node:path";

const ORG_STATE = path.join(process.cwd(), "playwright/.auth/org.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // A cold dev server compiles each route on first request, which can take
  // 15s or more. CI builds first, so this generosity costs nothing there.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "on-first-retry",
  },

  projects: [
    // Signs in once; everything else inherits the session.
    { name: "setup", testMatch: /auth\.setup\.ts/ },

    // The auth specs must start signed out — they are testing signing in.
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },

    // Everything else runs as the seeded agency.
    {
      name: "app",
      testIgnore: /auth\.(spec|setup)\.ts/,
      dependencies: ["setup"],
      use: { storageState: ORG_STATE },
    },
  ],

  // Reuses a running dev server locally; starts its own in CI.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3100",
        url: "http://localhost:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
