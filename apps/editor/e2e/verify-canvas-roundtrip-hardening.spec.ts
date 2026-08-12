/**
 * Verify Off-DOM + live publish HTML round-trip (Phase 5 R1).
 * Acceptance: `.qa/acceptance/canvas-roundtrip-hardening.md`
 * Evidence: `.qa/evidence/canvas-roundtrip-hardening/`
 * Location: apps/editor/e2e/verify-canvas-roundtrip-hardening.spec.ts
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { convertBrevoHtml } from "@email-template/legacy-importer";
import type { EmailBlock, NormalizedEmailDocument } from "@email-template/legacy-importer";

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/canvas-roundtrip-hardening",
);

const fixture = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../packages/legacy-importer/fixtures/wrapped-production-brevo.html",
  ),
  "utf8",
);

const EXPECTED_ROLES = ["header", "content", "footer", "social"] as const;

function inventoryBlocks(blocks: EmailBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "layout-row") {
      out.push("layout-row");
      for (const col of b.columns) {
        for (const t of inventoryBlocks(col.children)) {
          out.push(`lr>${t}`);
        }
      }
    } else {
      out.push(b.type);
    }
  }
  return out;
}

function treeFingerprint(doc: NormalizedEmailDocument) {
  return doc.children.map((sec) => ({
    role: sec.role ?? "content",
    cols: sec.columns.length,
    blocks: sec.columns.flatMap((c) => inventoryBlocks(c.children)),
  }));
}

test.describe("verify-ui canvas-roundtrip-hardening", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("Off-DOM renderEditorDataToPublishHtml round-trips like convert path", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const pass1 = convertBrevoHtml(fixture);
    expect(pass1.document.children.map((s) => s.role ?? "content")).toEqual([
      ...EXPECTED_ROLES,
    ]);

    const editorData = {
      __etsImport: 1,
      components: pass1.components,
    };

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const published = await page.evaluate(async (data) => {
      const mod = await import("/src/templates/renderEditorDataHtml.ts");
      return mod.renderEditorDataToPublishHtml(data);
    }, editorData);

    expect(published).toContain("data-email-type");
    expect(published).toContain("data-section-role");
    expect(published).toMatch(/data-role=["']header["']/);

    const pass2 = convertBrevoHtml(published);
    expect(treeFingerprint(pass2.document)).toEqual(
      treeFingerprint(pass1.document),
    );

    // Second Off-DOM pass must be noop
    const editorData2 = {
      __etsImport: 1,
      components: pass2.components,
    };
    const published2 = await page.evaluate(async (data) => {
      const mod = await import("/src/templates/renderEditorDataHtml.ts");
      return mod.renderEditorDataToPublishHtml(data);
    }, editorData2);
    const pass3 = convertBrevoHtml(published2);
    expect(treeFingerprint(pass3.document)).toEqual(
      treeFingerprint(pass2.document),
    );

    await page.screenshot({
      path: path.join(evidenceDir, "01-offdom-roundtrip.png"),
      fullPage: true,
    });
  });

  test("live getHtml + buildPublishHtml matches Off-DOM fingerprint", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const pass1 = convertBrevoHtml(fixture);
    const editorData = {
      __etsImport: 1,
      components: pass1.components,
    };

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const created = await page.evaluate(
      async ({ name, data }) => {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            subject: "Round-trip E2E",
            editorData: data,
          }),
        });
        const json = (await res.json()) as {
          data?: { id?: string };
          id?: string;
        };
        if (!res.ok) {
          throw new Error(`create failed ${res.status}`);
        }
        return json.data?.id ?? json.id;
      },
      { name: `RT-${Date.now()}`, data: editorData },
    );
    expect(created).toBeTruthy();

    await page.goto(`/templates/${created}`);
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const livePublished = await page.evaluate(async () => {
      const ed = (
        window as Window & {
          __emailEditor?: { getHtml: () => string; getCss: () => string };
        }
      ).__emailEditor;
      if (!ed) throw new Error("no editor");
      const { buildPublishHtml } = await import("/src/variables/previewDoc.ts");
      return buildPublishHtml(ed.getHtml() ?? "", ed.getCss() ?? "");
    });

    expect(livePublished).toContain("data-email-type=\"email-section\"");

    const offDomPublished = await page.evaluate(async (data) => {
      const mod = await import("/src/templates/renderEditorDataHtml.ts");
      return mod.renderEditorDataToPublishHtml(data);
    }, editorData);

    const liveFp = treeFingerprint(convertBrevoHtml(livePublished).document);
    const offDomFp = treeFingerprint(convertBrevoHtml(offDomPublished).document);
    const seedFp = treeFingerprint(pass1.document);

    expect(liveFp).toEqual(seedFp);
    expect(offDomFp).toEqual(seedFp);

    await page.screenshot({
      path: path.join(evidenceDir, "02-live-vs-offdom.png"),
      fullPage: true,
    });
  });
});
