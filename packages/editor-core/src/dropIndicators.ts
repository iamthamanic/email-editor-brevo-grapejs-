/**
 * Professional drag/drop placement cues for the email canvas.
 * Marks placeholder placement (before / after / inside) and source-sized box vars.
 * Location: packages/editor-core/src/dropIndicators.ts
 */

import type { Editor } from "grapesjs";

type SorterDragPayload = {
  pos?: {
    placement?: string;
  };
  sourceModel?: {
    getEl?: () => HTMLElement | undefined;
  };
  target?: unknown;
  targetModel?: {
    getEl?: () => HTMLElement | undefined;
    parent?: () => unknown;
  };
  parent?: unknown;
};

/** CSS custom properties written onto the Grapes placeholder element. */
export const ETS_DROP_W = "--ets-drop-w";
export const ETS_DROP_H = "--ets-drop-h";

/** em key set by host palette drag (`startEditorDrag`). */
export const ETS_DROP_HEIGHT_HINT_KEY = "etsDropHeightHint";

/**
 * Fallback when the drag source is palette chrome (tiny button) or unmeasurable.
 * Matches idle empty-slot min-height for a consistent cue.
 */
export const FALLBACK_DROP_H_PX = 112;

/** Soft cap — only huge sections are limited so the cue stays usable. */
export const MAX_DROP_H_PX = 900;
export const MIN_DROP_H_PX = 48;

/** Heights at/below this are treated as toolbar/palette chrome, not content. */
export const TOOLBAR_SOURCE_MAX_H_PX = 56;

export type DropSourceSize = { width: number; height: number };

type Measurable = {
  getBoundingClientRect?: () => DOMRect;
  getEl?: () => unknown;
  element?: unknown;
  view?: { el?: unknown };
};

type EditorEm = {
  get?: (key: string) => unknown;
};

function isMeasurableEl(value: unknown): value is HTMLElement {
  if (!value || typeof value !== "object") return false;
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) {
    return true;
  }
  // Duck-type for Node tests / iframes without shared HTMLElement realm.
  const v = value as { nodeType?: unknown; getBoundingClientRect?: unknown };
  return (
    v.nodeType === 1 && typeof v.getBoundingClientRect === "function"
  );
}

/**
 * Clamp measured height for drop-box CSS (width stays fluid via 100%).
 * Tiny toolbar sources → content-like fallback; huge sources → soft max.
 */
export function clampDropHeight(height: number): number {
  if (!Number.isFinite(height) || height <= 0) return FALLBACK_DROP_H_PX;
  if (height <= TOOLBAR_SOURCE_MAX_H_PX) return FALLBACK_DROP_H_PX;
  return Math.min(MAX_DROP_H_PX, Math.max(MIN_DROP_H_PX, Math.round(height)));
}

/**
 * Final placeholder height: source hint clamped to global bounds and target slot.
 */
export function resolveDropHeight(
  sourceH: number,
  targetMaxH: number | null,
): number {
  const base = clampDropHeight(sourceH);
  if (targetMaxH == null || !(targetMaxH > 0)) return base;
  return Math.max(MIN_DROP_H_PX, Math.min(base, Math.round(targetMaxH)));
}

/**
 * Resolve a DOM element from Grapes `sorter:drag:start` args / models.
 */
export function resolveSourceElement(
  primary: unknown,
  secondary?: unknown,
): HTMLElement | null {
  const tryOne = (value: unknown): HTMLElement | null => {
    if (!value || typeof value !== "object") return null;
    if (isMeasurableEl(value)) return value;
    const m = value as Measurable;
    if (isMeasurableEl(m.element)) return m.element;
    if (typeof m.getEl === "function") {
      const el = m.getEl();
      if (isMeasurableEl(el)) return el;
    }
    if (isMeasurableEl(m.view?.el)) return m.view.el;
    return null;
  };
  return tryOne(primary) ?? tryOne(secondary);
}

/**
 * Measure drag-source box; returns null when nothing measurable.
 */
export function measureDropSourceSize(
  primary: unknown,
  secondary?: unknown,
): DropSourceSize | null {
  const el = resolveSourceElement(primary, secondary);
  if (!el || typeof el.getBoundingClientRect !== "function") return null;
  const rect = el.getBoundingClientRect();
  if (!(rect.width > 0 && rect.height > 0)) return null;
  return { width: rect.width, height: rect.height };
}

