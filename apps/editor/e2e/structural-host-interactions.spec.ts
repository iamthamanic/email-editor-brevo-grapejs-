import { test, expect, type Page } from "@playwright/test";
import {
  openFixtureTemplate,
  seedTextbaustein,
} from "./helpers/openFixtureTemplate";

/**
 * Structural-host interaction regression harness.
 * Location: apps/editor/e2e/structural-host-interactions.spec.ts
 *
 * Fixture hosts include params/links (Starter templates were false-green).
 */
async function structuralHostIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
    const hosts = ed?.getWrapper?.()?.findType?.("email-text") ?? [];
    for (let i = 0; i < hosts.length; i += 1) {
      const kids = (hosts[i].components?.()?.models ?? []).map((c: any) =>
        String(c.get("type") ?? ""),
      );
      if (kids.includes("email-param") || kids.includes("link")) return i;
    }
    return 0;
  });
}

async function caretOfHost(page: Page, index: number): Promise<number> {
  return page.evaluate((idx) => {
    const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
    const hosts = ed?.getWrapper?.()?.findType?.("email-text") ?? [];
    const el = hosts[idx]?.getEl?.() as HTMLElement | undefined;
    if (!el) return -2;
    const sel = el.ownerDocument.getSelection();
    if (!sel?.anchorNode || !el.contains(sel.anchorNode)) return -1;
    const pre = el.ownerDocument.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(sel.anchorNode, sel.anchorOffset);
    return pre.toString().length;
  }, index);
}

