/**
 * Resolve content-column targets and GrapesJS host→canvas drag (dragSource).
 * Location: apps/editor/src/templates/canvasInsert.ts
 */

import type { Editor } from "@email-template/editor-core";
import { ensureContentCanvas } from "@email-template/email-components";
import type { Component, ComponentDefinition } from "grapesjs";

const CONTENT_LEAF_TYPES = new Set([
  "email-text",
  "email-heading",
  "email-image",
  "email-button",
  "email-divider",
  "email-spacer",
  "email-legacy-html",
  "email-param",
  "text",
  "link",
]);

/** Expected insert-box height (px) when dragging from tiny palette chrome. */
export const BLOCK_DROP_HEIGHT_HINT: Record<string, number> = {
  "email-text": 80,
  "email-heading": 56,
  "email-image": 200,
  "email-button": 56,
  "email-divider": 24,
  "email-spacer": 40,
  "email-columns-1": 128,
  "email-columns-2": 128,
  "email-columns-3": 128,
  "email-layout-row": 128,
  "email-legacy-html": 96,
};

export const ETS_DROP_HEIGHT_HINT_KEY = "etsDropHeightHint";

export type EditorDragKind = "section" | "leaf";

type EditorEm = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

type FrameDroppable = {
  startCustom?: () => void;
  endCustom?: (cancel?: boolean) => void;
};

type FrameWithDroppable = {
  view?: { droppable?: FrameDroppable };
};

function editorEm(editor: Editor): EditorEm | null {
  const em = (editor as unknown as { em?: EditorEm }).em;
  return em ?? null;
}

function eachFrameDroppable(
  editor: Editor,
  fn: (droppable: FrameDroppable) => void,
): void {
  const frames =
    (typeof editor.Canvas.getFrames === "function"
      ? editor.Canvas.getFrames()
      : []) ?? [];
  for (const frame of frames as FrameWithDroppable[]) {
    const droppable = frame.view?.droppable;
    if (droppable) fn(droppable);
  }
}

function sectionRole(comp: Component): string {
  return String(
    comp.get("sectionRole") ??
      comp.getAttributes()?.["data-section-role"] ??
      comp.getAttributes()?.["data-role"] ??
      "",
  );
}

function setDragKindAttr(editor: Editor, kind: EditorDragKind | null): void {
  const apply = (doc: Document | null | undefined) => {
    if (!doc?.documentElement) return;
    if (kind) doc.documentElement.dataset.etsDrag = kind;
    else delete doc.documentElement.dataset.etsDrag;
  };
  apply(document);
  const canvasDoc =
    typeof editor.Canvas.getDocument === "function"
      ? editor.Canvas.getDocument()
      : null;
  apply(canvasDoc);
}

/** HTML5 palette drag does not always emit pointerenter on the iframe — bridge dragover. */
let hostDragBridgeCleanup: (() => void) | null = null;

function disarmHostDragBridge(): void {
  hostDragBridgeCleanup?.();
  hostDragBridgeCleanup = null;
}

/**
 * Host→iframe mid-drag cue. Grapes ComponentSorter has no sorter.onMove; Droppable's
 * customTarget path often never calls placeholder.show() for palette drags. Position the
 * canvas placer ourselves over the column under the pointer (iframe-local hit-test).
 * Returns true when a column cue was applied.
 */
function showHostDropCue(
  editor: Editor,
  frame: HTMLIFrameElement,
  localX: number,
  localY: number,
): boolean {
  const doc = frame.contentDocument;
  const placer =
    typeof editor.Canvas.getPlacerEl === "function"
      ? (editor.Canvas.getPlacerEl() as HTMLElement | null)
      : null;
  const canvasEl =
    typeof editor.Canvas.getElement === "function"
      ? (editor.Canvas.getElement() as HTMLElement | null)
      : null;
  if (!doc || !placer || !canvasEl) return false;

  const hit = doc.elementFromPoint(localX, localY);
  const colEl = hit?.closest?.(
    '[data-email-type="email-column"]',
  ) as HTMLElement | null;
  // Miss (highlighter/ghost covering the slot): keep the previous cue — do not hide.
  if (!colEl || isProtectedChromeColumn(colEl)) return false;

  const canvasRect = canvasEl.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const colRect = colEl.getBoundingClientRect();
  const top = frameRect.top - canvasRect.top + colRect.top;
  const left = frameRect.left - canvasRect.left + colRect.left;
  const hint = editorEm(editor)?.get(ETS_DROP_HEIGHT_HINT_KEY);
  const dropH =
    typeof hint === "number" && hint > 0
      ? Math.min(hint, Math.max(colRect.height, 48))
      : Math.max(colRect.height, 48);

  placer.style.display = "block";
  placer.style.top = `${top}px`;
  placer.style.left = `${left}px`;
  placer.style.width = `${colRect.width}px`;
  placer.style.height = `${dropH}px`;
  placer.style.setProperty("--ets-drop-h", `${dropH}px`);
  placer.dataset.etsPlacement = "inside";
  placer.classList.add("horizontal");
  placer.classList.remove("vertical");
  return true;
}

