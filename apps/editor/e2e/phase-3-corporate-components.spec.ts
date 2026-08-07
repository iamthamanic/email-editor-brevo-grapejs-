import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Phase 3 — corporate (Firma) blocks via toolbar Blöcke dropdown.
 * Location: apps/editor/e2e/phase-3-corporate-components.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/phase-3-corporate-components",
);

async function waitForIdleSave(page: import("@playwright/test").Page) {
  await expect(page.getByText("Gespeichert")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Speichern…")).toHaveCount(0);
}

test("firma blocks panel + persist company-header", async ({ page }) => {
  await page.goto("/");
  await createTemplateViaModal(page, "Phase 3 Firma");
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  await waitForIdleSave(page);

  await page.getByTestId("toolbar-blocks-btn").click();
  const menu = page.getByTestId("toolbar-blocks-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Firma")).toBeVisible();

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

  const saveResponse = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().includes("/api/templates/") &&
      r.ok(),
    { timeout: 15_000 },
  );
  await menu.locator('[data-block-type="company-header"]').click();

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const ed = (
          window as Window & {
            __emailEditor?: {
              DomComponents: {
                getWrapper: () => { findType: (t: string) => unknown[] };
              };
            };
          }
        ).__emailEditor;
        if (!ed) return 0;
        return ed.DomComponents.getWrapper().findType("company-header").length;
      });
    })
    .toBeGreaterThan(0);

  await saveResponse;
  await waitForIdleSave(page);

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
