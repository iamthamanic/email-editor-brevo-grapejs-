import { test, expect } from "@playwright/test";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Header/Footer/Social are locked chrome — no Grape toolbar; Brevo hint on click.
 * Location: apps/editor/e2e/section-header-footer.spec.ts
 */

type Comp = {
  get: (k: string) => unknown;
  getAttributes: () => Record<string, string>;
  findType: (t: string) => Comp[];
};

type EditorApi = {
  getSelected: () => { get: (k: string) => unknown } | undefined;
  select: (c: unknown) => void;
  getWrapper: () => {
    findType: (t: string) => Comp[];
  };
};

test.describe("section header/footer UX", () => {
  test("header is selectable; logo is not editable or selectable", async ({
    page,
  }) => {
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
      const img = images[0];
      if (img) ed.select(img);
      const afterSelect = ed.getSelected()?.get("type");
      return {
        hasHeader: true,
        selectedType,
        imageCount: images.length,
        imageEditable: img ? Boolean(img.get("editable")) : null,
        imageSelectable: img ? Boolean(img.get("selectable")) : null,
        // Child select should not stick on email-image when locked
        afterSelectChild: afterSelect,
        locked: header.getAttributes()["data-locked"],
      };
    });

    expect(info.hasHeader).toBe(true);
    expect(info.selectedType).toBe("email-section");
    expect(info.imageCount).toBeGreaterThanOrEqual(1);
    expect(info.imageEditable).toBe(false);
    expect(info.imageSelectable).toBe(false);
    expect(info.locked).toBe("1");
    expect(info.afterSelectChild).not.toBe("email-image");
  });

  test("footer has two columns with image + text (locked)", async ({ page }) => {
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
      const text = texts[0];
      return {
        hasFooter: true,
        colCount: cols.length,
        imageCount: images.length,
        textCount: texts.length,
        textEditable: text ? Boolean(text.get("editable")) : null,
        colDroppable: cols[0] ? Boolean(cols[0].get("droppable")) : null,
        locked: footer.getAttributes()["data-locked"],
      };
    });

    expect(info.hasFooter).toBe(true);
    expect(info.colCount).toBe(2);
    expect(info.imageCount).toBeGreaterThanOrEqual(2);
    expect(info.textCount).toBeGreaterThanOrEqual(1);
    expect(info.textEditable).toBe(false);
    expect(info.colDroppable).toBe(false);
    expect(info.locked).toBe("1");
  });

  test("header section rejects drops", async ({ page }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "Header Drop Locked");
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    const info = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: EditorApi }).__emailEditor;
      if (!ed) throw new Error("no editor");
      const header = ed
        .getWrapper()
        .findType("email-section")
        .find((s) => s.getAttributes()["data-role"] === "header");
      if (!header) throw new Error("no header");
      const col = header.findType("email-column")[0];
      return {
        sectionDroppable: Boolean(header.get("droppable")),
        colDroppable: col ? Boolean(col.get("droppable")) : null,
      };
    });

    expect(info.sectionDroppable).toBe(false);
    expect(info.colDroppable).toBe(false);
  });

  test("header/footer/social have Brevo hint and empty toolbar", async ({
    page,
  }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "Chrome Brevo Hint");
    await page.waitForFunction(() =>
      Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
    );

    for (const role of ["header", "footer", "social"] as const) {
      const info = await page.evaluate((r) => {
        const ed = (window as Window & { __emailEditor?: EditorApi })
          .__emailEditor;
        if (!ed) throw new Error("no editor");
        const section = ed
          .getWrapper()
          .findType("email-section")
          .find((s) => s.getAttributes()["data-role"] === r);
        if (!section) return { found: false as const };
        ed.select(section);
        const attrs = section.getAttributes();
        const toolbar = section.get("toolbar");
        return {
          found: true as const,
          locked: attrs["data-locked"],
          hint: attrs["data-brevo-hint"] ?? "",
          toolbarLen: Array.isArray(toolbar) ? toolbar.length : -1,
          title: attrs.title ?? "",
        };
      }, role);

      expect(info.found).toBe(true);
      if (!info.found) continue;
      expect(info.locked).toBe("1");
      expect(info.hint).toMatch(/Brevo/i);
      expect(info.title).toMatch(/Brevo/i);
      expect(info.toolbarLen).toBe(0);
      await expect(
        page.locator(".gjs-toolbar .gjs-toolbar-item"),
      ).toHaveCount(0);
    }
  });
});
