import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Phase 2 — email block library acceptance.
 * Location: apps/editor/e2e/phase-2-email-components.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/phase-2-email-components",
);

test("email blocks panel + persist button component", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Neues Template|Erstes Template/ }).click();
  await expect(page).toHaveURL(/\/templates\/[0-9a-f-]+/);
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(() => Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor));

  // Open blocks panel (last toolbar icon typically)
  const blocksBtn = page.locator(".gjs-pn-btn").filter({ has: page.locator(".fa-th-large, .fa-cubes, [class*='blocks']") }).first();
  if (await blocksBtn.count()) {
    await blocksBtn.click();
  } else {
    // Fallback: click blocks manager panel button by title/aria
    await page.locator('.gjs-pn-views-container, .gjs-blocks-c, [class*="gjs-block"]').first().waitFor({ state: "attached", timeout: 5000 }).catch(() => undefined);
  }

  await page.screenshot({
    path: path.join(evidenceDir, "01-blocks-panel.png"),
    fullPage: true,
  });

  const labels = await page.evaluate(() => {
    const ed = (window as Window & {
      __emailEditor?: {
        BlockManager: { getAll: () => { models?: Array<{ get: (k: string) => unknown }> } | Array<{ get: (k: string) => unknown }> };
      };
    }).__emailEditor;
    if (!ed) return [];
    const all = ed.BlockManager.getAll();
    const models = Array.isArray(all) ? all : (all.models ?? []);
    return models.map((m) => String(m.get("label") ?? ""));
  });

  expect(labels).toEqual(
    expect.arrayContaining(["Text", "Überschrift", "Bild", "Button", "Trennlinie", "Abstand", "Section", "1 Spalte", "2 Spalten", "3 Spalten"]),
  );

  await page.evaluate(() => {
    const ed = (window as Window & {
      __emailEditor?: {
        addComponents: (c: unknown) => unknown;
        getWrapper: () => { append: (c: unknown) => unknown };
      };
    }).__emailEditor;
    if (!ed) throw new Error("editor missing");
    ed.addComponents({ type: "email-button" });
  });

  await expect(page.getByText("Gespeichert")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({
    path: path.join(evidenceDir, "02-button-on-canvas.png"),
    fullPage: true,
  });

  await page.reload();
  await page.waitForFunction(() => Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor));

  const hasButton = await page.evaluate(() => {
    const ed = (window as Window & {
      __emailEditor?: {
        getWrapper: () => { find: (s: string) => { length: number } };
        DomComponents: { getWrapper: () => { findType: (t: string) => unknown[] } };
      };
    }).__emailEditor;
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
