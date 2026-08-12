import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Global toolbar ↔ GrapesJS RTE — single toolbar, selection preserved.
 * Location: apps/editor/e2e/rich-text-toolbar.spec.ts
 */

const evidenceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.qa/evidence/rich-text-toolbar",
);

type EditorApi = {
  getHtml: () => string;
  getEditing: () => { get: (k: string) => unknown } | undefined;
  getSelected: () => unknown;
  select: (c: unknown) => void;
  addComponents: (c: unknown) => unknown;
  getWrapper: () => {
    find: (s: string) => { at: (i: number) => unknown; length: number };
  };
  RichTextEditor: {
    globalRte?: { exec: (c: string, v?: string) => void; el?: HTMLElement };
    getToolbarEl: () => HTMLElement;
  };
  Canvas: { getDocument: () => Document; getFrameEl: () => HTMLIFrameElement };
};

async function waitForEditor(page: Page) {
  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );
}

async function seedEditableText(page: Page, html: string) {
  await page.evaluate((content) => {
    const ed = (
      window as Window & {
        __emailEditor?: EditorApi & {
          getWrapper: () => {
            findType: (t: string) => Array<{
              getAttributes: () => Record<string, string>;
              findType: (t: string) => Array<{
                components?: (c?: unknown) => unknown;
                set?: (k: string, v: unknown) => void;
              }>;
            }>;
            find: (s: string) => {
              at: (i: number) => {
                set?: (k: string, v: unknown) => void;
                components?: (c?: unknown) => unknown;
              } | undefined;
              length: number;
            };
          };
          select: (c: unknown) => void;
          addComponents: (c: unknown) => unknown;
        };
      }
    ).__emailEditor;
    if (!ed) throw new Error("editor missing");

    // Prefer content-role section text; avoid footer contact text
    const sections = ed.getWrapper().findType("email-section");
    const contentSec =
      sections.find((s) => s.getAttributes()["data-role"] === "content") ??
      sections[0];
    let text = contentSec?.findType("email-text")[0];
    if (!text) {
      ed.addComponents({
        type: "email-section",
        attributes: { "data-role": "content" },
        components: [
          {
            type: "email-row",
            components: [
              {
                type: "email-column",
                components: [{ type: "email-text", content }],
              },
            ],
          },
        ],
      });
      text = ed
        .getWrapper()
        .findType("email-section")
        .find((s) => s.getAttributes()["data-role"] === "content")
        ?.findType("email-text")[0];
    } else {
      text.components?.([]);
      text.set?.("content", content);
      try {
        text.components?.(content);
      } catch {
        // ignore
      }
    }
    ed.select(text);
  }, html);
}


/** Click the content email-text to enter GrapesJS RTE. */
async function enterRteViaClick(page: Page) {
  const frame = page.frameLocator("iframe").first();
  // Content section text — avoid header/footer placeholders
  const text = frame
    .locator(
      '[data-email-type="email-section"][data-role="content"] [data-email-type="email-text"]',
    )
    .first();
  await expect(text).toBeVisible({ timeout: 10_000 });
  await text.click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const ed = (window as Window & { __emailEditor?: EditorApi })
          .__emailEditor;
        return Boolean(ed?.getEditing());
      }),
    )
    .toBe(true);
}

async function selectSubstringInRte(page: Page, needle: string) {
  await page.evaluate((text) => {
    const ed = (
      window as Window & {
        __emailEditor?: EditorApi & {
          getEditing: () =>
            | {
                getView?: () => { el?: HTMLElement };
                getEl?: () => HTMLElement;
              }
            | undefined;
        };
      }
    ).__emailEditor;
    if (!ed) throw new Error("editor missing");
    const doc = ed.Canvas.getDocument();
    const editing = ed.getEditing();
    const root =
      editing?.getView?.()?.el ??
      editing?.getEl?.() ??
      (doc.querySelector(
        '[data-email-type="email-section"][data-role="content"] [data-email-type="email-text"][contenteditable="true"]',
      ) as HTMLElement | null) ??
      (doc.querySelector(
        '[data-email-type="email-section"][data-role="content"] [data-email-type="email-text"]',
      ) as HTMLElement | null) ??
      (doc.querySelector(
        '[data-email-type="email-text"][contenteditable="true"]',
      ) as HTMLElement | null);
    if (!root) throw new Error("active email-text missing in canvas");

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null = null;
    let start = -1;
    const dump: string[] = [];
    while (walker.nextNode()) {
      const n = walker.currentNode as Text;
      dump.push(n.data);
      const idx = n.data.indexOf(text);
      if (idx >= 0) {
        node = n;
        start = idx;
        break;
      }
    }
    if (!node || start < 0) {
      throw new Error(
        `text "${text}" not found in: ${JSON.stringify(dump).slice(0, 400)}`,
      );
    }

    const range = doc.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + text.length);
    const sel = doc.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    root.focus();
  }, needle);
}

/**
 * Playwright focuses the host button before mousedown, which drops the iframe
 * selection. Dispatch mouse events so React's preventDefault path runs like a
 * real user click without Playwright's pre-focus.
 */
async function clickFormatControl(page: Page, testId: string) {
  await page.getByTestId(testId).evaluate((el) => {
    const target = el as HTMLElement;
    target.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }),
    );
    target.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }),
    );
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
    );
  });
}

async function setBlockType(page: Page, tag: string) {
  await page.getByTestId("toolbar-block-type").evaluate((el, value) => {
    const select = el as HTMLSelectElement;
    select.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }),
    );
    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, tag);
}

