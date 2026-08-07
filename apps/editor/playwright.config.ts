import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright for email-template editor (Vite) + API proxy.
 * Location: apps/editor/playwright.config.ts
 */
const devUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../../.qa/test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../../playwright-report" }]],
  use: {
    baseURL: devUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev --workspace=@email-template/api",
      cwd: "../..",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev --workspace=@email-template/editor",
      cwd: "../..",
      url: devUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
