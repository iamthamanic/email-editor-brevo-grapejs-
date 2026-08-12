/**
 * Regression: Brevo real-template param caret + mid-click typing.
 * Design: .qa/acceptance/param-mid-caret-brevo-rte.md
 * Location: apps/editor/e2e/verify-param-mid-caret-brevo-rte.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";

const TEMPLATE_ID =
  process.env.DEBUG_TEMPLATE_ID ?? "9cd044a5-3db9-4fd6-8374-50e2fcfc20a1";

async function openReal(page: Page) {
  await page.goto(`/templates/${TEMPLATE_ID}`);
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );
  await page.waitForTimeout(600);
}

async function absCaret(page: Page, hostIndex: number): Promise<number> {
  return page.evaluate((idx) => {
    const ed = (window as Window & { __emailEditor?: any }).__emailEditor;
    const hosts = ed?.getWrapper?.()?.findType?.("email-text") ?? [];
    const el = hosts[idx]?.getEl?.() as HTMLElement | undefined;
    if (!el) return -2;
    const sel = el.ownerDocument.getSelection();
    if (!sel?.anchorNode || !el.contains(sel.anchorNode)) return -1;
    if (
      (sel.anchorNode instanceof Element
        ? sel.anchorNode
        : sel.anchorNode.parentElement
      )?.closest?.('[data-email-type="email-param"]')
    ) {
      return -3; // still inside param
    }
    const pre = el.ownerDocument.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(sel.anchorNode, sel.anchorOffset);
    return pre.toString().length;
  }, hostIndex);
}

test.describe("verify param-mid-caret Brevo RTE", () => {
  test("param pill click: caret outside pill and typing inserts", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openReal(page);

    const frame = page.frameLocator(".gjs-frame").first();
    const host = frame.locator('[data-email-type="email-text"]').first();
    const param = host.locator('[data-email-type="email-param"]').first();
    await expect(param).toBeVisible({ timeout: 10_000 });

    await param.click();
    await page.waitForTimeout(200);

    const caret = await absCaret(page, 0);
    expect(caret, "caret must not stay inside param pill").toBeGreaterThan(-1);
    expect(caret).not.toBe(-3);

    const marker = `PARAMOK${Date.now() % 10000}`;
    await page.keyboard.type(marker, { delay: 12 });
    await expect.poll(async () => host.innerText()).toContain(marker);
  });

  test("mid-click on content host: caret not stuck at 0; typing near click", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openReal(page);

    const frame = page.frameLocator(".gjs-frame").first();
    // Prefer a long content host (Auftragsdetails / greeting) — index 1 is rich HTML
    const host = frame.locator('[data-email-type="email-text"]').nth(1);
    await host.scrollIntoViewIfNeeded();
    const box = await host.boundingBox();
    expect(box).toBeTruthy();
    const x = Math.floor((box?.width ?? 400) * 0.55);
    const y = Math.min(40, Math.floor((box?.height ?? 80) * 0.35));

    await host.click({ position: { x, y } });
    await page.waitForTimeout(220);

    const caret = await absCaret(page, 1);
    // After fix: mid-click must not collapse to silent offset 0 on rich hosts.
    // Allow end-fallback (≥1) but fail hard stuck-at-0 when host has substantial text.
    const textLen = (await host.innerText()).length;
    expect(textLen).toBeGreaterThan(40);
    expect(caret, `mid-click caret was ${caret}`).toBeGreaterThan(0);

    const marker = `MIDOK${Date.now() % 10000}`;
    await page.keyboard.type(marker, { delay: 10 });
    const after = await host.innerText();
    expect(after).toContain(marker);
    // Marker should not be glued only at absolute start when caret was mid/end
    if (caret > 8) {
      expect(after.indexOf(marker)).toBeGreaterThan(0);
    }
  });

  test("footer text remains locked", async ({ page }) => {
    test.setTimeout(60_000);
    await openReal(page);
    const frame = page.frameLocator(".gjs-frame").first();
    const hosts = frame.locator('[data-email-type="email-text"]');
    const count = await hosts.count();
    const footer = hosts.nth(count - 1);
    await footer.scrollIntoViewIfNeeded();
    await footer.click({ position: { x: 40, y: 16 } });
    await page.waitForTimeout(150);
    await page.keyboard.type("FOOTERNO");
    await expect.poll(async () => footer.innerText()).not.toContain("FOOTERNO");
  });
});
