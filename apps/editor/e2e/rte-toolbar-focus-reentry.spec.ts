/**
 * Regression: toolbar Variablen/Blöcke must not leave canvas RTE dead.
 * Acceptance: `.qa/acceptance/rte-toolbar-focus-reentry.md`
 * Location: apps/editor/e2e/rte-toolbar-focus-reentry.spec.ts
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/rte-toolbar-focus-reentry",
);

async function seedText(
  page: import("@playwright/test").Page,
  text: import("@playwright/test").Locator,
  seed: string,
) {
  await text.click({ position: { x: 24, y: 12 } });
  await expect.poll(async () => text.getAttribute("contenteditable")).toBe("true");
  await page.waitForTimeout(100);
  await page.keyboard.type(seed);
  await expect.poll(async () => text.innerText()).toContain(seed);
}

async function clickHostAndType(
  page: import("@playwright/test").Page,
  text: import("@playwright/test").Locator,
  marker: string,
) {
  const box = await text.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(
    box!.x + Math.min(box!.width * 0.55, 110),
    box!.y + Math.max(box!.height - 6, box!.height / 2),
  );
  await page.waitForTimeout(350);
  await expect.poll(async () => text.getAttribute("contenteditable")).toBe(
    "true",
  );
  await page.keyboard.type(marker);
  await expect.poll(async () => text.innerText()).toContain(marker);
}

test.describe("rte toolbar focus reentry", () => {
  test("Variablen Escape then type in text", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await createTemplateViaModal(page, `TbFocusEsc-${Date.now()}`);
    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });
    await seedText(page, text, "BeforeVars");

    await page.getByTestId("toolbar-variables-btn").click();
    await expect(page.getByTestId("toolbar-variables-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("toolbar-variables-menu")).toBeHidden();
    await clickHostAndType(page, text, "ESC");
    await page.screenshot({
      path: path.join(evidenceDir, "01-after-vars-escape-type.png"),
      fullPage: true,
    });
  });

  test("pick variable then continue typing", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await createTemplateViaModal(page, `TbFocusPick-${Date.now()}`);
    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });
    await seedText(page, text, "HelloWorld");

    await page.getByTestId("toolbar-variables-btn").click();
    await expect(page.getByTestId("toolbar-variables-menu")).toBeVisible();
    await page
      .getByTestId("toolbar-variables-menu")
      .locator("button")
      .first()
      .click();
    await page.waitForTimeout(400);
    // Insert should re-enable RTE; type without hunting clicks when possible
    await expect
      .poll(async () => text.getAttribute("contenteditable"), {
        timeout: 5_000,
      })
      .toBe("true");
    await page.keyboard.type("MID");
    await expect.poll(async () => text.innerText()).toContain("MID");
    await page.screenshot({
      path: path.join(evidenceDir, "02-after-pick-type.png"),
      fullPage: true,
    });
  });

  test("Blöcke Escape then type", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await createTemplateViaModal(page, `TbFocusBlocks-${Date.now()}`);
    const frame = page.frameLocator(".gjs-frame").first();
    const text = frame.locator('[data-email-type="email-text"]').first();
    await expect(text).toBeVisible({ timeout: 15_000 });
    await seedText(page, text, "BlockTest");

    await page.getByTestId("toolbar-blocks-btn").click();
    await expect(page.getByTestId("toolbar-blocks-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await clickHostAndType(page, text, "BLK");
  });
});
