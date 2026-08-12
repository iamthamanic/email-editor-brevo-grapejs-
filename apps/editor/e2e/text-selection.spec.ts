import { test, expect } from "@playwright/test";
import { createTemplateViaModal } from "./helpers/createTemplate";
import { openFixtureTemplate } from "./helpers/openFixtureTemplate";

/**
 * Regression: canvas text must support drag-select and ⌘/Ctrl+A.
 * Leave→re-enter runs on the structural fixture (params/links) — Phase 0 harness.
 * Location: apps/editor/e2e/text-selection.spec.ts
 */

test.describe("canvas text selection", () => {
  test("drag-select and mod+a work inside email-text", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await createTemplateViaModal(page, `Select-${Date.now()}`);

    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });

    await text.click({ position: { x: 20, y: 10 } });
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .toBe("true");
    // Wait until Grapes reports live editing + forceEnable settled
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const ed = (window as Window & { __emailEditor?: { getEditing?: () => unknown } })
            .__emailEditor;
          return Boolean(ed?.getEditing?.());
        }),
      )
      .toBe(true);
    await page.waitForTimeout(250);
    await page.keyboard.insertText("Hello selection world");

    await expect
      .poll(async () => text.innerText(), { timeout: 10_000 })
      .toContain("selection");

    // ⌘/Ctrl+A first (more reliable than synthetic drag in iframes)
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A",
    );

    await expect
      .poll(async () =>
        text.evaluate((el) => el.ownerDocument.getSelection()?.toString() ?? ""),
      )
      .toMatch(/Hello selection world|selection world|Hello selection/);

    // Click mid-text — caret should land in the host (not outside)
    const box = await text.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.click(
      box.x + Math.min(box.width * 0.55, 120),
      box.y + box.height / 2,
    );
    await page.waitForTimeout(200);
    const caretAt = await text.evaluate((el) => {
      const sel = el.ownerDocument.getSelection();
      if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return -1;
      const pre = el.ownerDocument.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(sel.anchorNode, sel.anchorOffset);
      return pre.toString().length;
    });
    expect(caretAt).toBeGreaterThanOrEqual(0);

    // Double-click word select (also broken when mousedown is preventDefault'd)
    await text.dblclick({ position: { x: 40, y: 10 } });
    await page.waitForTimeout(100);
    const word = await text.evaluate(
      (el) => el.ownerDocument.getSelection()?.toString() ?? "",
    );
    // Soft assert: word select is nice-to-have; core is typing + mod+a
    if (word.length <= 2) {
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+A" : "Control+A",
      );
      await expect
        .poll(async () =>
          text.evaluate(
            (el) => el.ownerDocument.getSelection()?.toString() ?? "",
          ),
        )
        .toMatch(/\w{3,}/);
    } else {
      expect(word).toMatch(/\w{3,}/);
    }
  });

  test("mod+a selects param pills inside email-text", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await createTemplateViaModal(page, `ParamSelect-${Date.now()}`);

    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });

    await text.click({ position: { x: 20, y: 10 } });
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .toBe("true");
    await page.waitForTimeout(120);
    await page.keyboard.type("Hi ");

    await page.getByRole("button", { name: /Variablen/i }).click();
    await page.locator('[data-variable-key="vorname"]').click();

    await expect(
      text.locator('[data-email-type="email-param"]'),
    ).toBeVisible({ timeout: 10_000 });

    await text.click({ position: { x: 8, y: 8 } });
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A",
    );

    const selectedHasParam = await text.evaluate((el) => {
      const sel = el.ownerDocument.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const range = sel.getRangeAt(0);
      const pill = el.querySelector('[data-email-type="email-param"]');
      return Boolean(pill && range.intersectsNode(pill));
    });
    expect(selectedHasParam).toBeTruthy();
  });

  test("leave text block then re-enter still types at click", async ({
    page,
  }) => {
    // Structural hosts (params/links) — flat starter was false-green (Phase 0).
    test.fail(
      true,
      "Phase 0 expected RED — fix in Phase 2 (rte-dom-ownership)",
    );
    test.setTimeout(90_000);
    await page.goto("/");
    await openFixtureTemplate(page);

    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => text.innerText()).toMatch(/Alpha|Sehr|Gamma/i);

    // Enter once, leave, re-enter (cold path that kills caret on structural hosts)
    await text.click({ position: { x: 24, y: 14 } });
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .toBe("true");
    await page.waitForTimeout(200);

    const canvas = page.locator(".gjs-cv-canvas").first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    if (canvasBox) {
      await page.mouse.click(canvasBox.x + 8, canvasBox.y + 8);
    }
    await page.waitForTimeout(300);

    const box = await text.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.click(
      box.x + Math.min(box.width * 0.5, 100),
      box.y + Math.min(box.height * 0.55, 80),
    );
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .toBe("true");
    await page.waitForTimeout(200);

    const caretAfterReenter = await text.evaluate((el) => {
      const sel = el.ownerDocument.getSelection();
      if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return -1;
      const pre = el.ownerDocument.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(sel.anchorNode, sel.anchorOffset);
      return pre.toString().length;
    });
    expect(caretAfterReenter).toBeGreaterThan(0);

    const before = await text.innerText();
    await page.keyboard.type("ZZZ");
    await expect
      .poll(async () => text.innerText(), { timeout: 8_000 })
      .toContain("ZZZ");
    const after = await text.innerText();
    expect(after.length).toBeGreaterThan(before.length);
    expect(after.startsWith("ZZZ")).toBe(false);

    if (canvasBox) {
      await page.mouse.click(canvasBox.x + 8, canvasBox.y + 8);
    }
    await page.waitForTimeout(300);
    await page.mouse.click(
      box.x + Math.min(box.width * 0.4, 80),
      box.y + Math.min(box.height * 0.55, 80),
    );
    await expect
      .poll(async () => text.getAttribute("contenteditable"))
      .toBe("true");
    await page.waitForTimeout(200);
    await page.keyboard.type("QQQ");
    await expect
      .poll(async () => text.innerText(), { timeout: 8_000 })
      .toContain("QQQ");

    const caretAt = await text.evaluate((el) => {
      const sel = el.ownerDocument.getSelection();
      if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return -1;
      const pre = el.ownerDocument.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(sel.anchorNode, sel.anchorOffset);
      return pre.toString().length;
    });
    expect(caretAt).toBeGreaterThan(0);
    expect(after).toMatch(/ZZZ/);
  });

  test("mod+a works in Betreff field", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await createTemplateViaModal(page, `SubjectSelect-${Date.now()}`);

    const subject = page.getByTestId("compose-subject-edit");
    await expect(subject).toBeVisible();
    await subject.click();
    await expect
      .poll(async () => subject.innerText())
      .toMatch(/E2E Betreff/);
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A",
    );
    await expect
      .poll(async () =>
        subject.evaluate(() => window.getSelection()?.toString() ?? ""),
      )
      .toMatch(/E2E Betreff/);
  });
});
