/**
 * Debug: Brevo-imported template text hosts vs fresh template RTE.
 * Evidence: `.qa/evidence/debug-brevo-import-rte/`
 * Location: apps/editor/e2e/debug-repro-brevo-import-rte.spec.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { convertBrevoHtml } from "@email-template/legacy-importer";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";
import { createTemplateViaModal } from "./helpers/createTemplate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceDir = path.join(root, ".qa/evidence/debug-brevo-import-rte");
const brevoHtml = readFileSync(
  path.join(
    root,
    "packages/legacy-importer/fixtures/production-brevo-template-4.html",
  ),
  "utf8",
);

type HostProbe = {
  type: string;
  sectionRole: string;
  contenteditable: string | null;
  rteEnabled: boolean | null;
  childTypes: string[];
  nestedCeFalse: number;
  nestedCeFalseSample: string[];
  textLen: number;
  typeAfterClick: string;
  typedOk: boolean;
  hostTag: string;
};

test.describe("debug-repro brevo-import-rte", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("compare fresh vs Brevo-imported content text editability", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // --- A: fresh template ---
    await page.goto("/");
    await createTemplateViaModal(page, `Debug-RTE-Fresh-${Date.now()}`);
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const fresh = await page.evaluate(async () => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const hosts = [
        ...(ed.getWrapper().findType("email-text") ?? []),
        ...(ed.getWrapper().findType("email-heading") ?? []),
      ];
      const contentHosts = hosts.filter((h: any) => {
        let c = h;
        while (c) {
          if (String(c.get("type")) === "email-section") {
            const role = String(
              c.get("sectionRole") ??
                c.getAttributes()?.["data-role"] ??
                "",
            );
            return role === "content" || role === "";
          }
          c = c.parent();
        }
        return true;
      });
      const host = contentHosts[0] ?? hosts[0];
      if (!host) return { err: "no host" };

      const el = host.getEl() as HTMLElement;
      const before = el.getAttribute("contenteditable");
      // Prefer iframe click like structural harness
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const frame = ed.Canvas.getFrameEl() as HTMLIFrameElement;
      const fr = frame.getBoundingClientRect();
      // click via host API
      host.getView()?.onActive?.();
      await new Promise((res) => setTimeout(res, 200));

      const afterEnable = el.getAttribute("contenteditable");
      const rteEnabled = Boolean(host.getView()?.rteEnabled);
      const marker = `RTEFRESH${Date.now() % 10000}`;
      el.focus();
      const doc = el.ownerDocument;
      const sel = doc.getSelection();
      if (sel) {
        const range = doc.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      // execCommand insert as fallback to keyboard in evaluate
      try {
        doc.execCommand("insertText", false, marker);
      } catch {
        el.append(marker);
      }
      await new Promise((res) => setTimeout(res, 100));
      const afterText = el.innerText ?? "";
      return {
        before,
        afterEnable,
        rteEnabled,
        typedOk: afterText.includes(marker),
        typeAfterClick: afterText.slice(0, 80),
        childTypes: (host.components()?.models ?? []).map((m: any) =>
          String(m.get("type")),
        ),
        nestedCeFalse: el.querySelectorAll('[contenteditable="false"]').length,
      };
    });

    writeFileSync(
      path.join(evidenceDir, "A-fresh.json"),
      JSON.stringify(fresh, null, 2),
    );

    // --- B: Brevo convert loaded into new template ---
    await page.goto("/");
    const created = await page.evaluate(async () => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Debug-RTE-Brevo-${Date.now()}`,
          subject: "Brevo import RTE probe",
        }),
      });
      const json = await res.json();
      return json.data?.id ?? json.id;
    });
    expect(created).toBeTruthy();

    const converted = convertBrevoHtml(brevoHtml);
    const loadReport = await page.evaluate(
      async ({ id, components }) => {
        // Force convert via API html if route exists, else set editorData directly
        const patch = await fetch(`/api/templates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedRevision: 1,
            editorData: {
              __etsImport: 1,
              components,
            },
          }),
        });
        const body = await patch.json().catch(() => ({}));
        return { status: patch.status, body };
      },
      { id: created, components: converted.components },
    );
    writeFileSync(
      path.join(evidenceDir, "B-load.json"),
      JSON.stringify(
        {
          status: loadReport.status,
          report: converted.report,
          componentCount: Array.isArray(converted.components)
            ? converted.components.length
            : null,
        },
        null,
        2,
      ),
    );

    await page.goto(`/templates/${created}`);
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );
    await page.waitForTimeout(500);

    const brevo = await page.evaluate(async () => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const probes: HostProbe[] = [];
      const hosts = [
        ...(ed.getWrapper().findType("email-text") ?? []),
        ...(ed.getWrapper().findType("email-heading") ?? []),
      ];

      const sectionRole = (h: any): string => {
        let c = h;
        while (c) {
          if (String(c.get("type")) === "email-section") {
            return String(
              c.get("sectionRole") ??
                c.getAttributes()?.["data-role"] ??
                "",
            );
          }
          c = c.parent();
        }
        return "";
      };

      for (const host of hosts.slice(0, 8)) {
        const el = host.getEl() as HTMLElement | undefined;
        if (!el) continue;
        const role = sectionRole(host);
        const nested = [
          ...el.querySelectorAll('[contenteditable="false"]'),
        ] as HTMLElement[];
        const sample = nested.slice(0, 5).map((n) => {
          const t = n.getAttribute("data-email-type") ?? n.tagName;
          return `${t}:${(n.textContent ?? "").slice(0, 24)}`;
        });

        // Try enable RTE
        try {
          host.getView()?.onActive?.();
        } catch {
          /* */
        }
        await new Promise((r) => setTimeout(r, 150));

        const marker = `RTEIMP${Math.floor(Math.random() * 9999)}`;
        const beforeText = el.innerText ?? "";
        el.focus();
        const doc = el.ownerDocument;
        const sel = doc.getSelection();
        if (sel) {
          const range = doc.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        let insertOk = false;
        try {
          insertOk = doc.execCommand("insertText", false, marker);
        } catch {
          insertOk = false;
        }
        if (!insertOk) {
          try {
            el.append(marker);
          } catch {
            /* */
          }
        }
        await new Promise((r) => setTimeout(r, 80));
        const afterText = el.innerText ?? "";

        probes.push({
          type: String(host.get("type")),
          sectionRole: role,
          contenteditable: el.getAttribute("contenteditable"),
          rteEnabled: Boolean(host.getView()?.rteEnabled),
          childTypes: (host.components()?.models ?? []).map((m: any) =>
            String(m.get("type")),
          ),
          nestedCeFalse: nested.length,
          nestedCeFalseSample: sample,
          textLen: (el.textContent ?? "").length,
          typeAfterClick: afterText.slice(0, 100),
          typedOk: afterText.includes(marker) && afterText !== beforeText,
          hostTag: el.tagName,
        });
      }

      const lockedChrome = hosts.filter((h: any) => {
        const role = sectionRole(h);
        return role === "header" || role === "footer" || role === "social";
      }).length;

      const legacy = (ed.getWrapper().findType("email-legacy-html") ?? [])
        .length;

      return {
        hostCount: hosts.length,
        lockedChrome,
        legacyHtmlBlocks: legacy,
        probes,
      };
    });

    writeFileSync(
      path.join(evidenceDir, "C-brevo-hosts.json"),
      JSON.stringify(brevo, null, 2),
    );

    await page.screenshot({
      path: path.join(evidenceDir, "01-brevo-canvas.png"),
      fullPage: true,
    });

    // Content-role hosts that failed typing
    const contentFails = (brevo.probes as HostProbe[]).filter(
      (p) =>
        (p.sectionRole === "content" || p.sectionRole === "") && !p.typedOk,
    );
    writeFileSync(
      path.join(evidenceDir, "D-content-fails.json"),
      JSON.stringify({ fresh, contentFails, all: brevo.probes }, null, 2),
    );

    console.log(
      "FRESH",
      JSON.stringify(fresh),
      "\nBREVO summary",
      JSON.stringify({
        hostCount: brevo.hostCount,
        lockedChrome: brevo.lockedChrome,
        legacy: brevo.legacyHtmlBlocks,
        contentFailCount: contentFails.length,
        sampleFails: contentFails.slice(0, 3),
      }),
    );

    // Soft evidence test — always pass if we collected data; assert differential
    expect(fresh).toBeTruthy();
    expect(brevo.hostCount).toBeGreaterThan(0);
  });

  test("Brevo content host: real iframe click + keyboard type", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    const created = await page.evaluate(async () => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Debug-RTE-Click-${Date.now()}`,
          subject: "Brevo click RTE",
        }),
      });
      const json = await res.json();
      return json.data?.id ?? json.id;
    });
    const converted = convertBrevoHtml(brevoHtml);
    await page.evaluate(
      async ({ id, components }) => {
        await fetch(`/api/templates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedRevision: 1,
            editorData: { __etsImport: 1, components },
          }),
        });
      },
      { id: created, components: converted.components },
    );
    await page.goto(`/templates/${created}`);
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const inv = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const hosts = ed.getWrapper().findType("email-text") ?? [];
      return hosts.map((h: any, i: number) => {
        const el = h.getEl() as HTMLElement;
        let role = "";
        let c = h;
        while (c) {
          if (String(c.get("type")) === "email-section") {
            role = String(
              c.get("sectionRole") ?? c.getAttributes()?.["data-role"] ?? "",
            );
            break;
          }
          c = c.parent();
        }
        const nested = [...el.querySelectorAll("*")].slice(0, 30).map((n) => ({
          tag: (n as HTMLElement).tagName,
          type: (n as HTMLElement).getAttribute("data-email-type"),
          ce: (n as HTMLElement).getAttribute("contenteditable"),
        }));
        return {
          i,
          role,
          textPreview: (el.textContent ?? "").slice(0, 60),
          nested,
          editableModel: h.get("editable"),
          locked: Boolean(h.get("locked")),
        };
      });
    });
    writeFileSync(
      path.join(evidenceDir, "E-inventory.json"),
      JSON.stringify(inv, null, 2),
    );

    const frame = page.frameLocator(".gjs-frame").first();
    // First content-role text (INHALT), not footer
    const contentIdx = (inv as Array<{ role: string }>).findIndex(
      (h) => h.role === "content",
    );
    expect(contentIdx).toBeGreaterThanOrEqual(0);
    const host = frame.locator('[data-email-type="email-text"]').nth(contentIdx);

    await host.click({ position: { x: 40, y: 18 } });
    const ceAfterClick = await host.getAttribute("contenteditable");
    await page.keyboard.type("CLICKTYPEOK", { delay: 20 });
    const textAfter = await host.innerText();
    const editingType = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const cur = ed.getEditing?.();
      return cur ? String(cur.get("type")) : null;
    });

    const clickReport = {
      contentIdx,
      ceAfterClick,
      textHasMarker: textAfter.includes("CLICKTYPEOK"),
      textPreview: textAfter.slice(0, 120),
      editingType,
    };
    writeFileSync(
      path.join(evidenceDir, "F-click-keyboard.json"),
      JSON.stringify(clickReport, null, 2),
    );
    await page.screenshot({
      path: path.join(evidenceDir, "02-after-click-type.png"),
      fullPage: true,
    });

    console.log("CLICK_KEYBOARD", JSON.stringify(clickReport, null, 2));
    // Evidence assertion — capture failure clearly
    expect(ceAfterClick).toBe("true");
    expect(textAfter).toContain("CLICKTYPEOK");
  });

  test("structural fixture (params) still editable baseline", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);
    const frame = page.frameLocator(".gjs-frame").first();
    const host = frame.locator('[data-email-type="email-text"]').first();
    await host.click({ position: { x: 24, y: 12 } });
    await expect
      .poll(async () => host.getAttribute("contenteditable"), {
        timeout: 5000,
      })
      .toBe("true");
    await page.keyboard.type("STRUCTOK");
    await expect.poll(async () => host.innerText()).toContain("STRUCTOK");
  });
});
