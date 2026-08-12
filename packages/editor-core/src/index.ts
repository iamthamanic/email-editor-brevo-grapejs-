/**
 * GrapesJS editor factory — hides GrapesJS wiring from app pages.
 * Location: packages/editor-core
 */

import grapesjs, { type Editor, type EditorConfig } from "grapesjs";
import {
  EMAIL_FONT_STACK,
  footerSectionContent,
  headerSectionContent,
  registerEmailComponents,
  sanitizeEmailHtml,
  socialSectionContent,
  emptyEmailTextBlock,
} from "@email-template/email-components";
import type { EditorProjectData } from "@email-template/email-schema";
import { wireDropIndicators } from "./dropIndicators.js";
import { migrateLegacyLayout } from "./migrateLegacyLayout.js";
import { migrateCanvasLayout } from "./migrateCanvasLayout.js";
import { attachRichTextController } from "./richText/index.js";
import { installNativeCustomRte } from "./richText/nativeCustomRte.js";
import {
  installRteSyncContentGuard,
  wireLiveRteModelSync,
} from "./rteSync.js";
import { wireSectionSlotOrder } from "./sectionOrder.js";

/** Re-export for future publish/renderer pipeline (F-02 HTML allowlist). */
export { sanitizeEmailHtml };
export { migrateLegacyLayout } from "./migrateLegacyLayout.js";
export {
  migrateCanvasLayout,
  migrateCanvasComponents,
} from "./migrateCanvasLayout.js";
export type { CanvasCompJson } from "./migrateCanvasLayout.js";
export {
  attachRichTextController,
  getRichTextController,
  RichTextController,
  IDLE_RICH_TEXT_STATE,
  RICH_TEXT_FONT_SIZES,
  type RichTextAlign,
  type RichTextBlockType,
  type RichTextCommand,
  type RichTextFormatState,
  type RichTextRunArg,
} from "./richText/index.js";

export interface CreateEditorOptions {
  container: HTMLElement;
  /** Mount point for Block Manager (left sidebar). */
  blocksContainer?: HTMLElement;
  /** Mount point for Trait Manager (style / properties). */
  traitsContainer?: HTMLElement;
  projectData?: EditorProjectData | null;
  height?: string;
}

/** Default canvas: locked chrome (header/footer/social) + editable content. */
export function defaultStarterComponents() {
  return [
    headerSectionContent(),
    {
      type: "email-section",
      sectionRole: "content",
      attributes: { "data-role": "content", "data-section-role": "content" },
      name: "Inhalt",
      components: [
        {
          type: "email-row",
          components: [
            {
              type: "email-column",
              components: [
                {
                  ...emptyEmailTextBlock(),
                },
              ],
            },
          ],
        },
      ],
    },
    footerSectionContent(),
    socialSectionContent(),
  ];
}

export function applyDefaultStarter(editor: Editor): void {
  editor.setComponents(defaultStarterComponents() as object[]);
  migrateLegacyLayout(editor);
  migrateCanvasLayout(editor);
}

type KeymasterLike = {
  filter: (event: KeyboardEvent) => boolean;
};

/**
 * GrapesJS keymaster ignores INPUT/TEXTAREA/SELECT but not contenteditable /
 * custom form widgets — then ⌘Z runs canvas undo instead of field undo.
 */
function patchKeymasterFormFieldFilter(): void {
  const key = (window as Window & { key?: KeymasterLike }).key;
  if (!key || typeof key.filter !== "function") return;
  if ((key as KeymasterLike & { __etsFormFilter?: boolean }).__etsFormFilter) {
    return;
  }
  const previous = key.filter.bind(key);
  key.filter = (event: KeyboardEvent) => {
    if (!previous(event)) return false;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return true;
    if (target.isContentEditable) return false;
    if (target.closest("[contenteditable='true']")) return false;
    if (
      target.closest(
        ".compose-email-chips, .compose-subject-field, .ed-form-title-input, .field-input",
      )
    ) {
      return false;
    }
    return true;
  };
  (key as KeymasterLike & { __etsFormFilter?: boolean }).__etsFormFilter = true;
}

