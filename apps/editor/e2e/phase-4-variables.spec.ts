import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Phase 4 — variables picker (toolbar dropdown) + sample preview.
 * Location: apps/editor/e2e/phase-4-variables.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/phase-4-variables",
);

test("variable picker inserts params expression and sample preview", async ({
  page,
}) => {
  await page.goto("/");
  await createTemplateViaModal(page, "Phase 4 Vars");
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  await expect(page.getByTestId("editor-toolbar")).toBeVisible();
  await expect(page.getByTestId("toolbar-variables-btn")).toBeVisible();
  await expect(page.getByTestId("toolbar-blocks-btn")).toBeVisible();

  await page.getByTestId("toolbar-variables-btn").click();
  const menu = page.getByTestId("toolbar-variables-menu");
  await expect(menu).toBeVisible();

  const picker = menu.getByTestId("variable-picker");
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("heading", { name: "Kunde" })).toBeVisible();
  await expect(picker.getByRole("heading", { name: "Auftrag" })).toBeVisible();
  await expect(picker.getByRole("heading", { name: "Rechnung" })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, "01-variable-picker.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          addComponents: (c: unknown) => unknown;
          getWrapper: () => {
            find: (s: string) => { at: (i: number) => unknown };
          };
          select: (c: unknown) => void;
        };
      }
    ).__emailEditor;
    if (!ed) throw new Error("editor missing");
    ed.addComponents({
      type: "email-text",
      content: "Hallo ",
    });
    const comp = ed.getWrapper().find('[data-email-type="email-text"]').at(0);
    ed.select(comp);
  });

  // Re-open if closed by canvas focus; then pick Vorname
  if (!(await menu.isVisible())) {
    await page.getByTestId("toolbar-variables-btn").click();
  }
  await page.locator('[data-variable-key="vorname"]').click();

  const htmlAfter = await page.evaluate(() => {
    const ed = (
      window as Window & { __emailEditor?: { getHtml: () => string } }
    ).__emailEditor;
    return ed?.getHtml() ?? "";
  });
  expect(htmlAfter).toContain("{{ params.vorname }}");

  await page.screenshot({
    path: path.join(evidenceDir, "02-expression-on-canvas.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Vorschau" }).click();
  await page.getByLabel("Beispieldaten").check();
  const frame = page.locator(".sample-preview-frame");
  await expect(frame).toBeVisible({ timeout: 10_000 });

  const previewHasSample = await frame.evaluate((el) => {
    const iframe = el as HTMLIFrameElement;
    return iframe.srcdoc.includes("Max");
  });
  expect(previewHasSample).toBe(true);

  const projectStillHasTag = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: { getHtml: () => string };
      }
    ).__emailEditor;
    return ed?.getHtml().includes("{{ params.vorname }}") ?? false;
  });
  expect(projectStillHasTag).toBe(true);

  await page.screenshot({
    path: path.join(evidenceDir, "03-sample-preview.png"),
    fullPage: true,
  });
});
