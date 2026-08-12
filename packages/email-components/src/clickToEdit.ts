/**
 * Harden single-click text editing in the canvas.
 * Location: packages/email-components/src/clickToEdit.ts
 *
 * GrapesJS stamps contenteditable=false on nested components when
 * editable:false — that blocks typing even if the email-text host is
 * contenteditable=true. We keep kids non-selectable but editable for RTE,
 * strip stale contenteditable=false (except param pills), and force-focus RTE.
 *
 * Frame binding is retried: canvas:frame:load can fire before our wire runs.
 */

import type { Component, Editor } from "grapesjs";

const TEXT_HOST_TYPES = new Set(["email-text", "email-heading"]);

type ComponentViewLike = {
  el?: HTMLElement;
  model?: Component;
  rteEnabled?: boolean;
  onActive?: (ev?: Event) => void | Promise<void>;
  disableEditing?: () => void | Promise<void>;
  canActivate?: () => { result: boolean; delegate?: Component };
};

function sectionRoleOf(comp: Component): string {
  return String(
    comp.get("sectionRole") ??
      comp.getAttributes()?.["data-section-role"] ??
      comp.getAttributes()?.["data-role"] ??
      "",
  );
}

/** True when the component lives under locked header/footer/social chrome. */
export function isInsideLockedChrome(comp: Component): boolean {
  let cur: Component | undefined = comp;
  for (let i = 0; i < 12 && cur; i += 1) {
    if (String(cur.get("type") ?? "") === "email-section") {
      const role = sectionRoleOf(cur);
      return role === "header" || role === "footer" || role === "social";
    }
    cur = cur.parent() as Component | undefined;
  }
  return false;
}

/**
 * Nested markup must stay selectable:false so clicks hit the RTE host —
 * but must NOT be editable:false (that stamps contenteditable=false and
 * makes typing impossible inside the host).
 */
export function lockNestedTextChrome(child: Component): void {
  const type = String(child.get("type") ?? "");
  if (type === "email-param") return;
  child.set({
    editable: true,
    textable: true,
    selectable: false,
    hoverable: false,
    highlightable: false,
    layerable: false,
    draggable: false,
    copyable: false,
  });
}

function lockAllNested(host: Component): void {
  const walk = (parent: Component) => {
    const col = parent.components() as {
      forEach?: (cb: (c: Component) => void) => void;
      models?: Component[];
    };
    const kids: Component[] = Array.isArray(col.models)
      ? [...col.models]
      : [];
    if (kids.length === 0 && typeof col.forEach === "function") {
      col.forEach((c) => kids.push(c));
    }
    for (const child of kids) {
      const type = String(child.get("type") ?? "");
      if (type === "email-param") continue;
      if (
        type === "email-image" ||
        type === "email-button" ||
        type === "email-divider" ||
        type === "email-spacer" ||
        type === "email-heading" ||
        type === "email-legacy-html"
      ) {
        continue;
      }
      lockNestedTextChrome(child);
      walk(child);
    }
  };
  walk(host);
}

/**
 * Remove contenteditable=false from RTE body nodes (keep param pills locked).
 * Safe to call repeatedly; no-op when already clean.
 */
export function healRteContentEditable(hostEl: HTMLElement | null | undefined): void {
  if (!hostEl) return;
  const locked = hostEl.querySelectorAll(
    '[data-email-type="email-param"], [data-email-type="email-image"], [data-email-type="email-button"]',
  );
  const lockedSet = new Set(Array.from(locked));
  hostEl.querySelectorAll('[contenteditable="false"]').forEach((node) => {
    if (lockedSet.has(node)) return;
    const el = node as Element & HTMLElement;
    if (typeof el.removeAttribute !== "function") return;
    if (
      typeof el.closest === "function" &&
      el.closest('[data-email-type="email-param"]')
    ) {
      return;
    }
    el.removeAttribute("contenteditable");
  });
}

function viewOf(comp: Component): ComponentViewLike | undefined {
  return comp.getView?.() as ComponentViewLike | undefined;
}