export function createEmailEditor(options: CreateEditorOptions): Editor {
  const config: EditorConfig = {
    container: options.container,
    height: options.height ?? "100%",
    width: "auto",
    fromElement: false,
    storageManager: false,
    noticeOnUnload: false,
    // Hide stock GrapesJS chrome — we own the shell
    panels: { defaults: [] },
    blockManager: {
      appendTo: options.blocksContainer,
    },
    traitManager: {
      appendTo: options.traitsContainer,
    },
    layerManager: { appendTo: undefined },
    selectorManager: { appendTo: undefined },
    styleManager: { appendTo: undefined },
    deviceManager: {
      devices: [
        { id: "Desktop", name: "Desktop", width: "" },
        {
          id: "Mobile",
          name: "Mobile",
          width: "375px",
          widthMedia: "480px",
        },
      ],
    },
    // custom:true — hide Grapes floating RTE chrome; EditorToolbar drives formatting.
    // Lifecycle MUST go through setCustomRte (installNativeCustomRte) so enable/disable
    // always toggles contentEditable — the pattern every stable Grapes RTE uses.
    richTextEditor: {
      custom: true,
      actions: [
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "link",
      ],
    },
    // ponytail: canvas.styles expects stylesheet URLs — raw CSS becomes <link href="…">
    canvas: { styles: [] },
  };

  const editor = grapesjs.init(config);
  patchKeymasterFormFieldFilter();
  // Before components register: own contentEditable enable/disable (CKEditor guide pattern)
  installNativeCustomRte(editor);
  registerEmailComponents(editor);
  // After email-text view class exists so listenTo binds our patched syncContent
  installRteSyncContentGuard(editor);
  attachRichTextController(editor);

  const CANVAS_BASE_CSS = `
    * { box-sizing: border-box; }
    html {
      width: 100%;
      height: 100%;
      margin: 0;
      background-color: #e8eaed;
    }
    /* Full-width workspace; email column centered (equal left/right gutter) */
    body {
      width: 100% !important;
      min-height: 100%;
      margin: 0 !important;
      padding: 20px 24px 32px !important;
      background-color: #e8eaed !important;
      font-family: ${EMAIL_FONT_STACK};
      display: flex !important;
      flex-direction: column;
      align-items: center;
    }
    #wrapper,
    body > [data-gjs-type="wrapper"],
    [data-gjs-type="wrapper"] {
      display: block !important;
      width: 600px !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      flex: 0 0 auto;
    }
    /* Editor-only section frames (not part of email export CSS) */
    [data-email-type="email-section"] {
      position: relative;
      display: table !important;
      width: 100% !important;
      max-width: 600px !important;
      table-layout: fixed !important;
      margin: 0 0 24px 0 !important;
      border-collapse: separate !important;
      border-spacing: 0;
      border-radius: 4px;
      outline: 1px solid #c5c9d0;
      outline-offset: 0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    /*
     * Keep content clear of the in-box role label (“Inhalt”).
     * Prefer section padding so framed layout columns sit fully below the label
     * (column padding-top alone would leave the inset frame stuck under the label).
     */
    [data-email-type="email-section"]:not([data-layout="columns"]) {
      padding-top: 28px !important;
    }
    [data-email-type="email-row"] {
      width: 100% !important;
    }
    [data-email-type="email-column"] {
      vertical-align: top;
      position: relative;
      box-sizing: border-box !important;
    }
    /*
     * Column frames for multi-col layout: legacy top-level sections OR
     * nested email-layout-row (Phase 3+4 single content canvas).
     * Header/Footer/normal Inhalt stay without per-column frames.
     *
     * Width rule: layout row must match sibling content (e.g. image) —
     * never use border-spacing on a width:100% table (it overflows parent).
     */
    [data-email-type="email-section"][data-layout="columns"] {
      margin-bottom: 28px !important;
      padding: 32px 0 12px !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      box-sizing: border-box !important;
    }
    [data-email-type="email-layout-row"][data-layout="columns"] {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      box-sizing: border-box !important;
    }
    /* Gutter between layout columns via padding (keeps total ≤ parent width) */
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"],
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"] {
      box-sizing: border-box !important;
      padding: 0 5px !important;
      vertical-align: top;
    }
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"]:first-child,
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"]:first-child {
      padding-left: 0 !important;
    }
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"]:last-child,
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"]:last-child {
      padding-right: 0 !important;
    }
    /* All layout slots: dashed invite frame (empty + filled) */
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"],
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"] {
      border: 1.5px dashed rgba(39, 80, 115, 0.38);
      border-radius: 10px;
      background-color: rgba(39, 80, 115, 0.03);
      background-clip: padding-box;
      min-height: 48px;
      transition:
        border-color 160ms ease,
        background-color 160ms ease;
    }
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"].gjs-selected,
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"].gjs-selected {
      border-color: #275073 !important;
      background-color: rgba(39, 80, 115, 0.06) !important;
    }
    /*
     * Empty layout dropzones — calm premium invite (ERP primary).
     * ::before = plus cue; ::after = one-line hint.
     */
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type])),
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type])) {
      min-height: 128px !important;
      padding-top: 24px !important;
      padding-bottom: 24px !important;
      vertical-align: middle !important;
      text-align: center;
      background:
        linear-gradient(
          180deg,
          rgba(39, 80, 115, 0.07) 0%,
          rgba(39, 80, 115, 0.025) 100%
        ) !important;
      border: 1.5px dashed rgba(39, 80, 115, 0.45) !important;
      border-radius: 10px;
      cursor: pointer;
    }
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type])):hover,
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type])):hover {
      background:
        linear-gradient(
          180deg,
          rgba(39, 80, 115, 0.11) 0%,
          rgba(39, 80, 115, 0.04) 100%
        ) !important;
      border-color: rgba(39, 80, 115, 0.6) !important;
    }
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type]))::before,
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type]))::before {
      content: "+";
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin: 0 auto 12px;
      border-radius: 999px;
      border: 1px solid rgba(39, 80, 115, 0.28);
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 1px 2px rgba(39, 80, 115, 0.08);
      color: #275073;
      font-size: 20px;
      font-weight: 400;
      line-height: 1;
      pointer-events: none;
    }
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type]))::after,
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"]:not(:has([data-email-type]))::after {
      content: "Inhalt hinzufügen";
      display: block;
      text-align: center;
      margin: 0;
      padding: 0;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.01em;
      line-height: 1.4;
      color: rgba(39, 80, 115, 0.72);
      pointer-events: none;
    }
    [data-email-type="email-section"][data-layout="columns"] [data-email-type="email-column"].gjs-selected:not(:has([data-email-type])),
    [data-email-type="email-layout-row"][data-layout="columns"] [data-email-type="email-column"].gjs-selected:not(:has([data-email-type])) {
      border-color: #275073 !important;
      background:
        linear-gradient(
          180deg,
          rgba(39, 80, 115, 0.1) 0%,
          rgba(39, 80, 115, 0.04) 100%
        ) !important;
    }
    /*
     * Empty main content canvas (single column, not nested layout-row).
     * Same invite language as layout slots.
     */
    [data-email-type="email-section"][data-role="content"] [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type])),
    [data-email-type="email-section"]:not([data-role]) [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type])) {
      min-height: 128px !important;
      padding-top: 24px !important;
      padding-bottom: 24px !important;
      vertical-align: middle !important;
      text-align: center;
      border: 1.5px dashed rgba(39, 80, 115, 0.45) !important;
      border-radius: 10px;
      background:
        linear-gradient(
          180deg,
          rgba(39, 80, 115, 0.07) 0%,
          rgba(39, 80, 115, 0.025) 100%
        ) !important;
      cursor: pointer;
    }
    [data-email-type="email-section"][data-role="content"] [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type])):hover,
    [data-email-type="email-section"]:not([data-role]) [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type])):hover {
      border-color: rgba(39, 80, 115, 0.6) !important;
      background:
        linear-gradient(
          180deg,
          rgba(39, 80, 115, 0.11) 0%,
          rgba(39, 80, 115, 0.04) 100%
        ) !important;
    }
    [data-email-type="email-section"][data-role="content"] [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type]))::before,
    [data-email-type="email-section"]:not([data-role]) [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type]))::before {
      content: "+";
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin: 0 auto 12px;
      border-radius: 999px;
      border: 1px solid rgba(39, 80, 115, 0.28);
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 1px 2px rgba(39, 80, 115, 0.08);
      color: #275073;
      font-size: 20px;
      font-weight: 400;
      line-height: 1;
      pointer-events: none;
    }
    [data-email-type="email-section"][data-role="content"] [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type]))::after,
    [data-email-type="email-section"]:not([data-role]) [data-email-type="email-row"] > [data-email-type="email-column"]:not(:has([data-email-type]))::after {
      content: "Inhalt hinzufügen";
      display: block;
      text-align: center;
      margin: 0;
      padding: 0;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.01em;
      line-height: 1.4;
      color: rgba(39, 80, 115, 0.72);
      pointer-events: none;
    }
    [data-email-type="email-section"]::before {
      content: attr(data-role);
      position: absolute;
      top: 8px;
      left: 12px;
      z-index: 2;
      padding: 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1;
      color: #9aa0a6;
      background: transparent;
      border-radius: 0;
      pointer-events: none;
    }
    [data-email-type="email-section"][data-role="header"] {
      background-color: #f1f3f5 !important;
      outline-color: #b0b6be;
    }
    [data-email-type="email-section"][data-role="header"]::before {
      content: "Header";
      color: #9aa0a6;
      background: transparent;
    }
    [data-email-type="email-section"][data-role="footer"] {
      background-color: #f1f3f5 !important;
      outline-color: #b0b6be;
    }
    [data-email-type="email-section"][data-role="footer"]::before {
      content: "Footer";
      color: #9aa0a6;
      background: transparent;
    }
    [data-email-type="email-section"][data-role="content"],
    [data-email-type="email-section"]:not([data-role]) {
      background-color: #ffffff !important;
      outline-color: #9aa3ad;
    }
    /* Hollow content shell after delete — hide until prune removes it (anti-“Strich”) */
    [data-email-type="email-section"][data-role="content"]:not(:has([data-email-type="email-row"])),
    [data-email-type="email-section"]:not([data-role]):not(:has([data-email-type="email-row"])),
    [data-email-type="email-section"][data-role="content"]:not(:has([data-email-type="email-column"])),
    [data-email-type="email-section"]:not([data-role]):not(:has([data-email-type="email-column"])) {
      display: none !important;
      outline: none !important;
      border: none !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      min-height: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
      pointer-events: none !important;
    }
    [data-email-type="email-section"][data-role="content"]::before,
    [data-email-type="email-section"]:not([data-role])::before {
      content: "Inhalt";
      color: #9aa0a6;
      background: transparent;
    }
    [data-email-type="email-section"][data-role="social"] {
      background-color: #f7f8fa !important;
      outline-color: #b0b6be;
    }
    [data-email-type="email-section"][data-role="social"]::before {
      content: "Social Media";
      color: #9aa0a6;
      background: transparent;
    }
    [data-email-type="email-text"][data-placeholder="1"] {
      color: rgba(39, 80, 115, 0.45) !important;
      font-weight: 400 !important;
    }
    /* Empty image starter — radius + soft clip (artwork is SVG invite card) */
    [data-email-type="email-image"][data-placeholder="1"] {
      border-radius: 12px !important;
      overflow: hidden !important;
      box-shadow: none !important;
      outline: none !important;
    }
    /* Sibling breathing room — blocks must not stick together */
    [data-email-type="email-column"] > [data-email-type] {
      margin-top: 0 !important;
      margin-bottom: 16px !important;
    }
    [data-email-type="email-column"] > [data-email-type]:last-child {
      margin-bottom: 0 !important;
    }
    [data-email-type="email-layout-row"] {
      margin-top: 4px !important;
      margin-bottom: 16px !important;
    }
    /* Clickable text hosts — empty/placeholder blocks must still take pointer hits */
    [data-email-type="email-text"],
    [data-email-type="email-heading"] {
      min-height: 1.5em !important;
      cursor: text;
      max-width: 100%;
      overflow-wrap: break-word;
      word-wrap: break-word;
      font-family: ${EMAIL_FONT_STACK} !important;
    }
    /* Paste/chat often injects white-space:nowrap — keep body text wrapping in-column.
       Param pills keep their own nowrap badge styling. */
    [data-email-type="email-text"] *:not([data-email-type="email-param"]),
    [data-email-type="email-heading"] *:not([data-email-type="email-param"]) {
      max-width: 100%;
      overflow-wrap: break-word;
      word-wrap: break-word;
      font-family: inherit !important;
    }
    [data-email-type="email-text"] [style*="white-space"]:not([data-email-type="email-param"]),
    [data-email-type="email-heading"] [style*="white-space"]:not([data-email-type="email-param"]) {
      white-space: normal !important;
    }
    [data-email-type="email-text"][contenteditable="true"],
    [data-email-type="email-heading"][contenteditable="true"] {
      outline: 1px solid color-mix(in srgb, #275073 35%, transparent);
      outline-offset: 1px;
      /* Grapes/canvas chrome may set no-select — keep text markable while editing */
      user-select: text !important;
      -webkit-user-select: text !important;
    }
    /* Drop target highlight while dragging blocks from the host toolbar */
    .gjs-dashed,
    [data-gjs-highlightable].gjs-dashed,
    .gjs-highlighter-warning {
      outline: none !important;
      box-shadow: inset 0 0 0 2px color-mix(in srgb, #275073 55%, transparent) !important;
      background-color: rgba(39, 80, 115, 0.06) !important;
      border-radius: 4px;
      transition:
        box-shadow 120ms ease,
        background-color 120ms ease;
    }
    [data-email-type="email-column"].gjs-dashed {
      outline: none !important;
      border: 2px dashed #275073 !important;
      background-color: rgba(39, 80, 115, 0.08) !important;
      border-radius: 4px;
    }
    /* Only grow empty columns — filled ones keep natural height while sorting */
    [data-email-type="email-column"].gjs-dashed:not(:has([data-email-type])) {
      min-height: 96px !important;
      background-color: rgba(39, 80, 115, 0.1) !important;
    }
    [data-email-type="email-column"].gjs-dashed:not(:has([data-email-type]))::after {
      content: "Hier ablegen";
      color: #275073;
      font-weight: 500;
      font-size: 12px;
      letter-spacing: 0.01em;
    }
    /* Layout sections drag: hide column noise — insert happens between sections */
    html[data-ets-drag="section"] [data-email-type="email-column"].gjs-dashed,
    html[data-ets-drag="section"] [data-email-type="email-column"].gjs-dashed::after {
      box-shadow: none !important;
      background: transparent !important;
      min-height: 0 !important;
      content: none !important;
    }
    html[data-ets-drag="section"] [data-email-type="email-section"][data-role="content"].gjs-dashed,
    html[data-ets-drag="section"] [data-email-type="email-section"]:not([data-role]).gjs-dashed {
      box-shadow: inset 0 0 0 2px color-mix(in srgb, #275073 40%, transparent) !important;
      background-color: rgba(39, 80, 115, 0.04) !important;
    }
    /* Leaf drag: soft “open for insert” cue on the active content section */
    html[data-ets-drag="leaf"] [data-email-type="email-section"][data-role="content"]:has(.gjs-dashed),
    html[data-ets-drag="leaf"] [data-email-type="email-section"]:not([data-role]):has(.gjs-dashed) {
      outline-color: #275073;
      box-shadow: 0 0 0 2px color-mix(in srgb, #275073 28%, transparent);
    }
    /* Locked chrome: Brevo hint only when selected (click), not on hover */
    [data-email-type="email-section"][data-locked="1"].gjs-selected::after {
      content: attr(data-brevo-hint);
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 6;
      max-width: min(320px, 92%);
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: normal;
      text-transform: none;
      line-height: 1.35;
      text-align: center;
      color: #ffffff;
      background: rgba(39, 80, 115, 0.94);
      border-radius: 6px;
      pointer-events: none;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    }
    [data-email-type="email-section"].gjs-selected {
      outline: 2px solid #275073 !important;
      outline-offset: 1px;
    }
  `;
  const injectCanvasCss = (doc: Document) => {
    let el = doc.getElementById("ets-canvas-base-css") as HTMLStyleElement | null;
    if (!el) {
      el = doc.createElement("style");
      el.id = "ets-canvas-base-css";
      (doc.head ?? doc.documentElement).appendChild(el);
    }
    el.textContent = CANVAS_BASE_CSS;
  };
  editor.on("canvas:frame:load", ({ window: win }: { window: Window }) => {
    if (win?.document) injectCanvasCss(win.document);
  });
  editor.on("canvas:frame:load:body", ({ window: win }: { window: Window }) => {
    if (win?.document) injectCanvasCss(win.document);
  });

  const project = options.projectData;
  const importComponents =
    project &&
    project.__etsImport === 1 &&
    Array.isArray(project.components)
      ? project.components
      : null;

  if (importComponents) {
    editor.setComponents(importComponents as object[]);
  } else if (project && Object.keys(project).length > 0) {
    editor.loadProjectData(project);
  } else {
    applyDefaultStarter(editor);
  }

  migrateLegacyLayout(editor);
  migrateCanvasLayout(editor);

  // Constrain wrapper / email root: sections only, centered 600px
  const wrap = editor.getWrapper();
  wrap?.set({
    droppable: (src: { get: (k: string) => unknown }) =>
      String(src.get("type") ?? "") === "email-section",
  });
  wrap?.addStyle({
    width: "600px",
    "max-width": "100%",
    margin: "0 auto",
    display: "block",
  });

  // header → content → footer → social (exactly one content canvas)
  wireSectionSlotOrder(editor);
  wireDropIndicators(editor);
  wireLiveRteModelSync(editor);

  // Single-click on email-text / email-heading enters RTE (see register.ts).
  // Param badges stay selectable without stealing the text caret.

  const refreshCanvas = () => {
    editor.refresh();
  };
  requestAnimationFrame(refreshCanvas);
  window.addEventListener("resize", refreshCanvas);
  editor.on("destroy", () => {
    window.removeEventListener("resize", refreshCanvas);
  });

  return editor;
}

export function getProjectData(editor: Editor): EditorProjectData {
  return editor.getProjectData() as EditorProjectData;
}

export function loadProjectData(editor: Editor, data: EditorProjectData): void {
  editor.loadProjectData(data);
}

export {
  syncActiveRteToModel,
  getSyncedHtml,
  getSyncedProjectData,
  installRteSyncContentGuard,
  waitForEditorDomSettle,
  wireLiveRteModelSync,
} from "./rteSync.js";

export type { Editor };
