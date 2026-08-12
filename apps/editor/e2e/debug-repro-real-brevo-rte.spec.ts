/**
 * Debug: real Brevo-synced template RTE (DB id from Opus investigation).
 * Evidence: `.qa/evidence/debug-brevo-import-rte/`
 * Location: apps/editor/e2e/debug-repro-real-brevo-rte.spec.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceDir = path.join(root, ".qa/evidence/debug-brevo-import-rte");
const TEMPLATE_ID =
  process.env.DEBUG_TEMPLATE_ID ?? "9cd044a5-3db9-4fd6-8374-50e2fcfc20a1";

async function openReal(page: Page) {
  await page.goto(`/templates/${TEMPLATE_ID}`);
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );
  // settle migrateCanvasLayout + lockChrome
  await page.waitForTimeout(800);
}

test.describe("debug-repro real Brevo RTE", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("inventory + click-type each content host + leave/reenter", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    await openReal(page);

    const inventory = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const sectionRole = (h: any): string => {
        let c = h;
        while (c) {
          if (String(c.get("type")) === "email-section") {
            return String(
              c.get("sectionRole") ??
                c.getAttributes()?.["data-section-role"] ??
                c.getAttributes()?.["data-role"] ??
                "",
            );
          }
          c = c.parent();
        }
        return "";
      };
      const sections = (ed.getWrapper().findType("email-section") ?? []).map(
        (s: any) => ({
          role: sectionRole(s),
          locked: s.getAttributes()?.["data-locked"],
          editable: s.get("editable"),
        }),
      );
      const hosts = [
        ...(ed.getWrapper().findType("email-text") ?? []),
        ...(ed.getWrapper().findType("email-heading") ?? []),
      ];
      return {
        sections,
        hosts: hosts.map((h: any, i: number) => {
          const el = h.getEl() as HTMLElement | undefined;
          const kids = (h.components()?.models ?? []).map((m: any) => ({
            type: String(m.get("type")),
            editable: m.get("editable"),
            tag: m.get("tagName"),
          }));
          const nestedCeFalse = el
            ? [...el.querySelectorAll('[contenteditable="false"]')].map(
                (n) =>
                  `${(n as HTMLElement).getAttribute("data-email-type") ?? (n as HTMLElement).tagName}`,
              )
            : [];
          return {
            i,
            type: String(h.get("type")),
            role: sectionRole(h),
            modelEditable: h.get("editable"),
            modelLocked: Boolean(h.get("locked")),
            modelDraggable: h.get("draggable"),
            domCe: el?.getAttribute("contenteditable") ?? null,
            domDraggable: el?.getAttribute("draggable") ?? null,
            textPreview: (el?.textContent ?? "").replace(/\s+/g, " ").slice(0, 80),
            childTypes: kids,
            nestedCeFalseCount: nestedCeFalse.length,
            nestedCeFalseSample: nestedCeFalse.slice(0, 8),
            rteEnabled: Boolean(h.getView()?.rteEnabled),
          };
        }),
      };
    });

    writeFileSync(
      path.join(evidenceDir, "R-inventory.json"),
      JSON.stringify(inventory, null, 2),
    );

    const frame = page.frameLocator(".gjs-frame").first();
    const results: unknown[] = [];

    for (const hostMeta of inventory.hosts as Array<{
      i: number;
      role: string;
      textPreview: string;
    }>) {
      const host = frame.locator('[data-email-type="email-text"]').nth(hostMeta.i);
      const visible = await host.isVisible().catch(() => false);
      if (!visible) {
        results.push({ i: hostMeta.i, role: hostMeta.role, skip: "not visible" });
        continue;
      }

      await host.scrollIntoViewIfNeeded();
      await host.click({ position: { x: 36, y: 14 } });
      await page.waitForTimeout(120);

      const afterClick = await page.evaluate((idx) => {
        const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
        const hosts = ed.getWrapper().findType("email-text") ?? [];
        const h = hosts[idx];
        const el = h?.getEl() as HTMLElement | undefined;
        const sel = el?.ownerDocument.getSelection();
        let caret = -1;
        try {
          if (sel && sel.rangeCount > 0 && el) {
            const r = sel.getRangeAt(0);
            if (el.contains(r.startContainer) || el === r.startContainer) {
              caret = r.startOffset;
            }
          }
        } catch {
          /* */
        }
        return {
          ce: el?.getAttribute("contenteditable"),
          rteEnabled: Boolean(h?.getView()?.rteEnabled),
          editingType: ed.getEditing?.()
            ? String(ed.getEditing().get("type"))
            : null,
          selectedType: ed.getSelected?.()
            ? String(ed.getSelected().get("type"))
            : null,
          caret,
          hint: el
            ?.closest("[data-brevo-hint]")
            ?.getAttribute("data-brevo-hint"),
          sectionLocked: el
            ?.closest("[data-locked]")
            ?.getAttribute("data-locked"),
        };
      }, hostMeta.i);

      const marker = `REAL${hostMeta.i}X`;
      await page.keyboard.type(marker, { delay: 15 });
      await page.waitForTimeout(100);
      const textAfter = await host.innerText().catch(() => "");
      const typedOk = textAfter.includes(marker);

      // leave → re-enter (Opus cold path)
      await page.locator(".gjs-host").click({ position: { x: 4, y: 4 } });
      await page.waitForTimeout(200);
      await host.click({ position: { x: 40, y: 16 } });
      await page.waitForTimeout(150);
      const reenter = await page.evaluate((idx) => {
        const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
        const hosts = ed.getWrapper().findType("email-text") ?? [];
        const h = hosts[idx];
        const el = h?.getEl() as HTMLElement | undefined;
        const sel = el?.ownerDocument.getSelection();
        let caret = -1;
        try {
          if (sel && sel.rangeCount > 0 && el) {
            const r = sel.getRangeAt(0);
            if (el.contains(r.startContainer) || el === r.startContainer) {
              caret = r.startOffset;
            }
          }
        } catch {
          /* */
        }
        return {
          ce: el?.getAttribute("contenteditable"),
          rteEnabled: Boolean(h?.getView()?.rteEnabled),
          caret,
        };
      }, hostMeta.i);

      const marker2 = `RE${hostMeta.i}`;
      await page.keyboard.type(marker2, { delay: 15 });
      const textRe = await host.innerText().catch(() => "");

      results.push({
        i: hostMeta.i,
        role: hostMeta.role,
        preview: hostMeta.textPreview,
        afterClick,
        typedOk,
        textHasMarker: typedOk,
        reenter,
        reenterTypedOk: textRe.includes(marker2),
      });
    }

    writeFileSync(
      path.join(evidenceDir, "R-click-type.json"),
      JSON.stringify({ TEMPLATE_ID, results, consoleLogs: consoleLogs.slice(0, 40) }, null, 2),
    );
    await page.screenshot({
      path: path.join(evidenceDir, "03-real-brevo-canvas.png"),
      fullPage: true,
    });

    console.log(
      "REAL_BREVO",
      JSON.stringify(
        {
          sections: inventory.sections,
          results: (results as Array<Record<string, unknown>>).map((r) => ({
            i: r.i,
            role: r.role,
            typedOk: r.typedOk,
            reenterTypedOk: r.reenterTypedOk,
            afterClick: r.afterClick,
            reenter: r.reenter,
          })),
        },
        null,
        2,
      ),
    );

    // Soft collect — assert we probed at least one content host
    const contentProbes = (results as Array<{ role: string }>).filter(
      (r) => r.role === "content",
    );
    expect(contentProbes.length).toBeGreaterThan(0);
  });
});
