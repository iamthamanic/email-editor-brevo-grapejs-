import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Verify-UI evidence for Brevo-style card list (mirrors .qa/runs entry).
 * Location: apps/editor/e2e/brevo-card-list.verify.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/brevo-card-list",
);

test("card list chrome + pagination + menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E-Mail Templates" })).toBeVisible();
  await expect(page.getByTestId("template-list")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("template-card-list")).toBeVisible();
  await expect(page.getByTestId("template-status-filter")).toBeVisible();
  await expect(page.getByTestId("template-list-row").first()).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, "01-card-list.png"),
    fullPage: true,
  });

  await page.getByTestId("template-status-filter").selectOption("DRAFT");
  await page.screenshot({
    path: path.join(evidenceDir, "02-status-filter-draft.png"),
    fullPage: true,
  });
  await page.getByTestId("template-status-filter").selectOption("ALL");

  const next = page.getByTestId("template-page-next");
  if (await next.isEnabled()) {
    await next.click();
    await page.screenshot({
      path: path.join(evidenceDir, "03-page-2.png"),
      fullPage: true,
    });
    await page.getByTestId("template-page-prev").click();
  }

  await page.getByTestId("template-list-row").first().getByTestId("template-row-menu").click();
  await expect(page.getByTestId("template-row-menu-panel")).toBeVisible();
  await page.screenshot({
    path: path.join(evidenceDir, "04-row-menu.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
});
