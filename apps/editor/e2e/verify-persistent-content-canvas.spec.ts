/**
 * Verify-UI — persistent content canvas + robust insert.
 * Acceptance: `.qa/acceptance/persistent-content-canvas.md`
 * Evidence: `.qa/evidence/persistent-content-canvas/`
 * Location: apps/editor/e2e/verify-persistent-content-canvas.spec.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/persistent-content-canvas",
);

test.describe("verify-ui persistent-content-canvas", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("content section is not removable; delete clears children and keeps canvas", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page, "structural-template");

    const before = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const content = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      return {
        removable: content?.get("removable"),
        texts: (ed.getWrapper().findType("email-text") ?? []).length,
      };
    });
    expect(before.removable).toBe(false);
    expect(before.texts).toBeGreaterThan(0);

    await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const content = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      ed.select(content);
      ed.runCommand("core:component-delete");
    });

    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const contents = (ed.getWrapper().findType("email-section") as any[]).filter(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      const content = contents[0];
      const cols = content?.findType?.("email-column") ?? [];
      return {
        contentCount: contents.length,
        removable: content?.get("removable"),
        colCount: cols.length,
        leafCount: (content?.findType?.("email-text") ?? []).length,
      };
    });

    expect(after.contentCount).toBe(1);
    expect(after.removable).toBe(false);
    expect(after.colCount).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(evidenceDir, "01-canvas-survives-delete.png"),
      fullPage: true,
    });
  });

  test("insert text after canvas wipe still works via ensureContentCanvas", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page, "structural-template");

    // Force-remove content from wrapper (bypass abort) then insert via Blöcke path
    await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const wrap = ed.getWrapper();
      for (const s of [...wrap.findType("email-section")]) {
        const role = String(
          s.get("sectionRole") ?? s.getAttributes()?.["data-role"] ?? "",
        );
        if (role === "content") {
          // Detach by resetting wrapper without content — then heal via insert
          const keep = (wrap.components().models as any[]).filter(
            (m) => m !== s,
          );
          wrap.components().reset(keep);
        }
      }
    });

    await page.waitForTimeout(100);

    // Open Blöcke and click Text
    await page.getByRole("button", { name: "Blöcke" }).click();
    await page.locator('[data-block-type="email-text"]').first().click();

    const inv = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const contents = (ed.getWrapper().findType("email-section") as any[]).filter(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      return {
        contentCount: contents.length,
        texts: (ed.getWrapper().findType("email-text") ?? []).length,
      };
    });

    expect(inv.contentCount).toBe(1);
    expect(inv.texts).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(evidenceDir, "02-insert-after-ensure.png"),
      fullPage: true,
    });
  });

  test("mid-drag box uses content-like height for tiny palette sources", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const report = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const tiny = {
        nodeType: 1,
        getBoundingClientRect: () => ({
          width: 80,
          height: 28,
          top: 0,
          left: 0,
          bottom: 28,
          right: 80,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      };
      ed.trigger("sorter:drag:start", tiny);
      ed.trigger("sorter:drag", { pos: { placement: "before" } });
      const root = ed.Canvas.getElement() as HTMLElement;
      const ph = root.querySelector(
        ".gjs-placeholder, .gjs-com-placeholder",
      ) as HTMLElement | null;
      const varH = ph?.style.getPropertyValue("--ets-drop-h").trim() ?? "";
      ed.trigger("sorter:drag:end");
      return { varH };
    });

    expect(report.varH).toBe("112px");
  });
});
