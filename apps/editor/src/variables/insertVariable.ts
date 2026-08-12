/**
 * Insert Brevo params as clickable email-param badges at the caret.
 * Location: apps/editor/src/variables/insertVariable.ts
 */

import type { Editor } from "@email-template/editor-core";
import {
  buildEmailParamComponent,
  forceEnableTextRte,
} from "@email-template/email-components";
import type { Component } from "grapesjs";

const HOST_TYPES = new Set([
  "email-text",
  "email-heading",
  "email-button",
]);

type Comp = {
  get: (k: string) => unknown;
  getId?: () => string;
  set?: (k: string, v: unknown) => void;
  parent: () => Comp | undefined;
  append: (c: unknown, opts?: { at?: number }) => unknown;
  replaceWith: (c: unknown) => unknown;
  components?: () => {
    models?: Comp[];
    add?: (c: unknown, opts?: { at?: number }) => unknown;
  };
  index?: () => number;
  remove?: () => void;
  getEl?: () => HTMLElement | undefined;
  getView?: () => {
    el?: HTMLElement;
    disableEditing?: () => void;
  } | undefined;
};

type CaretBookmark = { hostId: string; offset: number };

/** Survives toolbar focus steal until insert runs. */
const caretBookmarks = new WeakMap<object, CaretBookmark>();

function findHost(component: Comp): Comp | null {
  let cur: Comp | undefined = component;
  while (cur) {
    const type = String(cur.get("type") ?? "");
    if (HOST_TYPES.has(type)) return cur;
    cur = cur.parent?.();
  }
  return null;
}

function resolveHost(editor: Editor, selected: Comp | undefined): Comp | null {
  // Prefer the live RTE host — selection may be a parent while editing.
  const editing = editor.getEditing() as Comp | undefined;
  if (editing && HOST_TYPES.has(String(editing.get("type") ?? ""))) {
    return editing;
  }
  if (!selected) return null;
  const type = String(selected.get("type") ?? "");
  if (type === "email-param") return findHost(selected);
  if (HOST_TYPES.has(type)) return selected;
  return findHost(selected);
}

function hostIdOf(host: Comp): string {
  if (typeof host.getId === "function") return String(host.getId());
  return String(host.get("id") ?? "");
}

function exitRte(editor: Editor) {
  const editing = editor.getEditing() as Comp | undefined;
  if (!editing) return;
  editing.getView?.()?.disableEditing?.();
}

/** Wake text/heading host after param insert so typing continues. */
function resumeHostRte(editor: Editor, host: Comp): void {
  const type = String(host.get("type") ?? "");
  if (type !== "email-text" && type !== "email-heading") return;
  void forceEnableTextRte(editor, host as unknown as Component);
}

function hostEl(host: Comp): HTMLElement | null {
  return host.getView?.()?.el ?? host.getEl?.() ?? null;
}

/** Collapsed caret as UTF-16 offset within host textContent. */
function caretTextOffset(el: HTMLElement): number | null {
  const sel = el.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
    return null;
  }
  try {
    const pre = el.ownerDocument.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(sel.anchorNode!, sel.anchorOffset);
    return pre.toString().length;
  } catch {
    return null;
  }
}

/**
 * Call from toolbar mousedown (before focus leaves the canvas) so variable
 * insert still knows where the caret was.
 */
export function bookmarkActiveCaret(editor: Editor): void {
  const selected = editor.getSelected() as Comp | undefined;
  const host = resolveHost(editor, selected);
  if (!host) return;
  const el = hostEl(host);
  if (!el) return;
  const offset = caretTextOffset(el);
  if (offset == null) return;
  const id = hostIdOf(host);
  if (!id) return;
  caretBookmarks.set(editor, { hostId: id, offset });
}

/**
 * Keep caret bookmark updated while the user types/moves in the canvas iframe,
 * so toolbar clicks that clear the live Selection still insert at the last caret.
 */