function isProtectedChromeColumn(colEl: HTMLElement): boolean {
  const section = colEl.closest(
    '[data-email-type="email-section"]',
  ) as HTMLElement | null;
  const role = String(
    section?.getAttribute("data-role") ??
      section?.getAttribute("data-section-role") ??
      "",
  );
  return role === "header" || role === "footer" || role === "social";
}

function hideHostDropCue(editor: Editor): void {
  const placer =
    typeof editor.Canvas.getPlacerEl === "function"
      ? (editor.Canvas.getPlacerEl() as HTMLElement | null)
      : null;
  if (!placer) return;
  placer.style.display = "none";
  delete placer.dataset.etsPlacement;
  placer.style.removeProperty("--ets-drop-h");
}

function armHostDragBridge(editor: Editor): void {
  disarmHostDragBridge();
  const frame =
    typeof editor.Canvas.getFrameEl === "function"
      ? editor.Canvas.getFrameEl()
      : null;
  if (!frame) return;

  let entered = false;
  let lastLocal: { x: number; y: number } | null = null;
  let cueRaf = 0;

  const stopCuePulse = () => {
    if (cueRaf) cancelAnimationFrame(cueRaf);
    cueRaf = 0;
    lastLocal = null;
  };

  const pulseCue = () => {
    if (lastLocal) {
      const applied = showHostDropCue(
        editor,
        frame,
        lastLocal.x,
        lastLocal.y,
      );
      // Grapes may call placeholder.hide() between frames — re-assert visibility
      // when we already positioned a cue earlier in this drag.
      if (!applied) {
        const placer =
          typeof editor.Canvas.getPlacerEl === "function"
            ? (editor.Canvas.getPlacerEl() as HTMLElement | null)
            : null;
        if (placer?.style.top) {
          placer.style.display = "block";
          placer.dataset.etsPlacement = "inside";
        }
      }
    }
    if (entered) {
      cueRaf = requestAnimationFrame(pulseCue);
    } else {
      cueRaf = 0;
    }
  };

  const toFrameLocal = (clientX: number, clientY: number) => {
    const rect = frame.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      inside:
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom,
    };
  };

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";

    const local = toFrameLocal(ev.clientX, ev.clientY);
    if (!local.inside) {
      stopCuePulse();
      hideHostDropCue(editor);
      return;
    }

    // Arm Grapes Droppable (actual drop / dragResult) via pointerenter on frameEl.
    if (!entered) {
      entered = true;
      frame.dispatchEvent(
        new PointerEvent("pointerenter", {
          bubbles: true,
          cancelable: true,
          clientX: ev.clientX,
          clientY: ev.clientY,
          pointerId: 1,
          pointerType: "mouse",
          buttons: 1,
        }),
      );
    }

    // Keep cue visible: Grapes placeholder.hide() races us after sorter start.
    lastLocal = { x: local.x, y: local.y };
    showHostDropCue(editor, frame, local.x, local.y);
    if (!cueRaf) cueRaf = requestAnimationFrame(pulseCue);
  };

  const onDragLeave = (ev: DragEvent) => {
    // Only treat 0,0 as leave-document when we are not actively over the frame.
    if (ev.clientX !== 0 || ev.clientY !== 0) return;
    entered = false;
    stopCuePulse();
    hideHostDropCue(editor);
    frame.dispatchEvent(
      new PointerEvent("pointerout", {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
        buttons: 0,
      }),
    );
  };

  const opts = { capture: true } as const;
  window.addEventListener("dragover", onDragOver, opts);
  window.addEventListener("dragleave", onDragLeave, opts);
  window.addEventListener("drop", onDragOver, opts);

  hostDragBridgeCleanup = () => {
    entered = false;
    stopCuePulse();
    window.removeEventListener("dragover", onDragOver, opts);
    window.removeEventListener("dragleave", onDragLeave, opts);
    window.removeEventListener("drop", onDragOver, opts);
    hideHostDropCue(editor);
    frame.dispatchEvent(
      new PointerEvent("pointerout", {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
        buttons: 0,
      }),
    );
  };
}

function isProtectedChrome(comp: Component): boolean {
  let c: Component | undefined = comp;
  while (c) {
    if (String(c.get("type") ?? "") === "email-section") {
      const role = sectionRole(c);
      return role === "header" || role === "footer" || role === "social";
    }
    c = c.parent() as Component | undefined;
  }
  return false;
}