test.describe("rich text global toolbar", () => {
  test("bold via top toolbar; no floating RTE; states", async ({ page }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "RTE Toolbar Bold");
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 15_000 });
    await waitForEditor(page);

    await seedEditableText(page, "Unsere Bestellnummer: Demo");
    await enterRteViaClick(page);

    const floatingVisible = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: EditorApi })
        .__emailEditor;
      const el = ed?.RichTextEditor.getToolbarEl();
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    expect(floatingVisible).toBe(false);

    const boldBtn = page.getByTestId("toolbar-bold");
    await expect(boldBtn).toBeEnabled();

    await selectSubstringInRte(page, "Unsere Bestellnummer");
    await clickFormatControl(page, "toolbar-bold");

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const ed = (window as Window & { __emailEditor?: EditorApi })
            .__emailEditor;
          const doc = ed?.Canvas.getDocument();
          const root = doc?.querySelector('[data-email-type="email-text"]');
          const html = (root?.innerHTML ?? "").toLowerCase();
          return /<(b|strong)\b/.test(html);
        }),
      )
      .toBe(true);

    await expect(boldBtn).toHaveAttribute("aria-pressed", "true");

    await page.screenshot({
      path: path.join(evidenceDir, "01-bold-global-toolbar.png"),
      fullPage: true,
    });

    await page.evaluate(() => {
      const ed = (
        window as Window & {
          __emailEditor?: EditorApi & {
            stopEditing?: () => void;
          };
        }
      ).__emailEditor;
      if (!ed) return;
      const view = (
        ed.getEditing() as
          | { getView?: () => { disableEditing?: () => void } }
          | undefined
      )?.getView?.();
      view?.disableEditing?.();
      ed.stopEditing?.();
    });

    await expect.poll(async () => boldBtn.isDisabled()).toBe(true);
  });

  test("heading + alignment via controller", async ({ page }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "RTE Heading Align");
    await waitForEditor(page);

    await seedEditableText(page, "Zeile für Format");
    await enterRteViaClick(page);
    await selectSubstringInRte(page, "Zeile für Format");

    await setBlockType(page, "h2");

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const ed = (window as Window & { __emailEditor?: EditorApi })
            .__emailEditor;
          const doc = ed?.Canvas.getDocument();
          const root = doc?.querySelector('[data-email-type="email-text"]');
          return Boolean(root?.querySelector("h2") || doc?.querySelector('[data-email-type="email-text"] h2'));
        }),
      )
      .toBe(true);

    await selectSubstringInRte(page, "Zeile für Format");
    await clickFormatControl(page, "toolbar-align-center");
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const ed = (window as Window & { __emailEditor?: EditorApi })
            .__emailEditor;
          const doc = ed?.Canvas.getDocument();
          const root = doc?.querySelector(
            '[data-email-type="email-text"]',
          ) as HTMLElement | null;
          if (!root) return false;
          const block =
            (root.querySelector("h2") as HTMLElement | null) ?? root;
          const align =
            block.getAttribute("align") ||
            block.style.textAlign ||
            getComputedStyle(block).textAlign ||
            "";
          return (
            align === "center" ||
            Boolean(doc?.queryCommandState("justifyCenter")) ||
            /text-align:\s*center/i.test(block.getAttribute("style") ?? "")
          );
        }),
      )
      .toBe(true);
  });

  test("variable pill survives bold of surrounding label", async ({ page }) => {
    await page.goto("/");
    await createTemplateViaModal(page, "RTE Pill Bold");
    await waitForEditor(page);

    await seedEditableText(
      page,
      'Unsere Bestellnummer: <span data-email-type="email-param" data-param-key="bestellnummer" class="email-param-badge" contenteditable="false">Bestellnummer</span>',
    );

    // Enable RTE via Grapes API (dblclick can hit contenteditable=false pill)
    await page.evaluate(() => {
      const ed = (
        window as Window & {
          __emailEditor?: EditorApi & {
            getSelected: () =>
              | {
                  getView?: () => { onActive?: () => void };
                  get: (k: string) => unknown;
                }
              | undefined;
          };
        }
      ).__emailEditor;
      const sel = ed?.getSelected();
      if (sel?.get("editable")) {
        sel.getView?.()?.onActive?.();
        return;
      }
      const text = ed
        ?.getWrapper()
        .find(
          '[data-email-type="email-section"][data-role="content"] [data-email-type="email-text"]',
        )
        .at(0) as
        | { getView?: () => { onActive?: () => void } }
        | undefined;
      text?.getView?.()?.onActive?.();
    });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const ed = (window as Window & { __emailEditor?: EditorApi })
            .__emailEditor;
          return Boolean(ed?.getEditing());
        }),
      )
      .toBe(true);

    await selectSubstringInRte(page, "Unsere Bestellnummer:");
    await clickFormatControl(page, "toolbar-bold");

    const result = await page.evaluate(() => {
      const ed = (window as Window & { __emailEditor?: EditorApi })
        .__emailEditor;
      const html = ed?.getHtml() ?? "";
      const doc = ed?.Canvas.getDocument();
      const pill = doc?.querySelector(
        '[data-email-type="email-param"][data-param-key="bestellnummer"]',
      );
      return {
        html,
        pillOk: Boolean(pill),
        key: pill?.getAttribute("data-param-key") ?? null,
      };
    });

    expect(result.pillOk).toBe(true);
    expect(result.key).toBe("bestellnummer");
    expect(result.html).toContain("{{ params.bestellnummer }}");
    expect(result.html.toLowerCase()).toMatch(/<(b|strong)/);
  });
});
