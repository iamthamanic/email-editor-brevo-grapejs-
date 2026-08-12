/**
 * Verify-UI — RTE re-entry after click-out on structural hosts (params/links).
 * Acceptance: `.qa/acceptance/rte-reentry-after-click-out.md`
 * Phase 0: retargeted from flat starter (was false-green) → structural fixture.
 * Location: apps/editor/e2e/verify-rte-reentry-after-click-out.spec.ts
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/rte-reentry-after-click-out",
);

async function caretOffset(
  text: import("@playwright/test").Locator,
): Promise<number> {
  return text.evaluate((el) => {
    const sel = el.ownerDocument.getSelection();
    if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return -1;
    const pre = el.ownerDocument.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(sel.anchorNode, sel.anchorOffset);
    return pre.toString().length;
  });
}

test.describe("verify-ui rte-reentry-after-click-out", () => {
  test("happy path + header leave + no scramble", async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");
    await openFixtureTemplate(page);

    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => text.innerText()).toMatch(/Sehr|Alpha|Gamma/i);
    await page.screenshot({
      path: path.join(evidenceDir, "01-typed-text.png"),
      fullPage: true,
    });

    await text.click({ position: { x: 24, y: 14 } });
    await expect.poll(async () => text.getAttribute("contenteditable")).toBe("true");
    await page.waitForTimeout(200);

    const canvas = page.locator(".gjs-cv-canvas").first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox!.x + 8, canvasBox!.y + 8);
    await page.waitForTimeout(350);
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .not.toBe("true");
    await page.screenshot({
      path: path.join(evidenceDir, "02-after-leave.png"),
      fullPage: true,
    });

    // Element click reaches iframe mousedown; page.mouse often hits overlays.
    await text.click({ position: { x: 72, y: 18 } });
    await expect.poll(async () => text.getAttribute("contenteditable")).toBe("true");
    await expect
      .poll(async () => caretOffset(text), { timeout: 3_000 })
      .toBeGreaterThan(0);
    await page.screenshot({
      path: path.join(evidenceDir, "03-reenter-mid-caret.png"),
      fullPage: true,
    });

    const before = await text.innerText();
    await page.keyboard.type("ZZZ");
    await expect.poll(async () => text.innerText()).toContain("ZZZ");
    const afterZ = await text.innerText();
    expect(afterZ.startsWith("ZZZ")).toBe(false);
    expect(afterZ.length).toBeGreaterThan(before.length);
    await page.screenshot({
      path: path.join(evidenceDir, "04-typed-after-reenter.png"),
      fullPage: true,
    });

    await page.mouse.click(canvasBox!.x + 8, canvasBox!.y + 8);
    await page.waitForTimeout(300);
    await text.click({ position: { x: 56, y: 16 } });
    await expect.poll(async () => text.getAttribute("contenteditable")).toBe("true");
    await page.keyboard.type("QQQ");
    await expect.poll(async () => text.innerText()).toContain("QQQ");

    // Leave via header chrome if present
    const header = frame.locator('[data-section-role="header"]').first();
    if ((await header.count()) > 0) {
      await header.click({ position: { x: 10, y: 10 }, force: true });
      await page.waitForTimeout(250);
      await text.click({ position: { x: 64, y: 16 } });
      await expect.poll(async () => text.getAttribute("contenteditable")).toBe("true");
      await page.keyboard.type("HDR");
      await expect.poll(async () => text.innerText()).toContain("HDR");
    }

    expect(consoleErrors, `console errors: ${consoleErrors.join("; ")}`).toEqual(
      [],
    );
  });
});
