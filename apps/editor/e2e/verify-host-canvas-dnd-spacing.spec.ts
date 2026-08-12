/**
 * Verify-UI — host→canvas DnD (startCustom) + height hint + sibling spacing.
 * Acceptance: `.qa/acceptance/host-canvas-dnd-spacing.md`
 * Evidence: `.qa/evidence/host-canvas-dnd-spacing/`
 * Location: apps/editor/e2e/verify-host-canvas-dnd-spacing.spec.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/host-canvas-dnd-spacing",
);

test.describe("verify-ui host-canvas-dnd-spacing", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("BlockManager-style startCustom is armed by startEditorDrag", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    await page.getByRole("button", { name: "Blöcke" }).click();
    const textBtn = page.locator('[data-block-type="email-text"]').first();
    await expect(textBtn).toBeVisible();

    const report = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const frames = ed.Canvas.getFrames() ?? [];
      const droppable = frames[0]?.view?.droppable;
      if (!droppable) return { err: "no droppable" };

      const before = droppable.getSorterOptions != null;
      const btn = document.querySelector(
        '[data-block-type="email-text"]',
      ) as HTMLElement;
      const dt = new DataTransfer();
      btn.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
      const afterStart = droppable.getSorterOptions != null;
      const hint = ed.em?.get?.("etsDropHeightHint");
      btn.dispatchEvent(
        new DragEvent("dragend", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
      const afterEnd = droppable.getSorterOptions != null;
      return { before, afterStart, afterEnd, hint };
    });

    writeFileSync(
      path.join(evidenceDir, "A-startcustom.json"),
      JSON.stringify(report, null, 2),
    );

    expect(report.afterStart).toBe(true);
    expect(report.hint).toBe(80);
  });

  test("palette text drag into empty layout column inserts email-text", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page, "structural-template");

    await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const content = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      const col = content?.findType?.("email-column")?.[0];
      col?.components()?.reset([]);
      col?.append({
        type: "email-layout-row",
        attributes: {
          "data-email-type": "email-layout-row",
          "data-layout": "columns",
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
    });

    await page.getByRole("button", { name: "Blöcke" }).click();
    const textBtn = page.locator('[data-block-type="email-text"]').first();
    await expect(textBtn).toBeVisible();

    const drop = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const frame = ed.Canvas.getFrameEl() as HTMLIFrameElement;
      const fr = frame.getBoundingClientRect();
      const layout = ed.getWrapper().findType("email-layout-row")[0];
      const col = layout.findType("email-column")[0];
      const r = col.getEl().getBoundingClientRect();
      return {
        x: fr.left + r.left + r.width / 2,
        y: fr.top + r.top + r.height / 2,
      };
    });

    const box = await textBtn.boundingBox();
    expect(box).toBeTruthy();

    await page.evaluate(
      ({ sx, sy, tx, ty }) => {
        const btn = document.querySelector(
          '[data-block-type="email-text"]',
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
        const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
        const frame = ed.Canvas.getFrameEl() as HTMLIFrameElement;
        // Enter custom droppable via pointerenter on frame (host→iframe bridge)
        frame.dispatchEvent(
          new PointerEvent("pointerenter", {
            bubbles: true,
            clientX: tx,
            clientY: ty,
          }),
        );
        frame.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            clientX: tx,
            clientY: ty,
          }),
        );
        document.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            clientX: tx,
            clientY: ty,
          }),
        );
        btn.dispatchEvent(
          new DragEvent("dragend", {
            bubbles: true,
            cancelable: true,
            clientX: tx,
            clientY: ty,
            dataTransfer: dt,
          }),
        );
      },
      {
        sx: box!.x + box!.width / 2,
        sy: box!.y + box!.height / 2,
        tx: drop.x,
        ty: drop.y,
      },
    );

    await page.waitForTimeout(250);

    const after = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const layout = ed.getWrapper().findType("email-layout-row")[0];
      const cols = layout?.findType?.("email-column") ?? [];
      return {
        texts: (ed.getWrapper().findType("email-text") ?? []).length,
        col0Kids: (cols[0]?.components()?.models ?? []).map((m: any) =>
          String(m.get("type")),
        ),
      };
    });

    writeFileSync(
      path.join(evidenceDir, "B-layout-drop.json"),
      JSON.stringify({ drop, after }, null, 2),
    );
    await page.screenshot({
      path: path.join(evidenceDir, "01-after-layout-drop.png"),
      fullPage: true,
    });

    expect(
      after.texts > 0 || after.col0Kids.includes("email-text"),
    ).toBeTruthy();
  });

  test("content column siblings have vertical gap", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page, "structural-template");

    const gaps = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const content = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      const col = content?.findType?.("email-column")?.[0];
      const frame = ed.Canvas.getFrameEl() as HTMLIFrameElement;
      const win = frame.contentWindow!;
      const kids = [...(col?.components()?.models ?? [])]
        .map((m: any) => m.getEl?.() as HTMLElement | undefined)
        .filter(Boolean) as HTMLElement[];
      if (kids.length < 2) return { kidCount: kids.length, margins: [] as number[] };
      return {
        kidCount: kids.length,
        margins: kids.slice(0, -1).map((el) =>
          Number.parseFloat(win.getComputedStyle(el).marginBottom || "0"),
        ),
      };
    });

    writeFileSync(
      path.join(evidenceDir, "C-sibling-gap.json"),
      JSON.stringify(gaps, null, 2),
    );

    expect(gaps.kidCount).toBeGreaterThanOrEqual(2);
    for (const m of gaps.margins) {
      expect(m).toBeGreaterThanOrEqual(12);
    }
  });

  test("drop height hint drives mid-drag box for palette text", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const report = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      ed.em.set("etsDropHeightHint", 200);
      ed.trigger("sorter:drag:start", {
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
      });
      ed.trigger("sorter:drag", { pos: { placement: "before" } });
      const root = ed.Canvas.getElement() as HTMLElement;
      const ph = root.querySelector(
        ".gjs-placeholder, .gjs-com-placeholder",
      ) as HTMLElement | null;
      const varH = ph?.style.getPropertyValue("--ets-drop-h").trim() ?? "";
      ed.trigger("sorter:drag:end");
      ed.em.set("etsDropHeightHint", undefined);
      return { varH };
    });

    writeFileSync(
      path.join(evidenceDir, "D-height-hint.json"),
      JSON.stringify(report, null, 2),
    );
    expect(report.varH).toBe("200px");
  });

  test("drop height clamps to target column when hint exceeds slot", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const report = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const content = (ed.getWrapper().findType("email-section") as any[]).find(
        (s) =>
          String(s.get("sectionRole") ?? s.getAttributes()?.["data-role"]) ===
          "content",
      );
      const col = content?.findType?.("email-column")?.[0];
      const colEl = col?.getEl?.() as HTMLElement | undefined;
      const slotH = colEl
        ? Math.round(colEl.getBoundingClientRect().height)
        : 0;

      ed.em.set("etsDropHeightHint", 200);
      ed.trigger("sorter:drag:start", {
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
      });
      ed.trigger("sorter:drag", {
        pos: { placement: "inside" },
        parent: col,
        target: col,
      });
      const root = ed.Canvas.getElement() as HTMLElement;
      const ph = root.querySelector(
        ".gjs-placeholder, .gjs-com-placeholder",
      ) as HTMLElement | null;
      const varH = ph?.style.getPropertyValue("--ets-drop-h").trim() ?? "";
      ed.trigger("sorter:drag:end");
      ed.em.set("etsDropHeightHint", undefined);
      return { slotH, varH };
    });

    expect(report.slotH).toBeGreaterThan(40);
    const varPx = Number.parseInt(report.varH, 10);
    expect(varPx).toBeLessThanOrEqual(report.slotH + 2);
    expect(varPx).toBeGreaterThanOrEqual(48);
  });

  test("dragover bridge shows dashed placeholder over empty content canvas", async ({
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
    const textBtn = page.locator('[data-block-type="email-text"]').first();
    await expect(textBtn).toBeVisible();

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

    const box = await textBtn.boundingBox();
    expect(box).toBeTruthy();

    const report = await page.evaluate(
      async ({ sx, sy, tx, ty }) => {
        const btn = document.querySelector(
          '[data-block-type="email-text"]',
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

        // Real browser path: dragover (not pointerenter) over the canvas
        // Multiple moves so Grapes RateLimiter (20ms) + placeholder (100ms) settle
        for (let i = 0; i < 4; i++) {
          window.dispatchEvent(
            new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              clientX: tx + i,
              clientY: ty + i,
              dataTransfer: dt,
            }),
          );
          await new Promise((r) => setTimeout(r, 50));
        }

        const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
        const root = ed.Canvas.getElement() as HTMLElement;
        const ph = root.querySelector(
          ".gjs-placeholder, .gjs-com-placeholder",
        ) as HTMLElement | null;
        const intEl = ph?.querySelector(
          ".gjs-placeholder-int, .gjs-com-placeholder-int",
        ) as HTMLElement | null;
        const borderStyle = intEl
          ? getComputedStyle(intEl).borderTopStyle
          : "";
        const phDisplay = ph ? getComputedStyle(ph).display : "";
        const varH = ph?.style.getPropertyValue("--ets-drop-h").trim() ?? "";
        const placement = ph?.dataset.etsPlacement ?? "";
        const sorterActive = Boolean(
          ed.Canvas.getFrames()?.[0]?.view?.droppable?.getSorterOptions,
        );

        btn.dispatchEvent(
          new DragEvent("dragend", {
            bubbles: true,
            cancelable: true,
            clientX: tx,
            clientY: ty,
            dataTransfer: dt,
          }),
        );

        return {
          sorterActive,
          borderStyle,
          phDisplay,
          varH,
          placement,
          hasPh: Boolean(ph),
          top: ph?.style.top ?? "",
        };
      },
      {
        sx: box!.x + box!.width / 2,
        sy: box!.y + box!.height / 2,
        tx: drop.x,
        ty: drop.y,
      },
    );

    writeFileSync(
      path.join(evidenceDir, "E-dragover-placeholder.json"),
      JSON.stringify(report, null, 2),
    );

    expect(report.sorterActive).toBe(true);
    expect(report.hasPh).toBe(true);
    expect(report.phDisplay).not.toBe("none");
    expect(report.borderStyle).toBe("dashed");
    expect(report.varH).toMatch(/^\d+px$/);
  });
});
