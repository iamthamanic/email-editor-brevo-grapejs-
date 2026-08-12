/**
 * Verify-UI — dropzone box placeholder (Phase 6).
 * Acceptance: `.qa/acceptance/dropzone-box-placeholder.md`
 * Evidence: `.qa/evidence/dropzone-box-placeholder/`
 * Location: apps/editor/e2e/verify-dropzone-box-placeholder.spec.ts
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/dropzone-box-placeholder",
);

test.describe("verify-ui dropzone-box-placeholder", () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  test("sorter:drag:start sizes before/after box from source height", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const result = await page.evaluate(() => {
      const ed = (
        window as Window & {
          __emailEditor?: {
            trigger: (ev: string, ...args: unknown[]) => void;
            Canvas: {
              getElement: () => HTMLElement | null;
            };
            getWrapper: () => {
              findType: (t: string) => Array<{
                getEl: () => HTMLElement | undefined;
              }>;
            };
          };
        }
      ).__emailEditor;
      if (!ed) throw new Error("no editor");

      const host = ed.getWrapper().findType("email-text")[0];
      const hostEl = host?.getEl();
      if (!hostEl) throw new Error("no host el");

      const sourceH = Math.round(hostEl.getBoundingClientRect().height);
      ed.trigger("sorter:drag:start", hostEl, host);
      ed.trigger("sorter:drag", {
        pos: { placement: "before" },
        sourceModel: host,
      });

      const root = ed.Canvas.getElement();
      const ph = root?.querySelector(
        ".gjs-placeholder, .gjs-com-placeholder",
      ) as HTMLElement | null;
      if (!ph) throw new Error("no placeholder");

      const varH = ph.style.getPropertyValue("--ets-drop-h").trim();
      const intEl = ph.querySelector(
        ".gjs-placeholder-int, .gjs-com-placeholder-int",
      ) as HTMLElement | null;
      const computedH = intEl
        ? Math.round(parseFloat(getComputedStyle(intEl).height))
        : -1;
      const radius = intEl ? getComputedStyle(intEl).borderRadius : "";
      const bg = intEl ? getComputedStyle(intEl).backgroundColor : "";
      const borderStyle = intEl ? getComputedStyle(intEl).borderTopStyle : "";

      ed.trigger("sorter:drag:end");
      const cleared = ph.style.getPropertyValue("--ets-drop-h").trim();
      const placementGone = !ph.dataset.etsPlacement;

      return {
        sourceH,
        varH,
        computedH,
        radius,
        bg,
        borderStyle,
        cleared,
        placementGone,
        etsPlacementDuring: "before",
      };
    });

    expect(result.sourceH).toBeGreaterThan(20);
    expect(result.varH).toMatch(/^\d+px$/);
    const varPx = Number.parseInt(result.varH, 10);
    // Clamped to source (or max 240)
    expect(varPx).toBeGreaterThanOrEqual(40);
    expect(Math.abs(varPx - Math.min(result.sourceH, 240))).toBeLessThanOrEqual(
      2,
    );
    expect(result.computedH).toBeGreaterThan(20);
    expect(result.computedH).not.toBe(10);
    expect(result.borderStyle).toBe("dashed");
    expect(result.cleared).toBe("");
    expect(result.placementGone).toBe(true);

    await page.screenshot({
      path: path.join(evidenceDir, "01-before-after-box.png"),
      fullPage: true,
    });
  });

  test("inside placement keeps slot panel; fallback height without source", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const result = await page.evaluate(() => {
      const ed = (
        window as Window & {
          __emailEditor?: {
            trigger: (ev: string, ...args: unknown[]) => void;
            Canvas: { getElement: () => HTMLElement | null };
          };
        }
      ).__emailEditor;
      if (!ed) throw new Error("no editor");

      ed.trigger("sorter:drag:start");
      ed.trigger("sorter:drag", { pos: { placement: "inside" } });

      const root = ed.Canvas.getElement();
      const ph = root?.querySelector(
        ".gjs-placeholder, .gjs-com-placeholder",
      ) as HTMLElement | null;
      if (!ph) throw new Error("no placeholder");

      const varH = ph.style.getPropertyValue("--ets-drop-h").trim();
      const placement = ph.dataset.etsPlacement;
      const intEl = ph.querySelector(
        ".gjs-placeholder-int, .gjs-com-placeholder-int",
      ) as HTMLElement | null;
      const minH = intEl
        ? Math.round(parseFloat(getComputedStyle(intEl).minHeight))
        : -1;

      ed.trigger("sorter:drag:end");
      return { varH, placement, minH };
    });

    expect(result.varH).toBe("112px");
    expect(result.placement).toBe("inside");
    expect(result.minH).toBeGreaterThanOrEqual(72);

    await page.screenshot({
      path: path.join(evidenceDir, "02-inside-unchanged.png"),
      fullPage: true,
    });
  });
});
