import { test, expect } from "@playwright/test";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Header/Footer as selectable sections with editable image children.
 * Location: apps/editor/e2e/section-header-footer.spec.ts
 */

type EditorApi = {
  getSelected: () => { get: (k: string) => unknown; getAttributes?: () => Record<string, string> } | undefined;
  select: (c: unknown) => void;
  getWrapper: () => {
    find: (s: string) => { at: (i: number) => unknown; length: number };
    findType: (t: string) => Array<{
      get: (k: string) => unknown;
      getAttributes: () => Record<string, string>;
      findType: (t: string) => unknown[];
    }>;
  };
  getHtml: () => string;
};

test.describe("section header/footer UX", () => {
  test("header section + logo image separately selectable", async ({ page }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "Section Header UX");
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const info = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: EditorApi }).__emailEditor;
      if (!ed) throw new Error("no editor");
      const sections = ed.getWrapper().findType("email-section");
      const header = sections.find(
        (s) => s.getAttributes()["data-role"] === "header",
      );
      if (!header) return { hasHeader: false };
      ed.select(header);
      const selectedType = ed.getSelected()?.get("type");
      const images = header.findType("email-image");
      if (images[0]) ed.select(images[0]);
      const selectedImage = ed.getSelected()?.get("type");
      return {
        hasHeader: true,
        selectedType,
        selectedImage,
        imageCount: images.length,
      };
    });

    expect(info.hasHeader).toBe(true);
    expect(info.selectedType).toBe("email-section");
    expect(info.imageCount).toBeGreaterThanOrEqual(1);
    expect(info.selectedImage).toBe("email-image");
  });

  test("footer has two columns with image + text", async ({ page }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "Section Footer UX");
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const info = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: EditorApi }).__emailEditor;
      if (!ed) throw new Error("no editor");
      const sections = ed.getWrapper().findType("email-section");
      const footer = sections.find(
        (s) => s.getAttributes()["data-role"] === "footer",
      );
      if (!footer) return { hasFooter: false };
      const cols = footer.findType("email-column");
      const images = footer.findType("email-image");
      const texts = footer.findType("email-text");
      return {
        hasFooter: true,
        colCount: cols.length,
        imageCount: images.length,
        textCount: texts.length,
      };
    });

    expect(info.hasFooter).toBe(true);
    expect(info.colCount).toBe(2);
    expect(info.imageCount).toBeGreaterThanOrEqual(2);
    expect(info.textCount).toBeGreaterThanOrEqual(1);
  });

  test("can append image into header column", async ({ page }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "Header Drop Image");
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const after = await page.evaluate(() => {
      const ed = (
        window as Window & {
          __emailEditor?: EditorApi & {
            select: (c: unknown) => void;
          };
        }
      ).__emailEditor;
      if (!ed) throw new Error("no editor");
      const header = ed
        .getWrapper()
        .findType("email-section")
        .find((s) => s.getAttributes()["data-role"] === "header");
      if (!header) throw new Error("no header");
      const col = header.findType("email-column")[0] as {
        append: (c: unknown) => void;
        findType: (t: string) => unknown[];
      };
      const before = col.findType("email-image").length;
      col.append({
        type: "email-image",
        attributes: {
          src: "https://placehold.co/80x40?text=2",
          alt: "Extra",
        },
      });
      return {
        before,
        after: col.findType("email-image").length,
      };
    });

    expect(after.after).toBe(after.before + 1);
  });
});
