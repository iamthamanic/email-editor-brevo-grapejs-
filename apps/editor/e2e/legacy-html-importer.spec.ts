import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Legacy HTML importer — paste Brevo HTML → Edit converts to blocks.
 * Location: apps/editor/e2e/legacy-html-importer.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/legacy-html-importer",
);

const fixture = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../packages/legacy-importer/fixtures/wrapped-production-brevo.html",
  ),
  "utf8",
);

test("HTML paste converts to email blocks and survives reload", async ({
  page,
}) => {
  await page.goto("/");
  await createTemplateViaModal(page, "Legacy Import E2E");
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });

  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  await page.getByRole("button", { name: "HTML-Quellcode" }).click();
  const code = page.locator(".ed-code-view");
  await expect(code).toBeVisible();
  await code.fill(fixture);

  await page.screenshot({
    path: path.join(evidenceDir, "01-html-paste.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Visuell bearbeiten" }).click();
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Template wird vorbereitet…")).toHaveCount(0, {
    timeout: 20_000,
  });

  const htmlAfter = await page.evaluate(() => {
    const ed = (
      window as Window & { __emailEditor?: { getHtml: () => string } }
    ).__emailEditor;
    return ed?.getHtml() ?? "";
  });

  expect(htmlAfter).toContain("{{ params.name }}");
  expect(htmlAfter).toContain("{{ params.bestellnummer }}");
  expect(htmlAfter).toContain("Sehr geehrte");
  expect(htmlAfter).toContain("Wussten Sie schon");
  expect(htmlAfter).toMatch(/logo-full\.png|mailinblue\.com/);
  expect(htmlAfter).toMatch(/g\.page|review|Google/i);
  expect(htmlAfter).toMatch(/halteverbot123\.de|Kundenportal/i);

  const runtime = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          getWrapper: () => {
            components: () => {
              models: Array<{
                get: (k: string) => unknown;
                getAttributes: () => Record<string, string>;
                findType: (t: string) => unknown[];
              }>;
            };
            findType: (t: string) => Array<{
              getAttributes: () => Record<string, string>;
              findType: (t: string) => unknown[];
            }>;
          };
        };
      }
    ).__emailEditor;
    if (!ed) return null;
    const wrap = ed.getWrapper();
    const top = wrap.components().models.map((m) => ({
      type: String(m.get("type") ?? ""),
      role:
        String(m.get("sectionRole") ?? "") ||
        m.getAttributes()?.["data-role"] ||
        "",
      name: String(m.get("name") ?? ""),
    }));
    const header = wrap
      .findType("email-section")
      .find((s) => s.getAttributes()["data-role"] === "header");
    const footer = wrap
      .findType("email-section")
      .find((s) => s.getAttributes()["data-role"] === "footer");
    const social = wrap
      .findType("email-section")
      .find((s) => s.getAttributes()["data-role"] === "social");
    return {
      top,
      headerImages: header?.findType("email-image").length ?? 0,
      footerCols: footer?.findType("email-column").length ?? 0,
      socialCount: social?.findType("company-social").length ?? 0,
      emailHeaderLegacy: wrap.findType("email-header").length,
    };
  });

  expect(runtime).not.toBeNull();
  expect(runtime!.top.map((t) => t.role)).toEqual([
    "header",
    "content",
    "content",
    "content",
    "footer",
    "social",
  ]);
  expect(runtime!.headerImages).toBe(1);
  expect(runtime!.footerCols).toBe(2);
  expect(runtime!.socialCount).toBe(1);
  expect(runtime!.emailHeaderLegacy).toBe(0);

  const types = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          getWrapper: () => {
            findType: (t: string) => unknown[];
          };
        };
      }
    ).__emailEditor;
    if (!ed) return [];
    const w = ed.getWrapper();
    return [
      "email-section",
      "email-text",
      "email-image",
      "email-param",
      "email-header",
      "email-button",
      "email-columns-2",
      "company-social",
      "company-contact",
    ].map((t) => ({ type: t, count: w.findType(t).length }));
  });
  const byType = Object.fromEntries(types.map((x) => [x.type, x.count]));
  expect(
    (byType["email-section"] ?? 0) + (byType["email-text"] ?? 0),
  ).toBeGreaterThan(0);
  expect(byType["email-image"] ?? 0).toBeGreaterThan(0);
  // Params from HTML must become email-param pills (not raw {{ params.* }} text)
  expect(byType["email-param"] ?? 0).toBeGreaterThan(0);
  expect(byType["email-header"] ?? 0).toBe(0);
  expect(byType["email-button"] ?? 0).toBe(0);

  const canvasText = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          Canvas: { getFrameEl: () => HTMLIFrameElement | undefined };
        };
      }
    ).__emailEditor;
    const doc = ed?.Canvas.getFrameEl()?.contentDocument;
    return doc?.body?.innerText ?? "";
  });
  // Visual mode: human labels, not raw mustache in canvas text
  expect(canvasText).not.toMatch(/\{\{\s*params\.anrede\s*\}\}/);
  expect(canvasText).toMatch(/Anrede|anrede/i);

  const htmlExport = await page.evaluate(() => {
    const ed = (
      window as Window & { __emailEditor?: { getHtml: () => string } }
    ).__emailEditor;
    return ed?.getHtml() ?? "";
  });
  expect(htmlExport).toContain("{{ params.anrede }}");
  expect(htmlExport).toContain("{{ params.name }}");
  expect(htmlExport).not.toMatch(/email-param-badge__label/);
  expect(htmlExport).toMatch(/g\.page|example-review/);
  expect(htmlExport).not.toMatch(/data-email-type="email-button"/);

  await page.screenshot({
    path: path.join(evidenceDir, "02-converted-canvas.png"),
    fullPage: true,
  });

  await page.reload();
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Template wird vorbereitet…")).toHaveCount(0);
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );
  const htmlReload = await page.evaluate(() => {
    const ed = (
      window as Window & { __emailEditor?: { getHtml: () => string } }
    ).__emailEditor;
    return ed?.getHtml() ?? "";
  });
  expect(htmlReload).toContain("{{ params.name }}");
  expect(htmlReload).toContain("Sehr geehrte");

  await page.screenshot({
    path: path.join(evidenceDir, "03-after-reload.png"),
    fullPage: true,
  });
});
