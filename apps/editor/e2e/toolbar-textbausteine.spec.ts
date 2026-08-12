import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Toolbar Textbausteine — create, search, insert, edit.
 * Location: apps/editor/e2e/toolbar-textbausteine.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/toolbar-textbausteine",
);

const unique = `TB-${Date.now()}`;

test("textbausteine CRUD from toolbar dropdown", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await createTemplateViaModal(page, "Textbausteine E2E");
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  await page.getByTestId("toolbar-saved-btn").click();
  const menu = page.getByTestId("toolbar-saved-menu");
  await expect(menu).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, "01-toolbar-textbausteine-open.png"),
    fullPage: true,
  });

  await page.getByTestId("saved-section-new").click();
  await expect(page.getByTestId("new-textbaustein-modal")).toBeVisible();
  await page.getByTestId("textbaustein-title").fill(unique);
  await page
    .getByTestId("textbaustein-text")
    .fill(`Hallo {{ params.vorname }}\nhttps://example.com/hv`);
  await page.screenshot({
    path: path.join(evidenceDir, "02-textbaustein-create.png"),
    fullPage: true,
  });
  await page.getByTestId("textbaustein-save").click();
  await expect(page.getByTestId("new-textbaustein-modal")).toBeHidden();

  // Re-open menu if closed
  if (!(await menu.isVisible())) {
    await page.getByTestId("toolbar-saved-btn").click();
  }
  await page.getByTestId("textbaustein-search").fill(unique);
  const row = page.getByRole("button", { name: new RegExp(unique) }).first();
  await expect(row).toBeVisible();
  await row.click();

  const html = await page.evaluate(() => {
    const ed = (
      window as Window & { __emailEditor?: { getHtml: () => string } }
    ).__emailEditor;
    return ed?.getHtml() ?? "";
  });
  expect(html).toContain("{{ params.vorname }}");
  expect(html).toContain("https://example.com/hv");

  await page.screenshot({
    path: path.join(evidenceDir, "03-textbaustein-inserted.png"),
    fullPage: true,
  });

  if (!(await menu.isVisible())) {
    await page.getByTestId("toolbar-saved-btn").click();
  }
  await page.getByTestId("textbaustein-search").fill(unique);
  const editBtn = page.locator(`[data-testid^="saved-section-edit-"]`).first();
  await page.locator(".ed-tb-saved-row").first().hover();
  await editBtn.click();
  await expect(page.getByTestId("new-textbaustein-modal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Textbaustein bearbeiten" })).toBeVisible();
  const editedTitle = `${unique}-edit`;
  await page.getByTestId("textbaustein-title").fill(editedTitle);
  await page.screenshot({
    path: path.join(evidenceDir, "04-textbaustein-edit.png"),
    fullPage: true,
  });
  await page.getByTestId("textbaustein-save").click();
  await expect(page.getByTestId("new-textbaustein-modal")).toBeHidden();

  if (!(await menu.isVisible())) {
    await page.getByTestId("toolbar-saved-btn").click();
  }
  await page.getByTestId("textbaustein-search").fill(editedTitle);
  await expect(
    page.getByRole("button", { name: new RegExp(editedTitle) }).first(),
  ).toBeVisible();
});
