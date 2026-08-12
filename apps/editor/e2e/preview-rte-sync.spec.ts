import { test, expect } from "@playwright/test";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Regression: preview must include in-progress RTE text (not empty body).
 * Location: apps/editor/e2e/preview-rte-sync.spec.ts
 */

test("preview shows typed content while RTE is still active", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await createTemplateViaModal(page, `PreviewSync-${Date.now()}`);

  const frame = page.frameLocator(".gjs-frame").first();
  const text = frame.locator('[data-email-type="email-text"]').first();
  await expect(text).toBeVisible({ timeout: 15_000 });

  await text.click({ position: { x: 20, y: 10 } });
  await expect
    .poll(async () => text.getAttribute("contenteditable"))
    .toBe("true");
  await page.waitForTimeout(200);
  const marker = `PreviewSyncBody-${Date.now()}`;
  await page.keyboard.type(
    `Sehr geehrte Kundin, ${marker} hier steht Inhalt.`,
    { delay: 20 },
  );
  await page.waitForTimeout(100);

  // Open preview WITHOUT clicking away from the text block first
  await page.getByRole("button", { name: "Vorschau", exact: true }).click();
  const modal = page.getByTestId("preview-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });

  const preview = page.getByTestId("preview-frame");
  await expect(preview).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(async () =>
      preview.evaluate((el) => {
        const iframe = el as HTMLIFrameElement;
        return iframe.srcdoc ?? "";
      }),
    )
    .toContain(marker);
});
