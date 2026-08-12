/**
 * Verify-UI — layout-row empty dropzones + footer logo float fix.
 * Acceptance: `.qa/acceptance/layout-dropzone-footer-float.md`
 * Evidence: `.qa/evidence/layout-dropzone-footer-float/`
 * Location: apps/editor/e2e/verify-layout-dropzone-footer-float.spec.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { convertBrevoHtml } from "@email-template/legacy-importer";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";

const root = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(
  root,
  "../../../.qa/evidence/layout-dropzone-footer-float",
);

const productionHtml = readFileSync(
  path.resolve(
    root,
    "../../../packages/legacy-importer/fixtures/production-brevo-template-4.html",
  ),
  "utf8",
);

test.describe("verify-ui layout-dropzone-footer-float", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("empty email-layout-row columns show idle dropzone without section data-layout", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page, "structural-template");

    const report = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      if (!ed) throw new Error("no editor");

      const wrap = ed.getWrapper();
      const content = (wrap.findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      content?.removeAttributes?.("data-layout");
      content?.removeAttributes?.("data-layout-cols");
      const col = content?.findType?.("email-column")?.[0];
      if (!col) throw new Error("no content column");

      col.append({
        type: "email-layout-row",
        attributes: {
          "data-email-type": "email-layout-row",
          "data-layout": "columns",
          "data-layout-cols": "2",
        },
        components: [
          {
            type: "email-row",
            components: [
              {
                type: "email-column",
                columnWidth: 50,
                attributes: { width: "50%" },
                components: [],
              },
              {
                type: "email-column",
                columnWidth: 50,
                attributes: { width: "50%" },
                components: [],
              },
            ],
          },
        ],
      });

      const layouts = wrap.findType("email-layout-row") as any[];
      const layout = layouts[layouts.length - 1];
      const cols = layout?.findType?.("email-column") ?? [];
      const frame = ed.Canvas.getFrameEl?.() as HTMLIFrameElement | undefined;
      const win = frame?.contentDocument?.defaultView;
      const contentSec = content?.getEl?.() as HTMLElement | undefined;

      return {
        contentSectionDataLayout: contentSec?.getAttribute("data-layout"),
        measures: cols.map((c: any) => {
          const el = c.getEl?.() as HTMLElement | undefined;
          if (!el || !win) return null;
          const cs = win.getComputedStyle(el);
          const after = win.getComputedStyle(el, "::after");
          return {
            domKidCount: el.querySelectorAll(":scope > [data-email-type]")
              .length,
            minHeight: cs.minHeight,
            borderStyle: cs.borderTopStyle,
            afterContent: after.content,
          };
        }),
      };
    });

    writeFileSync(
      path.join(evidenceDir, "A-layout-empty-dropzone.json"),
      JSON.stringify(report, null, 2),
    );
    await page.screenshot({
      path: path.join(evidenceDir, "01-layout-row-empty-dropzones.png"),
      fullPage: true,
    });

    expect(report.contentSectionDataLayout).toBeNull();
    expect(report.measures.length).toBe(2);
    for (const m of report.measures) {
      expect(m?.domKidCount).toBe(0);
      expect(m?.afterContent ?? "").toMatch(/Inhalt hinzufügen/);
      expect(m?.borderStyle).toBe("dashed");
      expect(Number.parseInt(m?.minHeight ?? "0", 10)).toBeGreaterThanOrEqual(
        100,
      );
    }
  });

  test("production footer logo does not float; company name stacks below", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { components } = convertBrevoHtml(productionHtml);
    // Guard: importer must not emit HTML align on images (td align is OK)
    const imgs: Array<Record<string, unknown>> = [];
    const walk = (n: unknown) => {
      if (!n || typeof n !== "object") return;
      const node = n as {
        type?: string;
        attributes?: Record<string, string>;
        components?: unknown;
      };
      if (node.type === "email-image") imgs.push(node.attributes ?? {});
      const kids = node.components;
      if (Array.isArray(kids)) kids.forEach(walk);
    };
    components.forEach(walk);
    for (const attrs of imgs) {
      expect(attrs.align, JSON.stringify(attrs)).toBeUndefined();
    }

    const editorData = { __etsImport: 1, components };
    await page.goto("/");
    const id = await page.evaluate(
      async ({ name, data }) => {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            subject: "Verify footer float",
            editorData: data,
          }),
        });
        const json = (await res.json()) as {
          data?: { id?: string };
          id?: string;
        };
        return json.data?.id ?? json.id;
      },
      { name: `Verify-Footer-${Date.now()}`, data: editorData },
    );
    expect(id).toBeTruthy();
    await page.goto(`/templates/${id}`);
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const sec = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) => String(s.getAttributes()?.["data-role"] ?? "") === "footer",
      );
      sec?.getEl?.()?.scrollIntoView?.({ block: "center" });
    });
    await page.waitForTimeout(1200);

    const geo = await page.evaluate(async () => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const footer = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) => String(s.getAttributes()?.["data-role"] ?? "") === "footer",
      );
      const logo = footer
        ?.findType?.("email-image")
        ?.find(
          (i: any) => i.getAttributes()?.["data-role"] === "brand-logo",
        );
      const contact = footer
        ?.findType?.("email-text")
        ?.find(
          (t: any) => t.getAttributes()?.["data-role"] === "company-contact",
        );
      const logoEl = logo?.getEl?.() as HTMLImageElement | undefined;
      const firstP = contact?.getEl?.()?.querySelector("p") as HTMLElement | null;
      if (logoEl && !logoEl.complete) {
        await new Promise<void>((resolve) => {
          logoEl.addEventListener("load", () => resolve(), { once: true });
          logoEl.addEventListener("error", () => resolve(), { once: true });
          setTimeout(resolve, 2000);
        });
      }
      const lr = logoEl?.getBoundingClientRect();
      const pr = firstP?.getBoundingClientRect();
      const cs = logoEl ? getComputedStyle(logoEl) : null;
      return {
        companyText: (firstP?.textContent ?? "").trim(),
        float: cs?.float ?? null,
        alignAttr: logoEl?.getAttribute("align"),
        logoH: lr ? Math.round(lr.height) : 0,
        stackedBelow:
          lr && pr ? pr.top >= lr.top + Math.max(lr.height, 1) - 2 : false,
        firstPHeight: pr ? Math.round(pr.height) : 0,
      };
    });

    writeFileSync(
      path.join(evidenceDir, "D-footer-geometry.json"),
      JSON.stringify(geo, null, 2),
    );
    await page.screenshot({
      path: path.join(evidenceDir, "02-footer-logo-stacked.png"),
      fullPage: true,
    });

    expect(geo.companyText).toMatch(/Browo/i);
    expect(geo.float).toBe("none");
    expect(geo.alignAttr).toBeNull();
    expect(geo.stackedBelow).toBe(true);
    // Single-line company name — not 4-line wrap beside float
    expect(geo.firstPHeight).toBeLessThan(40);
  });
});
