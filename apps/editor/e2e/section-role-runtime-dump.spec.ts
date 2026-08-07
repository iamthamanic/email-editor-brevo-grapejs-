/**
 * Debug dump: HTML paste → Visual convert → Grapes runtime tree roles.
 * Location: apps/editor/e2e/section-role-runtime-dump.spec.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { convertBrevoHtml } from "@email-template/legacy-importer";
import { createTemplateViaModal } from "./helpers/createTemplate";

const fixture = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../packages/legacy-importer/fixtures/wrapped-production-brevo.html",
  ),
  "utf8",
);

type CompApi = {
  get: (k: string) => unknown;
  getAttributes: () => Record<string, string>;
  components: () => { models: CompApi[]; length: number };
  findType: (t: string) => CompApi[];
};

function topRolesFrom(wrap: CompApi) {
  return wrap.components().models.map((m) => ({
    type: String(m.get("type") ?? ""),
    sectionRole: m.get("sectionRole"),
    dataRole: m.getAttributes()?.["data-role"],
    name: m.get("name"),
    childTypes: m.components().models.map((c) => String(c.get("type") ?? "")),
  }));
}

test("HTML→Visual force path preserves section roles in runtime", async ({
  page,
}) => {
  const { document, components } = convertBrevoHtml(fixture);
  const normalizedRoles = document.children.map((s) => s.role ?? "content");
  const mapperRoles = components.map(
    (c) =>
      (c as { attributes?: Record<string, string> }).attributes?.["data-role"] ??
      "?",
  );

  await page.goto("/");
  await createTemplateViaModal(page, "HTML Visual Role Dump");
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  await page.getByRole("button", { name: "HTML-Quellcode" }).click();
  await page.locator(".ed-code-view").fill(fixture);
  await page.getByRole("button", { name: "Visuell bearbeiten" }).click();
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Template wird vorbereitet…")).toHaveCount(0, {
    timeout: 20_000,
  });

  const dump = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          getWrapper: () => CompApi;
          getProjectData: () => Record<string, unknown>;
          loadProjectData: (d: unknown) => void;
          getHtml: () => string;
          setComponents: (c: unknown) => void;
        };
      }
    ).__emailEditor;
    if (!ed) throw new Error("no editor");

    const wrap = ed.getWrapper();
    const topRoles = wrap.components().models.map((m) => ({
      type: String(m.get("type") ?? ""),
      sectionRole: m.get("sectionRole"),
      dataRole: m.getAttributes()?.["data-role"],
      name: m.get("name"),
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

    const project = ed.getProjectData();
    ed.loadProjectData(project);
    const afterReload = ed.getWrapper().components().models.map((m) => ({
      type: String(m.get("type") ?? ""),
      sectionRole: m.get("sectionRole"),
      dataRole: m.getAttributes()?.["data-role"],
      name: m.get("name"),
    }));

    // Visual → HTML → setComponents via Components.parse? use getHtml string into Components
    const html = ed.getHtml();

    return {
      topRoles,
      afterReload,
      headerImages: header?.findType("email-image").length ?? 0,
      footerCols: footer?.findType("email-column").length ?? 0,
      footerImages: footer?.findType("email-image").length ?? 0,
      socialCount: social?.findType("company-social").length ?? 0,
      htmlHasHeaderRole: html.includes('data-role="header"'),
      htmlHasFooterRole: html.includes('data-role="footer"'),
      htmlHasSocialRole: html.includes('data-role="social"'),
      projectHasEtsImport: project.__etsImport === 1,
      projectComponentRoles: Array.isArray(project.components)
        ? (project.components as Array<{ attributes?: Record<string, string> }>).map(
            (c) => c.attributes?.["data-role"],
          )
        : "not-ets-import",
    };
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ normalizedRoles, mapperRoles, dump }, null, 2),
  );

  expect(normalizedRoles).toEqual([
    "header",
    "content",
    "content",
    "content",
    "footer",
    "social",
  ]);
  expect(mapperRoles).toEqual(normalizedRoles);
  expect(dump.topRoles.map((r) => r.dataRole)).toEqual([
    "header",
    "content",
    "content",
    "content",
    "footer",
    "social",
  ]);
  expect(dump.headerImages).toBe(1);
  expect(dump.footerCols).toBe(2);
  expect(dump.footerImages).toBeGreaterThanOrEqual(2);
  expect(dump.socialCount).toBe(1);
  expect(dump.htmlHasHeaderRole).toBe(true);
  expect(dump.htmlHasFooterRole).toBe(true);
  expect(dump.afterReload.map((r) => r.dataRole)).toEqual([
    "header",
    "content",
    "content",
    "content",
    "footer",
    "social",
  ]);

  // Visual → HTML → Visual (force convert of Grapes export)
  const exported = await page.evaluate(() => {
    const ed = (
      window as Window & { __emailEditor?: { getHtml: () => string } }
    ).__emailEditor;
    return ed?.getHtml() ?? "";
  });
  expect(exported).toContain('data-role="header"');

  await page.getByRole("button", { name: "HTML-Quellcode" }).click();
  await page.locator(".ed-code-view").fill(exported);
  await page.getByRole("button", { name: "Visuell bearbeiten" }).click();
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Template wird vorbereitet…")).toHaveCount(0, {
    timeout: 20_000,
  });

  const afterRoundtrip = await page.evaluate(() => {
    const ed = (
      window as Window & {
        __emailEditor?: {
          getWrapper: () => {
            components: () => {
              models: Array<{
                get: (k: string) => unknown;
                getAttributes: () => Record<string, string>;
              }>;
            };
          };
        };
      }
    ).__emailEditor;
    if (!ed) return [];
    return ed.getWrapper().components().models.map((m) => ({
      role:
        String(m.get("sectionRole") ?? "") ||
        m.getAttributes()?.["data-role"] ||
        "",
      name: String(m.get("name") ?? ""),
    }));
  });

  expect(afterRoundtrip.map((r) => r.role)).toEqual([
    "header",
    "content",
    "content",
    "content",
    "footer",
    "social",
  ]);
  expect(afterRoundtrip.map((r) => r.name)).toEqual([
    "Header",
    "Inhalt",
    "Inhalt",
    "Inhalt",
    "Footer",
    "Social Media",
  ]);
});