function blurHostContentEditables(): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (!active.isContentEditable) return;
  if (active.ownerDocument !== document) return;
  active.blur();
}

/** True when the canvas selection already lives inside this RTE host. */
function hostHasLiveSelection(hostEl: HTMLElement): boolean {
  const sel = hostEl.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const node = sel.anchorNode;
  return Boolean(node && hostEl.contains(node));
}

function focusIsInsideHost(hostEl: HTMLElement): boolean {
  const active = hostEl.ownerDocument.activeElement;
  return (
    active === hostEl ||
    (active instanceof Node && hostEl.contains(active))
  );
}

/**
 * Grapes is actively editing this host AND the browser caret/focus is live.
 * Attribute-only contenteditable=true after blur is NOT live.
 */
function isTrulyEditingHost(editor: Editor, host: Component): boolean {
  if (editor.getEditing() !== host) return false;
  const view = viewOf(host);
  if (view?.rteEnabled === false) return false;
  const el = view?.el ?? host.getEl?.() ?? null;
  if (!el?.isContentEditable) return false;
  return focusIsInsideHost(el);
}

/** Legacy name — same as isTrulyEditingHost (kept for call sites). */
function isLiveRteHost(editor: Editor, host: Component): boolean {
  return isTrulyEditingHost(editor, host);
}

async function leaveTextRte(_editor: Editor, host: Component): Promise<void> {
  try {
    await viewOf(host)?.disableEditing?.();
  } catch {
    // ignore
  }
  // Ownership guards block resetFromString — only wait a frame for blur CE wipe.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  const el = viewOf(host)?.el ?? host.getEl?.() ?? null;
  if (el) {
    el.removeAttribute("contenteditable");
    healRteContentEditable(el);
  }
}

function isInsideParam(node: Node): boolean {
  const el = isDomElement(node)
    ? node
    : ((node as Node).parentElement as Element | null);
  return Boolean(el?.closest?.('[data-email-type="email-param"]'));
}

function paramElFromNode(node: Node | null | undefined): HTMLElement | null {
  if (!node) return null;
  const el = isDomElement(node)
    ? node
    : ((node as Node).parentElement as Element | null);
  const param = el?.closest?.('[data-email-type="email-param"]');
  return param && isDomElement(param) && param.tagName
    ? (param as HTMLElement)
    : null;
}

/** Caret immediately before or after a param pill (never inside CE=false). */
function rangeBesideParam(
  hostEl: HTMLElement,
  paramEl: HTMLElement,
  clientX?: number,
): Range | null {
  const doc = hostEl.ownerDocument;
  const rect = paramEl.getBoundingClientRect();
  const preferAfter =
    typeof clientX === "number" ? clientX >= rect.left + rect.width / 2 : true;
  const range = doc.createRange();
  try {
    if (preferAfter) {
      range.setStartAfter(paramEl);
    } else {
      range.setStartBefore(paramEl);
    }
    range.collapse(true);
    if (!hostEl.contains(range.startContainer) && range.startContainer !== hostEl) {
      return null;
    }
    return range;
  } catch {
    return null;
  }
}

/** Squared distance from point to the nearest caret client rect (Infinity if none). */
function dist2RangeToPoint(range: Range, x: number, y: number): number {
  let rects: DOMRectList | DOMRect[];
  try {
    rects = range.getClientRects();
  } catch {
    return Number.POSITIVE_INFINITY;
  }
  if (!rects.length) {
    try {
      const b = range.getBoundingClientRect();
      if (b.width === 0 && b.height === 0 && b.top === 0 && b.left === 0) {
        return Number.POSITIVE_INFINITY;
      }
      const dx = x - b.left;
      const dy = y - (b.top + b.height / 2);
      return dx * dx + dy * dy;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i]!;
    const cx = Math.max(r.left, Math.min(x, r.right));
    const cy = Math.max(r.top, Math.min(y, r.bottom));
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < best) best = d;
  }
  return best;
}

