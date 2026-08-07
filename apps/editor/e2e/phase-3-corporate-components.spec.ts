import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 3 — corporate (Firma) blocks acceptance.
 * Location: apps/editor/e2e/phase-3-corporate-components.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/phase-3-corporate-components",
);

test("firma blocks panel + persist company-header", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Neues Template|Erstes Template/ }).click();
  await expect(page).toHaveURL(/\/templates\/[0-9a-f-]+/);
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  const labels = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          BlockManager: {
            getAll: () =>
              | { models?: Array<{ get: (k: string) => unknown }> }
              | Array<{ get: (k: string) => unknown }>;
          };
        };
      }
    ).__emailEditor;
    if (!ed) return [];
    const all = ed.BlockManager.getAll();
    const models = Array.isArray(all) ? all : (all.models ?? []);
    return models.map((m) => String(m.get("label") ?? ""));
  });

  expect(labels).toEqual(
    expect.arrayContaining([
      "Header",
      "Footer",
      "Legal",
      "Kontakt",
      "Social",
      "Text",
      "Button",
    ]),
  );

  const categories = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          BlockManager: {
            getCategories: () =>
              | { models?: Array<{ get: (k: string) => unknown }> }
              | Array<{ get: (k: string) => unknown }>;
          };
        };
      }
    ).__emailEditor;
    if (!ed?.BlockManager.getCategories) return [];
    const all = ed.BlockManager.getCategories();
    const models = Array.isArray(all) ? all : (all.models ?? []);
    return models.map((m) => String(m.get("label") ?? m.get("id") ?? ""));
  });

  expect(categories.join(" ")).toMatch(/Firma/i);

  await page.screenshot({
    path: path.join(evidenceDir, "01-firma-blocks.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          addComponents: (c: unknown) => unknown;
        };
      }
    ).__emailEditor;
    if (!ed) throw new Error("editor missing");
    ed.addComponents({ type: "company-header" });
  });

  await expect(page.getByText("Gespeichert")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({
    path: path.join(evidenceDir, "02-header-on-canvas.png"),
    fullPage: true,
  });

  await page.reload();
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  const hasHeader = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          DomComponents: {
            getWrapper: () => { findType: (t: string) => unknown[] };
          };
        };
      }
    ).__emailEditor;
    if (!ed) return false;
    const found = ed.DomComponents.getWrapper().findType("company-header");
    return Array.isArray(found) && found.length > 0;
  });

  expect(hasHeader).toBeTruthy();
  await page.screenshot({
    path: path.join(evidenceDir, "03-after-reload-corporate.png"),
    fullPage: true,
  });
});