test.describe("structural host interactions (Phase 0 harness)", () => {
  test("fixture loads with param + link children", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const inv = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const hosts = ed?.getWrapper?.()?.findType?.("email-text") ?? [];
      return hosts.map((h: any) => {
        const kids = (h.components?.()?.models ?? []).map((c: any) =>
          String(c.get("type") ?? ""),
        );
        const el = h.getEl?.() as HTMLElement | undefined;
        return {
          kids,
          textLen: (el?.textContent ?? "").length,
          hasParam: kids.includes("email-param"),
          hasLink: kids.includes("link"),
        };
      });
    });

    expect(inv.some((h: { hasParam: boolean }) => h.hasParam)).toBe(true);
    expect(inv.some((h: { hasLink: boolean }) => h.hasLink)).toBe(true);
    expect(
      inv.some((h: { textLen: number }) => h.textLen > 40),
    ).toBe(true);
  });

  test("cold leave→re-enter: caret stays at click (30 cycles)", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const idx = await structuralHostIndex(page);
    const frame = page.frameLocator(".gjs-frame").first();
    const host = frame.locator('[data-email-type="email-text"]').nth(idx);
    await host.scrollIntoViewIfNeeded();

    // page.mouse against host boundingBox often hits Grapes parent overlays and
    // never reaches the iframe mousedown handler — use element click instead.
    const clickPos = { x: 72, y: 18 };

    let failCaret = 0;
    for (let i = 0; i < 30; i += 1) {
      // Leave via empty canvas chrome (outside text hosts).
      const canvas = page.locator(".gjs-cv-canvas").first();
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await page.mouse.click(canvasBox.x + 8, canvasBox.y + 8);
      }
      await expect
        .poll(async () => host.getAttribute("contenteditable"), {
          timeout: 3_000,
        })
        .not.toBe("true");

      await host.click({ position: clickPos });
      await expect
        .poll(async () => host.getAttribute("contenteditable"), {
          timeout: 3_000,
        })
        .toBe("true");
      const caret = await caretOfHost(page, idx);
      if (caret <= 0) failCaret += 1;
    }

    expect(failCaret, `caret stuck at ≤0 in ${failCaret}/30 cycles`).toBe(0);
  });

  test("text hosts must not carry native draggable=true", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const before = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const hosts = ed?.getWrapper?.()?.findType?.("email-text") ?? [];
      return hosts.map((h: any) => ({
        id: h.getId?.(),
        modelDraggable: h.get?.("draggable"),
        domDraggable: (h.getEl?.() as HTMLElement | undefined)?.getAttribute(
          "draggable",
        ),
      }));
    });

    const anyNative = before.some(
      (h: { domDraggable: string | null }) => h.domDraggable === "true",
    );
    expect(anyNative, "text hosts must not carry draggable=true").toBe(false);
  });

  test("variable pill inserts at caret, not at start", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    // Prefer flat second host so caret placement does not depend on Phase-2 fix.
    const frame = page.frameLocator(".gjs-frame").first();
    const host = frame.locator('[data-email-type="email-text"]').nth(1);
    await host.scrollIntoViewIfNeeded();
    await host.click({ position: { x: 24, y: 12 } });
    await expect.poll(() => host.getAttribute("contenteditable")).toBe("true");
    await page.waitForTimeout(200);

    // Reliable caret: move to end, then a few steps left (mid-ish).
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+ArrowRight" : "End",
    );
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("ArrowLeft");
    }
    await page.waitForTimeout(100);

    const caretBefore = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
      const hosts = ed?.getWrapper?.()?.findType?.("email-text") ?? [];
      const el = hosts[1]?.getEl?.() as HTMLElement | undefined;
      if (!el) return -2;
      const sel = el.ownerDocument.getSelection();
      if (!sel?.anchorNode || !el.contains(sel.anchorNode)) return -1;
      const pre = el.ownerDocument.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(sel.anchorNode, sel.anchorOffset);
      return pre.toString().length;
    });
    expect(caretBefore).toBeGreaterThan(0);

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            typeof (
              window as Window & {
                __etsInsertVariable?: (input: {
                  key: string;
                  label: string;
                  expression: string;
                }) => boolean;
              }
            ).__etsInsertVariable,
        ),
      )
      .toBe("function");

    // Drive insert via the same module as the toolbar (avoids PW focus races on
    // the variables dropdown while still exercising caret-offset insertion).
    const inserted = await page.evaluate((offset) => {
      (
        window as Window & { __etsForcedCaretOffset?: number }
      ).__etsForcedCaretOffset = offset;
      return (
        window as Window & {
          __etsInsertVariable?: (input: {
            key: string;
            label: string;
            expression: string;
          }) => boolean;
        }
      ).__etsInsertVariable?.({
        key: "vorname",
        label: "Vorname",
        expression: "{{ params.vorname }}",
      });
    }, caretBefore);
    expect(inserted).toBe(true);
    await page.waitForTimeout(400);

    const pillIndex = await host.evaluate((el) => {
      const pills = el.querySelectorAll('[data-email-type="email-param"]');
      const last = pills[pills.length - 1];
      if (!last) return -1;
      const r = el.ownerDocument.createRange();
      r.selectNodeContents(el);
      r.setEnd(last, 0);
      return r.toString().length;
    });

    expect(pillIndex).toBeGreaterThanOrEqual(0);
    expect(
      Math.abs(pillIndex - caretBefore),
      `pill at ${pillIndex}, caret was ${caretBefore}`,
    ).toBeLessThanOrEqual(4);
  });

  test("Textbaustein merges into existing text host", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await openFixtureTemplate(page);
    const title = `E2E-TB-Drop-${Date.now()}`;
    const tbId = await seedTextbaustein(page, title);

    // Flat host — merge target without Phase-2 caret dependency
    const frame = page.frameLocator(".gjs-frame").first();
    const host = frame.locator('[data-email-type="email-text"]').nth(1);
    await host.scrollIntoViewIfNeeded();
    await host.click({ position: { x: 24, y: 12 } });
    await expect.poll(() => host.getAttribute("contenteditable")).toBe("true");
    const lenBefore = (await host.innerText()).length;

    await page.getByTestId("toolbar-saved-btn").click();
    const menu = page.getByTestId("toolbar-saved-menu");
    await expect(menu).toBeVisible();
    await page.getByTestId("textbaustein-search").fill(title);

    const insertBtn = page.getByTestId(`saved-section-${tbId}`);
    await expect(insertBtn).toBeVisible({ timeout: 10_000 });

    // Click-insert merges into the active text host (Drag→iframe is flaky in PW;
    // droppable/flatten is covered by unit tests + this merge path).
    await insertBtn.click();
    await page.waitForTimeout(800);

    const lenAfter = (await host.innerText()).length;
    expect(lenAfter, "Textbaustein must land in the text host").toBeGreaterThan(
      lenBefore,
    );

    const nested = await host.locator('[data-email-type="email-text"]').count();
    expect(nested, "must not leave nested email-text hosts").toBe(0);
  });
});
