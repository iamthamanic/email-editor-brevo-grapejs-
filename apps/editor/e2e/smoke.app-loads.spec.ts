import { test, expect } from "@playwright/test";

/**
 * Smoke: editor app loads German list chrome (card list).
 * Location: apps/editor/e2e/smoke.app-loads.spec.ts
 */
test("app loads template list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E-Mail Templates" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Neues Template|Erstes Template/ }),
  ).toBeVisible();
  const search = page.getByTestId("template-list-search");
  if (await search.count()) {
    await expect(search).toBeVisible();
    await expect(page.getByTestId("template-list")).toBeVisible();
    await expect(page.getByTestId("template-card-list")).toBeVisible();
    await expect(page.getByTestId("template-select-all")).toBeVisible();
    await expect(page.getByTestId("template-status-filter")).toBeVisible();
  }
});
