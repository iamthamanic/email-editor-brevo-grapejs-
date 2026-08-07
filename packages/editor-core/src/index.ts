/**
 * GrapesJS editor factory — hides GrapesJS wiring from app pages.
 * Location: packages/editor-core
 */

import grapesjs, { type Editor, type EditorConfig } from "grapesjs";
import {
  footerSectionContent,
  headerSectionContent,
  registerEmailComponents,
  sanitizeEmailHtml,
} from "@email-template/email-components";
import type { EditorProjectData } from "@email-template/email-schema";
import { migrateLegacyLayout } from "./migrateLegacyLayout.js";
import { attachRichTextController } from "./richText/index.js";

/** Re-export for future publish/renderer pipeline (F-02 HTML allowlist). */
export { sanitizeEmailHtml };
export { migrateLegacyLayout } from "./migrateLegacyLayout.js";
export {
  attachRichTextController,
  getRichTextController,
  RichTextController,
  IDLE_RICH_TEXT_STATE,
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

/** Default canvas for new / empty templates: header + content + footer. */
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
                { type: "email-heading", content: "Überschrift" },
                { type: "email-text", content: "Text hier eingeben…" },
              ],
            },
          ],
        },
      ],
    },
    footerSectionContent(),
  ];
}

export function applyDefaultStarter(editor: Editor): void {
  editor.setComponents(defaultStarterComponents() as object[]);
  migrateLegacyLayout(editor);
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
    // custom:true — GrapesJS RTE engine stays; built-in floating toolbar UI is not rendered.
    // Global EditorToolbar drives formatting via RichTextController.
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
  registerEmailComponents(editor);
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
      font-family: Arial, Helvetica, sans-serif;
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
      margin: 0 0 14px 0 !important;
      border-collapse: separate !important;
      border-spacing: 0;
      border-radius: 4px;
      outline: 1px solid #c5c9d0;
      outline-offset: 0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    /* Keep content clear of the in-box role label */
    [data-email-type="email-section"] > [data-email-type="email-row"]:first-child > [data-email-type="email-column"] {
      padding-top: 28px !important;
    }
    [data-email-type="email-row"] {
      width: 100% !important;
    }
    [data-email-type="email-column"] {
      vertical-align: top;
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

  // Single-click selects the whole block (move / drop into it).
  // Double-click (GrapesJS default) enters inline text edit.
  // ponytail: no auto-RTE on select — badges + DnD need a stable selection

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

export type { Editor };
