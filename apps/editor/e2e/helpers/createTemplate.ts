import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Shared E2E helper: create template and open editor (no modal).
 * Location: apps/editor/e2e/helpers/createTemplate.ts
 */
export async function createTemplateViaModal(
  page: Page,
  name = "E2E Template",
): Promise<void> {
  const headerBtn = page.getByRole("button", {
    name: "Neues Template",
    exact: true,
  });
  if (await headerBtn.count()) {
    await headerBtn.click();
  } else {
    await page.getByRole("button", { name: "Erstes Template anlegen" }).click();
  }
  await expect(page).toHaveURL(/\/templates\/[0-9a-f-]+/, { timeout: 15_000 });
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });

  const nameInput = page.getByPlaceholder("Template-Name eingeben");
  await nameInput.fill(name);
  await page.getByPlaceholder("Betreff eingeben").fill("E2E Betreff");
}
