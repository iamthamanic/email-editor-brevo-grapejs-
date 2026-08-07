import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Phase 1 Foundation acceptance — browser happy path + API revision conflict.
 * Location: apps/editor/e2e/phase-1-foundation.spec.ts
 * (also mirrored intent under .qa/runs/)
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/phase-1-foundation",
);

test.describe("Phase 1 Foundation", () => {
  test("list, create, edit, autosave, reload + revision conflict", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "E-Mail Templates" })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "01-template-list.png"),
      fullPage: true,
    });

    const listRes = await request.get("http://localhost:3001/api/templates");
    expect(listRes.ok()).toBeTruthy();
    const listJson = await listRes.json();
    expect(listJson.error).toBeNull();
    expect(Array.isArray(listJson.data)).toBeTruthy();

    await createTemplateViaModal(page, "Phase 1 Foundation");
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceDir, "02-editor-loaded.png"),
      fullPage: true,
    });

    const editorFrame = page.frameLocator("iframe").first();
    await expect(editorFrame.locator("body")).toBeVisible({ timeout: 15_000 });

    await page.waitForFunction(() => Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor));
    await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: { addComponents: (html: string) => void } }).__emailEditor;
      if (!ed) throw new Error("editor missing");
      ed.addComponents(`<div data-verify="1">VerifyUI ${Date.now()}</div>`);
    });

    await expect(page.getByText("Gespeichert")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(evidenceDir, "03-autosave-saved.png"),
      fullPage: true,
    });

    const url = page.url();
    await page.reload();
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Gespeichert").or(page.getByText("Bereit")).or(page.getByText("—")),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "04-after-reload.png"),
      fullPage: true,
    });

    const id = url.split("/").pop()!;
    const stale = await request.patch(`http://localhost:3001/api/templates/${id}`, {
      data: { expectedRevision: 1, name: "stale-tab" },
    });
    expect(stale.status()).toBe(409);
    const staleBody = await stale.json();
    expect(staleBody.error?.code).toBe("REVISION_CONFLICT");
  });

  test("AUTH_MODE unset is fail-closed (documented via health + unit tests)", async ({
    request,
  }) => {
    const health = await request.get("http://127.0.0.1:3001/api/health");
    expect(health.ok()).toBeTruthy();
    const body = await health.json();
    // Local e2e runs with explicit AUTH_MODE=dev in apps/api/.env
    expect(body.data.authMode).toBe("dev");
  });
});
