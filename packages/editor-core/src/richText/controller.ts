/**
 * Bridges global toolbar ↔ GrapesJS RichTextEditor (single editing context).
 * Location: packages/editor-core/src/richText/controller.ts
 */

import {
  escapeHtml,
  isAllowedLinkUrl,
  sanitizeLinkUrl,
  sanitizePastedEmailHtml,
  toPlainText,
} from "@email-template/email-components";
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

function detectFontSizePx(el: Element | null): number {
  if (!el) return 0;
  const raw = getComputedStyle(el).fontSize || "";
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/**
 * Prompt for link URL with selection preserved across window.prompt focus loss.
 * GrapesJS default "link" only inserts empty href=""; custom rte.add() at boot
 * is a no-op because globalRte does not exist yet.
 */
function applyLink(rte: RteLike): void {
  const el = rte.el;
  const doc = el?.ownerDocument;
  if (!el || !doc) return;

  const sel = doc.getSelection?.();
  let saved: Range | null = null;
  if (sel && sel.rangeCount > 0) {
    try {
      saved = sel.getRangeAt(0).cloneRange();
    } catch {
      saved = null;
    }
  }

  const probeNode = saved
    ? saved.commonAncestorContainer
    : sel?.anchorNode ?? null;
  const probeEl =
    probeNode?.nodeType === Node.ELEMENT_NODE
      ? (probeNode as Element)
      : probeNode?.parentElement ?? null;
  const existingA = probeEl?.closest?.("a") ?? null;
  const currentHref = existingA?.getAttribute("href") ?? "https://";

  const input = window.prompt(
    existingA
      ? "Link-URL bearbeiten (leer = Link entfernen)"
      : "Link-URL (https, mailto, tel)",
    currentHref,
  );
  if (input == null) return;
  const trimmed = input.trim();

  // prompt steals focus — put caret back before mutate
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  if (saved && sel) {
    try {
      sel.removeAllRanges();
      sel.addRange(saved);
    } catch {
      // ignore
    }
  }

  if (!trimmed) {
    if (existingA) rte.exec?.("unlink");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (!isAllowedLinkUrl(trimmed)) {
    window.alert(
      "Ungültige URL. Erlaubt sind nur http, https, mailto und tel.",
    );
    return;
  }
  const href = sanitizeLinkUrl(trimmed);

  if (existingA) {
    existingA.setAttribute("href", href);
    existingA.setAttribute("target", "_blank");
    existingA.setAttribute("rel", "noopener noreferrer");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const selectedText =
    saved && !saved.collapsed
      ? saved.toString().trim()
      : sel && typeof sel.toString === "function"
        ? sel.toString().trim()
        : "";
  const label = escapeHtml(toPlainText(selectedText || "Link", "Link"));
  const html = `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  if (typeof rte.insertHTML === "function") {
    rte.insertHTML(html);
  } else if (sel && sel.rangeCount > 0) {
    try {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const wrap = doc.createElement("div");
      wrap.innerHTML = html;
      const frag = doc.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      range.insertNode(frag);
    } catch {
      // ignore
    }
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Apply px font-size via <span style="font-size:…"> — email-safe (no <font size>).
 */
function applyFontSizePx(rte: RteLike, sizePx: number): void {
  const el = rte.el;
  const doc = el?.ownerDocument;
  if (!el || !doc || !Number.isFinite(sizePx) || sizePx <= 0) return;

  const sel = doc.getSelection?.();
  if (!sel || sel.rangeCount === 0) return;
  let range: Range;
  try {
    range = sel.getRangeAt(0);
  } catch {
    return;
  }

  const span = doc.createElement("span");
  span.style.fontSize = `${Math.round(sizePx)}px`;

  if (range.collapsed) {
    span.appendChild(doc.createTextNode("\u200b"));
    range.insertNode(span);
    const next = doc.createRange();
    next.setStart(span.firstChild ?? span, span.firstChild ? 1 : 0);
    next.collapse(true);
    sel.removeAllRanges();
    sel.addRange(next);
  } else {
    try {
      range.surroundContents(span);
    } catch {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    try {
      const next = doc.createRange();
      next.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(next);
    } catch {
      // ignore selection restore failures
    }
  }

  // Nudge GrapesJS RTE / component sync
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Highlight / marker color (Chrome: backColor, Firefox: hiliteColor). */
function applyHiliteColor(rte: RteLike, color: string): void {
  const el = rte.el;
  const doc = el?.ownerDocument;
  if (!doc) return;

  if (color === "transparent") {
    scrubBackgroundFromSelection(rte);
    try {
      rte.exec?.("hiliteColor", "transparent");
    } catch {
      try {
        rte.exec?.("backColor", "transparent");
      } catch {
        // ignore
      }
    }
    el?.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  try {
    if (doc.queryCommandSupported?.("hiliteColor")) {
      rte.exec?.("hiliteColor", color);
      el?.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
  } catch {
    // fall through
  }
  try {
    rte.exec?.("backColor", color);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
  } catch {
    // ignore
  }
}

/** removeFormat often leaves background-color — scrub selection containers. */
function scrubBackgroundFromSelection(rte: RteLike): void {
  const el = rte.el;
  const doc = el?.ownerDocument;
  if (!el || !doc) return;
  const sel = doc.getSelection?.();
  if (!sel || sel.rangeCount === 0) return;
  let range: Range;
  try {
    range = sel.getRangeAt(0);
  } catch {
    return;
  }
  const root =
    range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (!root || !el.contains(root)) return;

  const nodes: Element[] = [];
  if (root instanceof HTMLElement) nodes.push(root);
  root.querySelectorAll?.("*").forEach((n) => nodes.push(n));

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    try {
      if (!range.intersectsNode(node)) continue;
    } catch {
      continue;
    }
    node.style.removeProperty("background");
    node.style.removeProperty("background-color");
    node.style.removeProperty("background-image");
    if (node.hasAttribute("bgcolor")) node.removeAttribute("bgcolor");
    if (!node.getAttribute("style")?.trim()) node.removeAttribute("style");
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
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
    const rte = this.resolveActiveRte();
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
    } else if (arg.type === "hiliteColor") {
      applyHiliteColor(rte, arg.color);
    } else if (arg.type === "fontSize") {
      applyFontSizePx(rte, arg.sizePx);
    }

    this.syncFormatFromDom();
  }

  /**
   * Resolve a usable exec surface for the live editing host.
   *
   * With setCustomRte, Grapes may still keep a stale `globalRte` whose `el` is
   * not contentEditable — preferring that makes bold/heading no-ops. Prefer
   * `view.activeRte` (returned from our enable()) or the live host element.
   */
  private resolveActiveRte(): RteLike | null {
    const rteMod = this.editor.RichTextEditor as {
      globalRte?: RteLike;
      customRte?: unknown;
    };

    const editing = this.editor.getEditing?.() as Component | undefined;
    const view = editing?.getView?.() as
      | {
          el?: HTMLElement;
          activeRte?: RteLike;
          getChildrenContainer?: () => HTMLElement;
        }
      | undefined;

    const active = view?.activeRte;
    if (
      active?.exec &&
      active.el &&
      (active.el.isContentEditable || active.el.contentEditable === "true")
    ) {
      return active;
    }

    const el =
      view?.el ??
      view?.getChildrenContainer?.() ??
      editing?.getEl?.() ??
      null;
    if (el && (el.isContentEditable || el.contentEditable === "true")) {
      return {
        el,
        exec: (cmd: string, value?: string) => {
          try {
            el.ownerDocument.execCommand(cmd, false, value);
          } catch {
            // ignore
          }
        },
        insertHTML: (html: string) => {
          try {
            el.ownerDocument.execCommand("insertHTML", false, html);
          } catch {
            // ignore
          }
        },
        selection: () => el.ownerDocument.getSelection(),
      };
    }

    // Built-in Grapes RTE only (no setCustomRte)
    const global = rteMod.globalRte;
    if (!rteMod.customRte && global?.exec && global.el) return global;

    return null;
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
    switch (name) {
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough": {
        // Prefer document.execCommand via our RTE surface (works with setCustomRte).
        const cmd = name === "strikethrough" ? "strikeThrough" : name;
        rte.exec?.(cmd);
        break;
      }
      case "link":
        applyLink(rte);
        break;
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
        if (name === "removeFormat") scrubBackgroundFromSelection(rte);
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
      this.bindPasteScrubber(view?.el);
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

  /** Intercept paste so chat/Word backgrounds never land in the email body. */
  private bindPasteScrubber(el: HTMLElement | undefined): void {
    if (!el) return;
    const onPaste = (ev: ClipboardEvent) => {
      const data = ev.clipboardData;
      if (!data) return;
      const html = data.getData("text/html");
      const plain = data.getData("text/plain");
      if (!html && !plain) return;

      ev.preventDefault();
      ev.stopPropagation();

      const doc = el.ownerDocument;
      if (html) {
        const clean = sanitizePastedEmailHtml(html);
        const ok =
          typeof doc.execCommand === "function" &&
          doc.execCommand("insertHTML", false, clean);
        if (!ok) {
          // Fallback: plain text only
          doc.execCommand("insertText", false, plain || "");
        }
        return;
      }
      doc.execCommand("insertText", false, plain);
    };
    el.addEventListener("paste", onPaste, true);
    this.canvasUnbind.push(() => {
      el.removeEventListener("paste", onPaste, true);
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
      fontSize: detectFontSizePx(anchor),
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
