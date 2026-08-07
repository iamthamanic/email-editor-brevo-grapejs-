/**
 * Bridges global toolbar ↔ GrapesJS RichTextEditor (single editing context).
 * Location: packages/editor-core/src/richText/controller.ts
 */

import type { Component, Editor } from "grapesjs";
import {
  IDLE_RICH_TEXT_STATE,
  type RichTextAlign,
  type RichTextBlockType,
  type RichTextFormatState,
  type RichTextRunArg,
} from "./state.js";

type RteLike = {
  exec?: (cmd: string, value?: string) => void;
  selection?: () => Selection | null;
  insertHTML?: (html: string) => void;
  el?: HTMLElement;
};

type ComponentViewLike = {
  model?: Component;
  el?: HTMLElement;
};

const CONTROLLER_KEY = "__etsRichTextController";

function asRecord(ed: Editor): Record<string, unknown> {
  return ed as unknown as Record<string, unknown>;
}

function queryState(doc: Document, cmd: string): boolean {
  try {
    return Boolean(doc.queryCommandState(cmd));
  } catch {
    return false;
  }
}

function detectBlockType(el: Element | null): RichTextBlockType {
  let node: Element | null = el;
  while (node && node !== node.ownerDocument?.body) {
    const tag = node.tagName?.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      return tag;
    }
    if (tag === "p" || tag === "div" || tag === "li") return "p";
    node = node.parentElement;
  }
  return "p";
}

function detectAlign(el: Element | null, doc: Document): RichTextAlign {
  if (queryState(doc, "justifyCenter")) return "center";
  if (queryState(doc, "justifyRight")) return "right";
  if (queryState(doc, "justifyFull")) return "justify";
  if (queryState(doc, "justifyLeft")) return "left";
  if (!el) return "";
  const align = (getComputedStyle(el).textAlign || "").toLowerCase();
  if (align === "center") return "center";
  if (align === "right" || align === "end") return "right";
  if (align === "justify") return "justify";
  if (align === "left" || align === "start") return "left";
  return "";
}