export function installCaretBookmarkTracking(editor: Editor): () => void {
  const docs = new WeakSet<Document>();
  const detachers: Array<() => void> = [];
  let retryTimer: ReturnType<typeof setInterval> | undefined;

  const bindDoc = (doc: Document | null | undefined) => {
    if (!doc || docs.has(doc)) return;
    docs.add(doc);
    const onSel = () => bookmarkActiveCaret(editor);
    doc.addEventListener("selectionchange", onSel);
    // keyup: selectionchange can be flaky across iframe focus edges
    doc.addEventListener("keyup", onSel, true);
    detachers.push(() => {
      doc.removeEventListener("selectionchange", onSel);
      doc.removeEventListener("keyup", onSel, true);
    });
  };

  const rebind = () => {
    const canvas = editor.Canvas as
      | {
          getDocument?: () => Document | undefined;
          getFrameEl?: () => HTMLIFrameElement | undefined;
        }
      | undefined;
    bindDoc(canvas?.getDocument?.() ?? null);
    bindDoc(canvas?.getFrameEl?.()?.contentDocument ?? null);
  };

  rebind();
  editor.on("canvas:frame:load", rebind);
  editor.on("canvas:frame:load:body", rebind);
  editor.on("load", rebind);

  // Frame often appears after toolbar mounts — retry briefly (same pattern as clickToEdit)
  let tries = 0;
  retryTimer = setInterval(() => {
    rebind();
    tries += 1;
    if (tries >= 25) {
      clearInterval(retryTimer);
      retryTimer = undefined;
    }
  }, 100);

  if (import.meta.env.DEV) {
    (
      window as Window & {
        __etsBookmarkCaret?: () => void;
        __etsInsertVariable?: (input: InsertVariableInput) => boolean;
      }
    ).__etsBookmarkCaret = () => bookmarkActiveCaret(editor);
    (
      window as Window & {
        __etsInsertVariable?: (input: InsertVariableInput) => boolean;
      }
    ).__etsInsertVariable = (input) => insertVariableExpression(editor, input);
  }

  return () => {
    if (retryTimer) clearInterval(retryTimer);
    editor.off("canvas:frame:load", rebind);
    editor.off("canvas:frame:load:body", rebind);
    editor.off("load", rebind);
    for (const d of detachers) d();
    if (import.meta.env.DEV) {
      delete (window as Window & { __etsBookmarkCaret?: () => void })
        .__etsBookmarkCaret;
      delete (
        window as Window & {
          __etsInsertVariable?: (input: InsertVariableInput) => boolean;
        }
      ).__etsInsertVariable;
    }
  };
}

function childModels(host: Comp): Comp[] {
  const col = host.components?.();
  if (!col) return [];
  if (Array.isArray(col.models)) return [...col.models];
  return [];
}

function childPlainLength(child: Comp): number {
  const el = child.getEl?.();
  if (el?.textContent != null) return el.textContent.length;
  return String(child.get("content") ?? "").length;
}

/**
 * Insert badge at a text offset inside the host component tree.
 * Splits a textnode when the caret lands in the middle.
 */
