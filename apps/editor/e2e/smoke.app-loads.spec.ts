import { test, expect } from "@playwright/test";

/**
 * Smoke: editor app loads German list chrome.
 * Location: apps/editor/e2e/smoke.app-loads.spec.ts
 */
test("app loads template list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E-Mail Templates" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Neues Template|Erstes Template/ })).toBeVisible();
});
