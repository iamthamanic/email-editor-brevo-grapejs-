import { test, expect } from "@playwright/test";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Regression: paste into email-text must not blow layout (nowrap / overflow).
 * Location: apps/editor/e2e/paste-overflow.spec.ts
 */

const LONG =
  "Denn mit einem Halteverbot schaffen Sie Voraussetzungen, dass der Transporter unmittelbar vor dem Haus halten und das Umzugsgut bequem ein- und ausladen kann. Ohne Halteverbot riskieren Sie, dass der Lkw weiter weg parken muss.";

test.describe("paste overflow", () => {
  test("paste html with white-space:nowrap must still wrap in column", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await createTemplateViaModal(page, `PasteOverflow-${Date.now()}`);

    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });
    await text.click({ position: { x: 20, y: 10 } });
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .toBe("true");
    await page.waitForTimeout(200);

    const dirtyHtml = `<span style="white-space: nowrap; color: #fff; background-color: #000">${LONG}</span>`;

    await text.evaluate(async (el, html) => {
      el.focus();
      const dt = new DataTransfer();
      dt.setData("text/html", html);
      dt.setData("text/plain", el.textContent || "fallback");
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
    }, dirtyHtml);

    await page.waitForTimeout(300);

    const metrics = await text.evaluate((el) => {
      const host = el as HTMLElement;
      const styles: string[] = [];
      host.querySelectorAll("[style]").forEach((n) => {
        styles.push((n as HTMLElement).getAttribute("style") || "");
      });
      return {
        scrollWidth: host.scrollWidth,
        clientWidth: host.clientWidth,
        scrollHeight: host.scrollHeight,
        clientHeight: host.clientHeight,
        styles,
        innerHTML: host.innerHTML.slice(0, 500),
        text: (host.textContent || "").slice(0, 80),
      };
    });

    // Horizontal overflow = broken layout (selection box vs text mismatch)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
    expect(metrics.styles.join(" ")).not.toMatch(/white-space\s*:\s*nowrap/i);
  });

  test("paste plain long paragraph wraps inside email-text", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await createTemplateViaModal(page, `PastePlain-${Date.now()}`);

    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });
    await text.click({ position: { x: 20, y: 10 } });
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .toBe("true");
    await page.waitForTimeout(200);

    await page.keyboard.insertText(LONG);
    await page.waitForTimeout(200);

    const metrics = await text.evaluate((el) => {
      const host = el as HTMLElement;
      return {
        scrollWidth: host.scrollWidth,
        clientWidth: host.clientWidth,
        textLen: (host.textContent || "").length,
      };
    });
    expect(metrics.textLen).toBeGreaterThan(50);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  });
});
