/**
 * Regression: palette drag shows visible mid-drag placeholder (iframe-local coords).
 * Acceptance: `.qa/acceptance/palette-dropzone-iframe-coords.md`
 * Evidence: `.qa/evidence/palette-dropzone-iframe-coords/`
 * Location: apps/editor/e2e/verify-palette-dropzone-iframe-coords.spec.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/palette-dropzone-iframe-coords",
);

test.describe("verify-ui palette-dropzone-iframe-coords", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("dragover bridge: placeholder display is not none over empty canvas", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const content = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      const col = content?.findType?.("email-column")?.[0];
      col?.components()?.reset([]);
    });

    await page.getByRole("button", { name: "Blöcke" }).click();
    const headingBtn = page
      .locator('[data-block-type="email-heading"]')
      .first();
    await expect(headingBtn).toBeVisible();

    const drop = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const frame = ed.Canvas.getFrameEl() as HTMLIFrameElement;
      const fr = frame.getBoundingClientRect();
      const content = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      const col = content?.findType?.("email-column")?.[0];
      const r = col.getEl().getBoundingClientRect();
      return {
        x: fr.left + r.left + r.width / 2,
        y: fr.top + r.top + r.height / 2,
      };
    });

    const box = await headingBtn.boundingBox();
    expect(box).toBeTruthy();

    const report = await page.evaluate(
      async ({ sx, sy, tx, ty }) => {
        const btn = document.querySelector(
          '[data-block-type="email-heading"]',
        ) as HTMLElement;
        const dt = new DataTransfer();
        btn.dispatchEvent(
          new DragEvent("dragstart", {
            bubbles: true,
            cancelable: true,
            clientX: sx,
            clientY: sy,
            dataTransfer: dt,
          }),
        );

        for (let i = 0; i < 5; i++) {
          window.dispatchEvent(
            new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              clientX: tx + (i % 3),
              clientY: ty + (i % 3),
              dataTransfer: dt,
            }),
          );
          await new Promise((r) => setTimeout(r, 60));
        }
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => setTimeout(r, 32));

        const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
        const root = ed.Canvas.getElement() as HTMLElement;
        const ph = root.querySelector(
          ".gjs-placeholder, .gjs-com-placeholder",
        ) as HTMLElement | null;
        const intEl = ph?.querySelector(
          ".gjs-placeholder-int, .gjs-com-placeholder-int",
        ) as HTMLElement | null;
        const phDisplay = ph ? getComputedStyle(ph).display : "missing";
        const borderStyle = intEl
          ? getComputedStyle(intEl).borderTopStyle
          : "";
        const varH = ph?.style.getPropertyValue("--ets-drop-h").trim() ?? "";
        const placement = ph?.dataset.etsPlacement ?? "";
        const top = ph?.style.top ?? "";
        const left = ph?.style.left ?? "";

        const snapshot = {
          phDisplay,
          borderStyle,
          varH,
          placement,
          top,
          left,
        };

        btn.dispatchEvent(
          new DragEvent("dragend", {
            bubbles: true,
            cancelable: true,
            clientX: tx,
            clientY: ty,
            dataTransfer: dt,
          }),
        );

        return snapshot;
      },
      {
        sx: box!.x + box!.width / 2,
        sy: box!.y + box!.height / 2,
        tx: drop.x,
        ty: drop.y,
      },
    );

    writeFileSync(
      path.join(evidenceDir, "mid-drag-visible.json"),
      JSON.stringify(report, null, 2),
    );

    await page.screenshot({
      path: path.join(evidenceDir, "01-mid-drag-placeholder-visible.png"),
      fullPage: true,
    });

    expect(report.phDisplay).not.toBe("none");
    expect(report.phDisplay).not.toBe("missing");
    expect(report.borderStyle).toBe("dashed");
    expect(report.placement).toBe("inside");
    expect(report.varH).toMatch(/^\d+px$/);
  });
});