/** Map event client coords into the host document's viewport space. */
function pointsForHostDoc(
  hostDoc: Document,
  clientX: number,
  clientY: number,
  eventView?: Window | null,
): Array<{ x: number; y: number }> {
  const hostWin = hostDoc.defaultView;
  const out: Array<{ x: number; y: number }> = [{ x: clientX, y: clientY }];
  if (!hostWin) return out;

  const frameEl = hostWin.frameElement as HTMLElement | null;
  if (!frameEl) return out;

  const rect = frameEl.getBoundingClientRect();
  // Event may already be frame-local, or still in parent viewport space.
  out.push({ x: clientX - rect.left, y: clientY - rect.top });
  out.push({ x: clientX + rect.left, y: clientY + rect.top });

  if (eventView && eventView !== hostWin) {
    // Prefer parent→iframe conversion first when the event view is the parent.
    out.unshift({ x: clientX - rect.left, y: clientY - rect.top });
  }
  return out;
}

function rangeFromPoint(doc: Document, x: number, y: number): Range | null {
  const d = doc as Document & {
    caretRangeFromPoint?: (cx: number, cy: number) => Range | null;
    caretPositionFromPoint?: (
      cx: number,
      cy: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof d.caretRangeFromPoint === "function") {
    const ranged = d.caretRangeFromPoint(x, y);
    if (ranged) return ranged;
  }
  if (typeof d.caretPositionFromPoint === "function") {
    const pos = d.caretPositionFromPoint(x, y);
    if (pos?.offsetNode) {
      const range = doc.createRange();
      try {
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
      } catch {
        // offset out of range — ignore
      }
    }
  }
  return null;
}

function usableRangeInHost(hostEl: HTMLElement, range: Range | null): Range | null {
  if (!range) return null;
  if (!hostEl.contains(range.startContainer)) return null;
  if (isInsideParam(range.startContainer)) return null;
  return range;
}

/**
 * Walk text nodes and pick the caret offset whose rect is closest to (x,y).
 * Used when caretRangeFromPoint lands far away (often offset 0 on rich HTML).
 */
function closestTextRangeNearPoint(
  hostEl: HTMLElement,
  x: number,
  y: number,
): Range | null {
  const doc = hostEl.ownerDocument;
  const walker = doc.createTreeWalker(hostEl, NodeFilter.SHOW_TEXT);
  let best: { range: Range; dist: number } | null = null;
  let node: Node | null = walker.nextNode();
  while (node) {
    if (!isInsideParam(node)) {
      const text = node.textContent ?? "";
      const len = text.length;
      if (len > 0) {
        const step = len <= 48 ? 1 : Math.max(1, Math.floor(len / 24));
        for (let offset = 0; offset <= len; offset += step) {
          const range = doc.createRange();
          try {
            range.setStart(node, Math.min(offset, len));
            range.collapse(true);
          } catch {
            continue;
          }
          const dist = dist2RangeToPoint(range, x, y);
          if (!best || dist < best.dist) {
            best = { range, dist };
          }
        }
        // Always probe the true end when we stepped.
        if (step > 1) {
          const end = doc.createRange();
          try {
            end.setStart(node, len);
            end.collapse(true);
            const dist = dist2RangeToPoint(end, x, y);
            if (!best || dist < best.dist) best = { range: end, dist };
          } catch {
            // ignore
          }
        }
      }
    }
    node = walker.nextNode();
  }
  // ~56px radius — reject garbage far from the click
  if (!best || best.dist > 56 * 56) return null;
  return best.range;
}

function applyRange(sel: Selection, range: Range): void {
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Place the caret at a click point inside an RTE host.
 * Exported for unit tests.
 */
export function placeCaretInHost(
  hostEl: HTMLElement,
  clientX?: number,
  clientY?: number,
  eventView?: Window | null,
): void {
  const doc = hostEl.ownerDocument;
  const sel = doc.getSelection();
  if (!sel) return;

  const hasPointer =
    typeof clientX === "number" && typeof clientY === "number";

  if (hasPointer) {
    const candidates = pointsForHostDoc(doc, clientX, clientY, eventView);
    const MAX_DIST2 = 48 * 48;

    // Param pill hit → caret beside the pill (typing otherwise no-ops).
    for (const { x, y } of candidates) {
      const hit = doc.elementFromPoint(x, y);
      const param = paramElFromNode(hit);
      if (param && hostEl.contains(param)) {
        const beside = rangeBesideParam(hostEl, param, x);
        if (beside) {
          applyRange(sel, beside);
          return;
        }
      }
    }

    const nudges: Array<[number, number]> = [
      [0, 0],
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-4, 0],
      [4, 0],
      [-12, 0],
      [12, 0],
      [0, -3],
      [0, 3],
      [0, -8],
      [0, 8],
    ];

    let bestFromPoint: { range: Range; dist: number } | null = null;
    for (const { x, y } of candidates) {
      for (const [dx, dy] of nudges) {
        const ranged = usableRangeInHost(
          hostEl,
          rangeFromPoint(doc, x + dx, y + dy),
        );
        if (!ranged) continue;
        // If caretRangeFromPoint landed in/near a param, sit beside it.
        const param = paramElFromNode(ranged.startContainer);
        if (param && hostEl.contains(param)) {
          const beside = rangeBesideParam(hostEl, param, x + dx);
          if (beside) {
            applyRange(sel, beside);
            return;
          }
          continue;
        }
        const dist = dist2RangeToPoint(ranged, x + dx, y + dy);
        if (dist <= MAX_DIST2 && (!bestFromPoint || dist < bestFromPoint.dist)) {
          bestFromPoint = { range: ranged, dist };
        }
      }
    }
    if (bestFromPoint) {
      applyRange(sel, bestFromPoint.range);
      return;
    }

    // Rich imported HTML: caretRangeFromPoint often returns offset 0 far from
    // the click — walk text nodes for the nearest real caret.
    for (const { x, y } of candidates) {
      const walked = closestTextRangeNearPoint(hostEl, x, y);
      if (walked) {
        applyRange(sel, walked);
        return;
      }
    }

    // Last resort for a click: end of host — never silently jump to offset 0.
    const end = doc.createRange();
    end.selectNodeContents(hostEl);
    end.collapse(false);
    applyRange(sel, end);
    return;
  }

  // No click point: if caret is stuck inside a param pill, move beside it.
  if (hostHasLiveSelection(hostEl) && sel.rangeCount > 0) {
    const param = paramElFromNode(sel.getRangeAt(0).startContainer);
    if (param && hostEl.contains(param)) {
      const beside = rangeBesideParam(hostEl, param);
      if (beside) applyRange(sel, beside);
    }
    return;
  }

  // Prefer end of host — never dump the caret on the first character.
  const end = doc.createRange();
  end.selectNodeContents(hostEl);
  end.collapse(false);
  applyRange(sel, end);
}

/** If selection sits inside a param pill, move it beside the pill. */
export function ensureCaretOutsideParam(
  hostEl: HTMLElement,
  clientX?: number,
): boolean {
  const sel = hostEl.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const param = paramElFromNode(sel.getRangeAt(0).startContainer);
  if (!param || !hostEl.contains(param)) return false;
  const beside = rangeBesideParam(hostEl, param, clientX);
  if (!beside) return false;
  applyRange(sel, beside);
  return true;
}

export type ForceEnablePointer = {
  clientX?: number;
  clientY?: number;
  view?: Window | null;
};

/** Enable RTE on a text/heading host and make typing work. */
export async function forceEnableTextRte(
  editor: Editor,
  comp: Component,
  ev?: ForceEnablePointer,
): Promise<boolean> {
  if (!TEXT_HOST_TYPES.has(String(comp.get("type") ?? ""))) return false;
  if (isInsideLockedChrome(comp)) return false;
  if (comp.get("editable") === false) {
    comp.set("editable", true);
  }

  blurHostContentEditables();
  lockAllNested(comp);

  const current = editor.getEditing();
  if (current && current !== comp) {
    await leaveTextRte(editor, current);
  }

  if (editor.getSelected() !== comp) {
    editor.select(comp);
  }

  const view = viewOf(comp);
  let el = view?.el ?? comp.getEl?.() ?? null;
  healRteContentEditable(el ?? undefined);

  const hasPointer =
    typeof ev?.clientX === "number" && typeof ev?.clientY === "number";

  // Already live + no new click: don't re-run onActive (it resets caret to 0).
  if (
    editor.getEditing() === comp &&
    view?.rteEnabled !== false &&
    el &&
    (el.isContentEditable || el.getAttribute("contenteditable") === "true") &&
    !hasPointer
  ) {
    healRteContentEditable(el);
    return true;
  }

  // Preserve caret/selection across onActive when we have no click to re-apply.
  let savedRange: Range | null = null;
  const textLenBefore = el?.textContent?.length ?? 0;
  if (el && !hasPointer) {
    const sel = el.ownerDocument.getSelection();
    if (sel && hostHasLiveSelection(el) && sel.rangeCount > 0) {
      try {
        savedRange = sel.getRangeAt(0).cloneRange();
      } catch {
        savedRange = null;
      }
    }
  }

  try {
    await view?.onActive?.(ev as Event | undefined);
  } catch {
    // ignore
  }

  el = view?.el ?? comp.getEl?.() ?? null;
  healRteContentEditable(el ?? undefined);

  // Always stamp CE after onActive — Grapes __clearAttributes (placeholder /
  // setAttributes) can wipe contenteditable between enable() and here.
  if (el) {
    el.contentEditable = "true";
  }

  if (el) {
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    const sel = el.ownerDocument.getSelection();
    const hasNonCollapsed =
      Boolean(sel && hostHasLiveSelection(el) && !sel.isCollapsed);
    // Keep drag-select / ⌘A — but a pointer click must still re-place caret.
    // Grapes onActive often leaves a non-collapsed range; skipping placeCaret
    // left Brevo rich hosts stuck at offset 0 after Playwright/user clicks.
    if (hasNonCollapsed && !hasPointer) {
      return Boolean(el.isContentEditable);
    }

    // User already typed while onActive was awaiting — never yank caret back
    // to the original click (that scrambled “Hello…” / “PreviewSync…”).
    const typedDuringEnable =
      (el.textContent?.length ?? 0) !== textLenBefore;
    if (typedDuringEnable && hostHasLiveSelection(el) && !hasPointer) {
      return Boolean(el.isContentEditable);
    }

    if (hasPointer) {
      // Grapes onActive often jumps the caret to offset 0 — re-apply click.
      placeCaretInHost(el, ev?.clientX, ev?.clientY, ev?.view ?? null);
      ensureCaretOutsideParam(el, ev?.clientX);
      // Browser may still park the caret inside CE=false pills after mousedown.
      const x = ev?.clientX;
      requestAnimationFrame(() => {
        const live = viewOf(comp)?.el ?? comp.getEl?.() ?? null;
        if (live) ensureCaretOutsideParam(live, x);
      });
    } else if (savedRange && hostElContainsRange(el, savedRange)) {
      try {
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
      } catch {
        placeCaretInHost(el);
      }
      ensureCaretOutsideParam(el);
    } else if (!hostHasLiveSelection(el)) {
      placeCaretInHost(el);
    } else {
      ensureCaretOutsideParam(el);
    }
  }

  return Boolean(el?.isContentEditable);
}

function hostElContainsRange(hostEl: HTMLElement, range: Range): boolean {
  try {
    return (
      hostEl.contains(range.startContainer) &&
      hostEl.contains(range.endContainer)
    );
  } catch {
    return false;
  }
}

function componentFromEl(el: Element | null): Component | null {
  let node: Element | null = el;
  for (let i = 0; i < 12 && node; i += 1) {
    const view = (node as HTMLElement & { __gjsv?: { model?: Component } })
      .__gjsv;
    const model = view?.model;
    if (model) return model;
    node = node.parentElement;
  }
  return null;
}

function isDomElement(target: EventTarget | null | undefined): target is Element {
  // Must not use `instanceof Element` — canvas events come from the iframe
  // realm, and iframe nodes fail parent-window instanceof checks (host never
  // resolves → Grapes native enable → caret stuck at 0 on rich Brevo HTML).
  return Boolean(
    target &&
      typeof target === "object" &&
      "nodeType" in target &&
      (target as Node).nodeType === 1,
  );
}

function isDomNode(target: EventTarget | null | undefined): target is Node {
  return Boolean(
    target &&
      typeof target === "object" &&
      "nodeType" in target &&
      typeof (target as Node).nodeType === "number",
  );
}

function resolveTextHostFromEventTarget(
  target: EventTarget | null,
): Component | null {
  if (!isDomElement(target)) return null;

  // Prefer the nearest text/heading host — including clicks on param pills
  // inside the block (re-entry must still wake RTE).
  const hostEl = target.closest(
    '[data-email-type="email-text"], [data-email-type="email-heading"]',
  );
  if (hostEl) {
    const fromDom = componentFromEl(hostEl);
    if (fromDom && TEXT_HOST_TYPES.has(String(fromDom.get("type") ?? ""))) {
      return fromDom;
    }
  }

  let cur: Component | null | undefined = componentFromEl(target);
  for (let i = 0; i < 10 && cur; i += 1) {
    const type = String(cur.get("type") ?? "");
    if (TEXT_HOST_TYPES.has(type)) return cur;
    cur = cur.parent() as Component | undefined;
  }
  return null;
}

function canvasDocuments(editor: Editor): Document[] {
  const out: Document[] = [];
  const main = editor.Canvas.getDocument?.();
  if (main) out.push(main);
  try {
    const frame =
      typeof editor.Canvas.getFrameEl === "function"
        ? editor.Canvas.getFrameEl()
        : null;
    const doc = frame?.contentDocument;
    if (doc && !out.includes(doc)) out.push(doc);
  } catch {
    // ignore
  }
  return out;
}

function editingTextHostEl(from: EventTarget | null): HTMLElement | null {
  const node = isDomNode(from) ? from : null;
  const doc = node?.ownerDocument;
  if (!doc) return null;

  const match = (el: Element | null | undefined): HTMLElement | null => {
    if (!isDomElement(el)) return null;
    const host = el.closest(
      '[data-email-type="email-text"], [data-email-type="email-heading"]',
    );
    if (
      isDomElement(host) &&
      host.getAttribute("contenteditable") === "true"
    ) {
      return host as HTMLElement;
    }
    return null;
  };

  const active = doc.activeElement;
  const fromActive = match(isDomElement(active) ? active : null);
  if (fromActive) return fromActive;

  if (isDomElement(from)) {
    const fromTarget = match(from);
    if (fromTarget) return fromTarget;
  }

  const sel = doc.getSelection();
  const anchor = sel?.anchorNode;
  const anchorEl = isDomElement(anchor)
    ? anchor
    : (anchor?.parentElement ?? null);
  return match(anchorEl);
}

/** ⌘/Ctrl+A selects the whole text/heading host (including param pills). */
function selectAllInTextHost(ev: KeyboardEvent): void {
  if (!(ev.metaKey || ev.ctrlKey) || ev.altKey || ev.shiftKey) return;
  if (ev.key.toLowerCase() !== "a") return;
  if (ev.defaultPrevented) return;

  const host = editingTextHostEl(ev.target);
  if (!host) return;

  ev.preventDefault();
  ev.stopPropagation();

  const doc = host.ownerDocument;
  const sel = doc.getSelection();
  if (!sel) return;
  const range = doc.createRange();
  range.selectNodeContents(host);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Canvas capture listener: single mousedown/click enters RTE reliably.
 * Returns unsubscribe.
 */
export function wireCanvasTextClickToEdit(editor: Editor): () => void {
  const docs = new Set<Document>();
  let pending: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setInterval> | undefined;
  /** Serialize leave→enable so Grapes disable sync cannot race re-entry. */
  let leaveChain: Promise<void> = Promise.resolve();
  /**
   * Host currently being enabled from a pointer mousedown. `component:selected`
   * must not schedule a second forceEnable without coords (that races caret).
   */
  let pointerEnableHost: Component | null = null;

  const activateFromEvent = (ev: MouseEvent) => {
    if (ev.button !== 0) return;
    // Only mousedown enters RTE — click would re-run after native caret placement
    // and fight the browser (caret jumps to start).
    if (ev.type !== "mousedown") return;

    const host = resolveTextHostFromEventTarget(ev.target);
    if (!host) {
      // Click outside text hosts: cleanly leave RTE so re-entry isn't stale.
      const editing = editor.getEditing() as Component | undefined;
      if (editing && TEXT_HOST_TYPES.has(String(editing.get("type") ?? ""))) {
        leaveChain = leaveChain
          .then(() => leaveTextRte(editor, editing))
          .catch(() => undefined);
      }
      return;
    }
    if (isInsideLockedChrome(host)) return;

    const hitParam = isDomNode(ev.target) ? paramElFromNode(ev.target) : null;
    // Stop the browser from parking the caret inside CE=false pills.
    if (hitParam) {
      ev.preventDefault();
    }

    // Always claim the caret for content clicks — Grapes native enable otherwise
    // leaves offset 0 on rich Brevo hosts (onSelect without pointer coords).
    ev.preventDefault();

    const pointer = {
      clientX: ev.clientX,
      clientY: ev.clientY,
      view: ev.view ?? null,
    };

    // Already typing: only fix dead carets (param pill / stuck at 0).
    // Always re-placing would fight variable-insert caret placement.
    if (isTrulyEditingHost(editor, host)) {
      const liveEl = viewOf(host)?.el ?? host.getEl?.() ?? null;
      if (liveEl) {
        const sel = liveEl.ownerDocument.getSelection();
        const inParam =
          Boolean(hitParam) ||
          (sel?.anchorNode ? isInsideParam(sel.anchorNode) : false);
        let abs = 0;
        try {
          if (sel?.anchorNode && liveEl.contains(sel.anchorNode)) {
            const pre = liveEl.ownerDocument.createRange();
            pre.selectNodeContents(liveEl);
            pre.setEnd(sel.anchorNode, sel.anchorOffset);
            abs = pre.toString().length;
          }
        } catch {
          abs = 0;
        }
        if (inParam || abs <= 0) {
          placeCaretInHost(
            liveEl,
            pointer.clientX,
            pointer.clientY,
            pointer.view,
          );
          ensureCaretOutsideParam(liveEl, pointer.clientX);
          requestAnimationFrame(() => {
            const el = viewOf(host)?.el ?? host.getEl?.() ?? null;
            if (!el) return;
            ensureCaretOutsideParam(el, pointer.clientX);
          });
        }
      }
      return;
    }

    // Sync prep: unlock nested CE=false; do NOT stamp contenteditable here —
    // setCustomRte.enable owns that (GrapesJS official contract).
    if (host.get("editable") === false) host.set("editable", true);
    lockAllNested(host);
    // Mark before select() so onSelect ignores this enable (pointer owns caret).
    pointerEnableHost = host;
    if (editor.getSelected() !== host) editor.select(host);
    const prepEl = viewOf(host)?.el ?? host.getEl?.() ?? null;
    healRteContentEditable(prepEl ?? undefined);

    if (pending) clearTimeout(pending);
    // Leave any other host first, wait for DOM settle, then enable.
    // forceEnableTextRte places the caret once — no reapply compensators.
    const editing = editor.getEditing() as Component | undefined;
    if (
      editing &&
      editing !== host &&
      TEXT_HOST_TYPES.has(String(editing.get("type") ?? ""))
    ) {
      leaveChain = leaveChain
        .then(() => leaveTextRte(editor, editing))
        .catch(() => undefined);
    }

    void leaveChain
      .then(async () => {
        await forceEnableTextRte(editor, host, pointer);
        // Always re-apply click caret after enable settles. Grapes onActive can
        // leave a non-collapsed range / skip internal placeCaret races.
        const el = viewOf(host)?.el ?? host.getEl?.() ?? null;
        if (!el) return;
        placeCaretInHost(
          el,
          pointer.clientX,
          pointer.clientY,
          pointer.view,
        );
        ensureCaretOutsideParam(el, pointer.clientX);
        requestAnimationFrame(() => {
          const live = viewOf(host)?.el ?? host.getEl?.() ?? null;
          if (!live) return;
          placeCaretInHost(
            live,
            pointer.clientX,
            pointer.clientY,
            pointer.view,
          );
          ensureCaretOutsideParam(live, pointer.clientX);
        });
      })
      .finally(() => {
        if (pointerEnableHost === host) pointerEnableHost = null;
      });
  };

  const bindDoc = (doc: Document | null | undefined) => {
    if (!doc || docs.has(doc)) return;
    docs.add(doc);
    doc.addEventListener("mousedown", activateFromEvent, true);
    doc.addEventListener("keydown", selectAllInTextHost, true);
  };

  const rebindAll = () => {
    for (const doc of canvasDocuments(editor)) bindDoc(doc);
  };

  rebindAll();
  editor.on("canvas:frame:load", rebindAll);
  editor.on("load", rebindAll);
  // Frame can appear a few frames after init — keep trying briefly
  let tries = 0;
  retryTimer = setInterval(() => {
    rebindAll();
    tries += 1;
    if (tries >= 20 && docs.size > 0) {
      if (retryTimer) clearInterval(retryTimer);
      retryTimer = undefined;
    }
  }, 100);

  const onSelect = (comp: Component) => {
    if (!comp) return;
    let host: Component | null = null;
    const type = String(comp.get("type") ?? "");
    if (TEXT_HOST_TYPES.has(type)) {
      host = comp;
    } else if (type !== "email-param") {
      let cur: Component | undefined = comp;
      for (let i = 0; i < 8 && cur; i += 1) {
        const t = String(cur.get("type") ?? "");
        if (TEXT_HOST_TYPES.has(t)) {
          host = cur;
          break;
        }
        cur = cur.parent() as Component | undefined;
      }
    }
    if (!host || isInsideLockedChrome(host)) return;
    // Live RTE or click path already owns enable — don't re-run onActive
    // (that resets the caret to offset 0 and breaks mid-text typing).
    if (isLiveRteHost(editor, host)) return;
    if (pointerEnableHost === host) return;
    const hostEl = viewOf(host)?.el ?? host.getEl?.();
    if (hostEl?.getAttribute("contenteditable") === "true") {
      // Stale CE without getEditing: wake RTE
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = undefined;
        if (isLiveRteHost(editor, host!)) return;
        if (pointerEnableHost === host) return;
        void forceEnableTextRte(editor, host!);
      }, 0);
      return;
    }
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      if (isLiveRteHost(editor, host!)) return;
      if (pointerEnableHost === host) return;
      void forceEnableTextRte(editor, host!);
    }, 0);
  };
  editor.on("component:selected", onSelect);
  editor.on("component:select", onSelect);

  editor.on("rte:enable", (view: { el?: HTMLElement; model?: Component }) => {
    healRteContentEditable(view?.el);
  });

  // After disable, wipe CE so the next click always re-enters via forceEnable
  editor.on("rte:disable", (view: { el?: HTMLElement; model?: Component }) => {
    const el = view?.el;
    if (!el) return;
    queueMicrotask(() => {
      if (editor.getEditing()) return;
      el.removeAttribute("contenteditable");
      healRteContentEditable(el);
    });
  });

  return () => {
    if (pending) clearTimeout(pending);
    if (retryTimer) clearInterval(retryTimer);
    editor.off("canvas:frame:load", rebindAll);
    editor.off("load", rebindAll);
    editor.off("component:selected", onSelect);
    editor.off("component:select", onSelect);
    for (const doc of docs) {
      doc.removeEventListener("mousedown", activateFromEvent, true);
      doc.removeEventListener("keydown", selectAllInTextHost, true);
    }
    docs.clear();
  };
}
