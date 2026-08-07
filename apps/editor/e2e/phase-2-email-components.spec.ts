import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Phase 2 — email block library acceptance (toolbar Blöcke dropdown).
 * Location: apps/editor/e2e/phase-2-email-components.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/phase-2-email-components",
);

async function waitForIdleSave(page: import("@playwright/test").Page) {
  await expect(page.locator(".ed-save-pill")).toHaveText("Gespeichert", {
    timeout: 15_000,
  });
  await expect(page.getByText("Speichern…")).toHaveCount(0);
}

test("email blocks panel + persist button component", async ({ page }) => {
  await page.goto("/");
  await createTemplateViaModal(page, "Phase 2 Blocks");
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  await waitForIdleSave(page);

  await page.getByTestId("toolbar-blocks-btn").click();
  const menu = page.getByTestId("toolbar-blocks-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Inhalt")).toBeVisible();
  await expect(menu.getByText("Layout")).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, "01-blocks-panel.png"),
    fullPage: true,
  });

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
      "Text",
      "Überschrift",
      "Bild",
      "Button",
      "Trennlinie",
      "Abstand",
      "Bereich",
      "Header",
      "Footer",
      "1 Spalte",
      "2 Spalten",
      "3 Spalten",
    ]),
  );

  const saveResponse = page.waitForResponse(
    (r) =>
      r.request().method() === "PATCH" &&
      r.url().includes("/api/templates/") &&
      r.ok(),
    { timeout: 15_000 },
  );
  await menu.locator('[data-block-type="email-button"]').click();

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
        return ed.DomComponents.getWrapper().findType("email-button").length;
      });
    })
    .toBeGreaterThan(0);

  await saveResponse;
  await waitForIdleSave(page);

  await page.screenshot({
    path: path.join(evidenceDir, "02-button-on-canvas.png"),
    fullPage: true,
  });

  await page.reload();
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  const hasButton = await page.evaluate(() => {
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
    const found = ed.DomComponents.getWrapper().findType("email-button");
    return Array.isArray(found) && found.length > 0;
  });

  expect(hasButton).toBeTruthy();
  await page.screenshot({
    path: path.join(evidenceDir, "03-after-reload-blocks.png"),
    fullPage: true,
  });
});
