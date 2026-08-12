/**
 * Smoke: /email-editor loads with locked HV chrome sections.
 * Location: apps/editor/e2e/email-editor.spec.ts
 */

import { test, expect } from "@playwright/test";

type Comp = {
  getAttributes: () => Record<string, string>;
};

type EditorApi = {
  getWrapper: () => {
    findType: (t: string) => Comp[];
  };
};

test.describe("email-editor compose", () => {
  test("route shows compose form and locked chrome", async ({ page }) => {
    await page.goto("/email-editor");
    await expect(page.getByRole("heading", { name: "E-Mail schreiben" })).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible();
    await expect(page.getByLabel("An (Empfänger)")).toBeVisible();
    await expect(page.getByLabel("Betreff")).toBeVisible();

    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const roles = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: EditorApi }).__emailEditor;
      if (!ed) return [];
      return ed
        .getWrapper()
        .findType("email-section")
        .map((s) => ({
          role: s.getAttributes()["data-role"] ?? "",
          locked: s.getAttributes()["data-locked"] ?? "",
        }));
    });

    const byRole = Object.fromEntries(roles.map((r) => [r.role, r.locked]));
    expect(byRole.header).toBe("1");
    expect(byRole.content).not.toBe("1");
    expect(byRole.footer).toBe("1");
    expect(byRole.social).toBe("1");
  });

  test("send without recipient shows validation error", async ({ page }) => {
    await page.goto("/email-editor");
    await page.getByRole("button", { name: "Senden" }).click();
    await expect(page.getByRole("status")).toContainText(/Empfänger/i);
  });
});