function selectionAnchorElement(doc: Document): Element | null {
  const sel = doc.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.anchorNode;
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

export class RichTextController {
  private readonly editor: Editor;
  private state: RichTextFormatState = { ...IDLE_RICH_TEXT_STATE };
  private readonly listeners = new Set<(s: RichTextFormatState) => void>();
  private unbind: Array<() => void> = [];
  private canvasUnbind: Array<() => void> = [];

  constructor(editor: Editor) {
    this.editor = editor;
    this.bindEditorEvents();
  }

  getState(): RichTextFormatState {
    return this.state;
  }

  subscribe(listener: (s: RichTextFormatState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Run a formatting command against the active GrapesJS RTE only. */
  run(arg: RichTextRunArg): void {
    if (!this.state.active) return;
    const rteMod = this.editor.RichTextEditor;
    const rte = rteMod.globalRte as RteLike | undefined;
    if (!rte?.exec) return;

    // Toolbar lives outside the canvas iframe — restore selection after focus.
    const restored = this.restoreSelection(rte);
    if (!restored) {
      this.focusCanvasRte(rte);
    }

    if (typeof arg === "string") {
      this.runNamed(arg, rte);
    } else if (arg.type === "block") {
      rte.exec("formatBlock", arg.tag === "p" ? "p" : arg.tag);
    } else if (arg.type === "foreColor") {
      rte.exec("foreColor", arg.color);
    }

    this.syncFormatFromDom();
  }

  /**
   * Capture the canvas selection, focus the RTE host without dropping the range,
   * then re-apply the range. Prevents parent-chrome clicks from wiping formatting targets.
   */
  private restoreSelection(rte: RteLike): boolean {
    const el = rte.el;
    const doc = el?.ownerDocument;
    if (!el || !doc) return false;

    const sel = doc.getSelection?.();
    let saved: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      try {
        saved = sel.getRangeAt(0).cloneRange();
      } catch {
        saved = null;
      }
    }

    this.focusCanvasRte(rte);

    if (!saved || !sel) return Boolean(saved);
    try {
      sel.removeAllRanges();
      sel.addRange(saved);
      return true;
    } catch {
      return false;
    }
  }

  destroy(): void {
    this.clearCanvasListeners();
    for (const off of this.unbind) off();
    this.unbind = [];
    this.listeners.clear();
    this.state = { ...IDLE_RICH_TEXT_STATE };
  }

  private runNamed(name: string, rte: RteLike): void {
    const rteMod = this.editor.RichTextEditor;
    switch (name) {
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough": {
        const action = rteMod.get(name === "strikethrough" ? "strikethrough" : name);
        if (action) {
          rteMod.run(action);
        } else {
          const cmd =
            name === "strikethrough" ? "strikeThrough" : name;
          rte.exec?.(cmd);
        }
        break;
      }
      case "link": {
        const action = rteMod.get("link");
        if (action) rteMod.run(action);
        break;
      }
      case "unlink":
        rte.exec?.("unlink");
        break;
      case "insertUnorderedList":
      case "insertOrderedList":
      case "justifyLeft":
      case "justifyCenter":
      case "justifyRight":
      case "justifyFull":
      case "removeFormat":
        rte.exec?.(name);
        break;
      case "quote":
        rte.exec?.("formatBlock", "blockquote");
        break;
      default:
        break;
    }
  }

  private focusCanvasRte(rte: RteLike): void {
    const el = rte.el;
    if (el && typeof el.focus === "function") {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }
  }

  private bindEditorEvents(): void {
    const hideFloatingToolbar = () => {
      try {
        this.editor.RichTextEditor.hideToolbar();
      } catch {
        // ignore
      }
    };

    const onEnable = (view: ComponentViewLike, _rte: unknown) => {
      // custom:true skips action buttons; still hide empty toolbar chrome after GrapesJS enable()
      hideFloatingToolbar();
      requestAnimationFrame(hideFloatingToolbar);

      const model = view?.model;
      const id = model ? String(model.getId?.() ?? model.ccid ?? "") : null;
      this.state = {
        ...IDLE_RICH_TEXT_STATE,
        active: true,
        componentId: id || null,
      };
      this.bindCanvasListeners();
      this.syncFormatFromDom();
      this.emit();
    };

    const onDisable = () => {
      this.clearCanvasListeners();
      this.state = { ...IDLE_RICH_TEXT_STATE };
      this.emit();
    };

    this.editor.on("rte:enable", onEnable);
    this.editor.on("rte:disable", onDisable);
    this.unbind.push(() => {
      this.editor.off("rte:enable", onEnable);
      this.editor.off("rte:disable", onDisable);
    });
  }

  private bindCanvasListeners(): void {
    this.clearCanvasListeners();
    const doc = this.editor.Canvas.getDocument();
    if (!doc) return;

    const sync = () => this.syncFormatFromDom();
    doc.addEventListener("mouseup", sync);
    doc.addEventListener("keyup", sync);
    doc.addEventListener("selectionchange", sync);
    this.canvasUnbind.push(() => {
      doc.removeEventListener("mouseup", sync);
      doc.removeEventListener("keyup", sync);
      doc.removeEventListener("selectionchange", sync);
    });
  }

  private clearCanvasListeners(): void {
    for (const off of this.canvasUnbind) off();
    this.canvasUnbind = [];
  }

  private syncFormatFromDom(): void {
    if (!this.state.active) return;
    const doc = this.editor.Canvas.getDocument();
    if (!doc) return;

    const anchor = selectionAnchorElement(doc);
    const next: RichTextFormatState = {
      active: true,
      componentId: this.state.componentId,
      bold: queryState(doc, "bold"),
      italic: queryState(doc, "italic"),
      underline: queryState(doc, "underline"),
      strike: queryState(doc, "strikeThrough"),
      blockType: detectBlockType(anchor),
      alignment: detectAlign(anchor, doc),
      orderedList: queryState(doc, "insertOrderedList"),
      unorderedList: queryState(doc, "insertUnorderedList"),
      linkActive: Boolean(anchor?.closest?.("a")),
    };

    const changed = JSON.stringify(next) !== JSON.stringify(this.state);
    this.state = next;
    if (changed) this.emit();
  }

  private emit(): void {
    const snapshot = this.state;
    for (const fn of this.listeners) fn(snapshot);
  }
}

export function attachRichTextController(editor: Editor): RichTextController {
  const existing = getRichTextController(editor);
  if (existing) return existing;
  const ctrl = new RichTextController(editor);
  asRecord(editor)[CONTROLLER_KEY] = ctrl;
  editor.on("destroy", () => {
    ctrl.destroy();
    delete asRecord(editor)[CONTROLLER_KEY];
  });
  return ctrl;
}

export function getRichTextController(
  editor: Editor | null | undefined,
): RichTextController | null {
  if (!editor) return null;
  const ctrl = asRecord(editor)[CONTROLLER_KEY];
  return ctrl instanceof RichTextController ? ctrl : null;
}