function insertBadgeAtOffset(
  host: Comp,
  badge: unknown,
  offset: number,
): void {
  const kids = childModels(host);
  if (kids.length === 0) {
    // Grapes often keeps plain copy on the host (`content` / DOM) with an
    // empty components collection — replace that string atomically.
    const text = String(hostEl(host)?.textContent ?? host.get("content") ?? "");
    const at = Math.max(0, Math.min(offset, text.length));
    const before = text.slice(0, at);
    const after = text.slice(at);
    const parts: unknown[] = [];
    if (before) parts.push({ type: "textnode", content: before });
    parts.push(badge);
    if (after) parts.push({ type: "textnode", content: after });

    if (typeof host.set === "function") {
      host.set("content", "");
    }
    const col = host.components?.() as
      | { reset?: (models?: unknown) => void }
      | undefined;
    if (col && typeof col.reset === "function") {
      col.reset(parts);
      return;
    }
    for (const part of parts) {
      host.append(part);
    }
    return;
  }

  let remaining = Math.max(0, offset);
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i]!;
    const type = String(child.get("type") ?? "");
    const len = childPlainLength(child);

    if (remaining <= 0) {
      host.append(badge, { at: i });
      return;
    }

    if (remaining < len && (type === "textnode" || type === "text" || !type)) {
      const text = String(
        child.getEl?.()?.textContent ?? child.get("content") ?? "",
      );
      const before = text.slice(0, remaining);
      const after = text.slice(remaining);
      if (typeof child.set === "function") {
        child.set("content", before);
      }
      host.append(badge, { at: i + 1 });
      if (after) {
        host.append({ type: "textnode", content: after }, { at: i + 2 });
      }
      return;
    }

    remaining -= len;
  }

  host.append(badge);
}

export interface InsertVariableInput {
  key: string;
  label: string;
  expression: string;
}

function parseInput(
  expressionOrVar: string | InsertVariableInput,
  labelMaybe?: string,
): InsertVariableInput {
  if (typeof expressionOrVar !== "string") return expressionOrVar;
  const m = /^\{\{\s*params\.(\w+)\s*\}\}$/.exec(expressionOrVar.trim());
  const key = m?.[1] ?? expressionOrVar.trim();
  return {
    key,
    label: labelMaybe ?? key,
    expression: expressionOrVar,
  };
}

/**
 * Inserts (or replaces) a param badge at the live caret on the selected host.
 * @returns false when nothing suitable is selected
 */
export function insertVariableExpression(
  editor: Editor,
  expressionOrVar: string | InsertVariableInput,
  labelMaybe?: string,
): boolean {
  const input = parseInput(expressionOrVar, labelMaybe);
  const badge = buildEmailParamComponent(input.key, input.label);
  if (!badge.attributes["data-param-key"]) return false;

  const selected = editor.getSelected() as Comp | undefined;
  if (!selected) return false;

  const type = String(selected.get("type") ?? "");
  const hostPreview = resolveHost(editor, selected);

  // Prefer live caret only while the canvas still owns focus. After toolbar
  // clicks the browser often reports a collapsed caret at 0 — use bookmark.
  let caret: number | null = null;
  if (import.meta.env.DEV) {
    const forced = (
      window as Window & { __etsForcedCaretOffset?: number }
    ).__etsForcedCaretOffset;
    if (typeof forced === "number" && Number.isFinite(forced)) {
      caret = forced;
      delete (window as Window & { __etsForcedCaretOffset?: number })
        .__etsForcedCaretOffset;
    }
  }
  if (caret == null && hostPreview) {
    const el = hostEl(hostPreview);
    const book = caretBookmarks.get(editor);
    const bookOk =
      book != null && book.hostId === hostIdOf(hostPreview) ? book : null;
    const live = el ? caretTextOffset(el) : null;
    const canvasFocused = Boolean(
      el &&
        el.ownerDocument.activeElement &&
        el.contains(el.ownerDocument.activeElement),
    );
    if (live != null && canvasFocused) {
      caret = live;
    } else if (bookOk) {
      caret = bookOk.offset;
    } else if (live != null) {
      caret = live;
    }
  }

  exitRte(editor);

  if (type === "email-param") {
    const host = findHost(selected);
    selected.replaceWith(badge);
    if (host) resumeHostRte(editor, host);
    caretBookmarks.delete(editor);
    return true;
  }

  const host = HOST_TYPES.has(type) ? selected : findHost(selected);
  if (!host) return false;

  if (caret != null) {
    insertBadgeAtOffset(host, badge, caret);
  } else {
    host.append(badge);
  }
  resumeHostRte(editor, host);
  caretBookmarks.delete(editor);
  return true;
}