/**
 * Primary content-column of the single canvas (never header/footer/social).
 * Creates / heals the content canvas when missing or hollow.
 */
export function findContentColumnTarget(editor: Editor): Component | null {
  const selected = editor.getSelected();
  if (selected && !isProtectedChrome(selected)) {
    const type = String(selected.get("type") ?? "");
    if (type === "email-column") return selected;
    if (CONTENT_LEAF_TYPES.has(type) || type === "email-layout-row") {
      const parent = selected.parent();
      if (parent && String(parent.get("type") ?? "") === "email-column") {
        return parent;
      }
    }
    if (
      type === "email-row" ||
      type === "email-section" ||
      type === "email-layout-row"
    ) {
      const col = selected.findType("email-column")[0];
      if (col && !isProtectedChrome(col)) return col;
    }
  }

  return ensureContentCanvas(editor);
}

export { ensureContentCanvas };

export function dropHeightHintForBlockType(type: string): number | undefined {
  if (BLOCK_DROP_HEIGHT_HINT[type] != null) return BLOCK_DROP_HEIGHT_HINT[type];
  if (type.startsWith("email-columns-")) return 128;
  if (CONTENT_LEAF_TYPES.has(type)) return 80;
  return undefined;
}

/**
 * Start host→canvas drag: dragSource + Droppable.startCustom (BlockManager parity).
 */
export function startEditorDrag(
  editor: Editor,
  content: unknown,
  kind: EditorDragKind = "leaf",
  opts?: { dropHeightHint?: number },
): void {
  setDragKindAttr(editor, kind);
  const em = editorEm(editor);
  if (em && opts?.dropHeightHint != null && opts.dropHeightHint > 0) {
    em.set(ETS_DROP_HEIGHT_HINT_KEY, opts.dropHeightHint);
  } else {
    em?.set(ETS_DROP_HEIGHT_HINT_KEY, undefined);
  }
  editor.Canvas.startDrag({
    content: content as ComponentDefinition | ComponentDefinition[] | string,
  });
  // Required for host→iframe DnD — Canvas.startDrag alone does not arm this.
  eachFrameDroppable(editor, (d) => d.startCustom?.());
  armHostDragBridge(editor);
}

/** Finalize custom droppable, read dragResult, then clear dragSource. */
export function endEditorDrag(editor: Editor): unknown {
  disarmHostDragBridge();
  eachFrameDroppable(editor, (d) => d.endCustom?.(false));
  const result = editorEm(editor)?.get("dragResult");
  editor.Canvas.endDrag();
  editorEm(editor)?.set(ETS_DROP_HEIGHT_HINT_KEY, undefined);
  setDragKindAttr(editor, null);
  return result;
}

/**
 * Insert a layout/content section at the pointer, pushing neighbouring
 * sections aside (midpoint rule). Slot order is enforced afterwards.
 */
export function insertSectionAtPointer(
  editor: Editor,
  content: object,
  clientY: number,
): Component | null {
  const wrap = editor.getWrapper();
  if (!wrap) return null;

  const sections = wrap.findType("email-section");
  let at = wrap.components().length;

  for (const section of sections) {
    const el = section.getEl?.();
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (clientY < mid) {
      at = typeof section.index === "function" ? section.index() : at;
      break;
    }
    at =
      typeof section.index === "function"
        ? section.index() + 1
        : at;
  }

  const added = wrap.append(content, { at });
  const first = (Array.isArray(added) ? added[0] : added) as
    | Component
    | undefined;
  if (first) {
    editor.select(first);
    requestAnimationFrame(() => {
      first.getEl?.()?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    });
  }
  return first ?? null;
}

/** True when pointer is over the canvas frame (iframe) or outer canvas shell. */
export function isPointerOverCanvas(
  editor: Editor,
  clientX: number,
  clientY: number,
): boolean {
  const canvas = editor.Canvas;
  const frame =
    typeof canvas.getFrameEl === "function" ? canvas.getFrameEl() : null;
  const shell =
    typeof canvas.getElement === "function" ? canvas.getElement() : null;
  for (const el of [frame, shell]) {
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (
      clientX >= r.left &&
      clientX <= r.right &&
      clientY >= r.top &&
      clientY <= r.bottom
    ) {
      return true;
    }
  }
  return false;
}

/** @deprecated Use startEditorDrag / endEditorDrag */
export function setEditorDragContent(
  editor: Editor,
  content: unknown,
): void {
  if (content === undefined || content === null) {
    endEditorDrag(editor);
    return;
  }
  startEditorDrag(editor, content);
}