/** Measure drop target column/slot height during sorter drag. */
export function measureTargetHeight(payload?: SorterDragPayload): number | null {
  if (!payload) return null;
  const placement = String(payload.pos?.placement ?? "").toLowerCase();

  const measureEl = (el: HTMLElement | null): number | null => {
    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const rect = el.getBoundingClientRect();
    if (!(rect.height > 0)) return null;
    return Math.round(rect.height);
  };

  if (placement === "inside") {
    const slot =
      resolveSourceElement(payload.target) ??
      resolveSourceElement(payload.targetModel);
    return measureEl(slot);
  }

  const targetEl =
    resolveSourceElement(payload.target) ??
    resolveSourceElement(payload.targetModel);
  if (targetEl && typeof targetEl.closest === "function") {
    const col = targetEl.closest(
      '[data-email-type="email-column"]',
    ) as HTMLElement | null;
    const fromCol = measureEl(col);
    if (fromCol != null) return fromCol;
  }

  const parentModel = payload.targetModel?.parent?.();
  const fromParentModel = measureEl(resolveSourceElement(parentModel));
  if (fromParentModel != null) return fromParentModel;

  return measureEl(resolveSourceElement(payload.parent));
}

function readHeightHint(editor: Editor): number | null {
  const em = (editor as unknown as { em?: EditorEm }).em;
  const raw = em?.get?.(ETS_DROP_HEIGHT_HINT_KEY);
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function placeholderEl(editor: Editor): HTMLElement | null {
  const root =
    typeof editor.Canvas.getElement === "function"
      ? editor.Canvas.getElement()
      : null;
  if (!root) return null;
  return root.querySelector(
    ".gjs-placeholder, .gjs-com-placeholder",
  ) as HTMLElement | null;
}

function clearSizeVars(el: HTMLElement): void {
  el.style.removeProperty(ETS_DROP_W);
  el.style.removeProperty(ETS_DROP_H);
}

function applySizeVars(
  el: HTMLElement,
  size: DropSourceSize | null,
  targetMaxH: number | null,
): void {
  if (!size) {
    const h = resolveDropHeight(FALLBACK_DROP_H_PX, targetMaxH);
    el.style.setProperty(ETS_DROP_H, `${h}px`);
    el.style.removeProperty(ETS_DROP_W);
    return;
  }
  const h = resolveDropHeight(size.height, targetMaxH);
  el.style.setProperty(ETS_DROP_H, `${h}px`);
  // Width stays 100% of the track; keep measured width for optional CSS.
  if (size.width > 0) {
    el.style.setProperty(ETS_DROP_W, `${Math.round(size.width)}px`);
  }
}

/**
 * Sync GrapesJS sorter placement onto the placeholder so CSS can show
 * a source-sized insert box (before / after) or an inside-slot panel.
 */
export function wireDropIndicators(editor: Editor): void {
  let lastSize: DropSourceSize | null = null;

  const resolveSize = (
    primary?: unknown,
    secondary?: unknown,
  ): DropSourceSize | null => {
    const hint = readHeightHint(editor);
    if (hint != null) {
      return { width: 600, height: hint };
    }
    const measured = measureDropSourceSize(primary, secondary);
    if (!measured) return null;
    // Palette chrome without hint → content-like fallback height
    if (measured.height <= TOOLBAR_SOURCE_MAX_H_PX) {
      return { width: measured.width, height: FALLBACK_DROP_H_PX };
    }
    return measured;
  };

  const onDragStart = (primary?: unknown, secondary?: unknown) => {
    lastSize = resolveSize(primary, secondary);
    const el = placeholderEl(editor);
    if (el) {
      applySizeVars(el, lastSize, null);
      // Host palette drag: show box immediately (placement comes on first move)
      if (readHeightHint(editor) != null) {
        el.dataset.etsPlacement = "inside";
      }
    }
  };

  const sync = (payload?: SorterDragPayload) => {
    const el = placeholderEl(editor);
    if (!el) return;

    if (!lastSize) {
      lastSize = resolveSize(payload?.sourceModel);
    } else if (!readHeightHint(editor) && payload?.sourceModel) {
      const again = measureDropSourceSize(payload.sourceModel);
      if (again && again.height > TOOLBAR_SOURCE_MAX_H_PX) lastSize = again;
    }

    const targetMaxH = measureTargetHeight(payload);
    applySizeVars(el, lastSize, targetMaxH);

    const placement = String(payload?.pos?.placement ?? "").toLowerCase();
    if (
      placement === "before" ||
      placement === "after" ||
      placement === "inside"
    ) {
      el.dataset.etsPlacement = placement;
    } else {
      delete el.dataset.etsPlacement;
    }
  };

  const onDragEnd = () => {
    const el = placeholderEl(editor);
    if (el) {
      delete el.dataset.etsPlacement;
      clearSizeVars(el);
    }
    lastSize = null;
  };

  editor.on("sorter:drag:start", onDragStart);
  editor.on("sorter:drag", sync);
  editor.on("sorter:drag:end", onDragEnd);
  editor.on("destroy", () => {
    editor.off("sorter:drag:start", onDragStart);
    editor.off("sorter:drag", sync);
    editor.off("sorter:drag:end", onDragEnd);
  });
}
