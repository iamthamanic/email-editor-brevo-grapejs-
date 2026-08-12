/**
 * Official GrapesJS custom RTE adapter (native contentEditable).
 * Location: packages/editor-core/src/richText/nativeCustomRte.ts
 *
 * Research (GrapesJS docs + grapesjs-plugin-ckeditor + community):
 * 1. Lifecycle must go through `editor.setCustomRte({ enable, disable })`.
 * 2. Every enable/focus must set `el.contentEditable = true` (CKEditor issue #2828).
 * 3. Grapes `ComponentView.updateAttributes` → `__clearAttributes()` strips ALL DOM
 *    attrs (including contenteditable) on ANY `setAttributes`/`removeAttributes`.
 *    That is the real “can select, can’t type” killer after placeholder clear or
 *    any mid-edit attribute tweak — restamp CE whenever `view.rteEnabled`.
 *
 * @see https://grapesjs.com/docs/guides/Replace-Rich-Text-Editor.html
 * @see https://github.com/GrapesJS/grapesjs/issues/2828
 */

import type { Editor } from "grapesjs";

export type NativeRteInstance = {
  el: HTMLElement;
  exec: (command: string, value?: string) => void;
  insertHTML: (html: string) => void;
  selection: () => Selection | null;
};

type EnableOpts = {
  view?: RteHostView;
  event?: Event;
};

type RteHostView = {
  el?: HTMLElement;
  rteEnabled?: boolean;
  getChildrenContainer?: () => HTMLElement;
  updateAttributes?: (...args: unknown[]) => unknown;
  __etsCePreserve?: boolean;
};

function setEditable(el: HTMLElement, on: boolean): void {
  // CKEditor plugin + Grapes guide: explicit true/false (not inherit)
  el.contentEditable = on ? "true" : "false";
}

function focusEl(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function resolveHost(el: HTMLElement, opts?: EnableOpts): HTMLElement {
  const viewEl = opts?.view?.el;
  if (viewEl instanceof HTMLElement) return viewEl;
  return el;
}

/** Stamp CE on host + children container Grapes passes to enable(). */
export function stampViewContentEditable(
  view?: RteHostView | null,
  force = false,
): void {
  if (!view) return;
  // enable() runs before toggleEvents sets rteEnabled — allow force stamp
  if (!force && !view.rteEnabled) return;
  const host = view.el;
  if (host instanceof HTMLElement) setEditable(host, true);
  const child = view.getChildrenContainer?.();
  if (child instanceof HTMLElement && child !== host) setEditable(child, true);
}

/**
 * Grapes wipes contenteditable on every attribute sync. Patch the view so
 * mid-edit setAttributes/removeAttributes cannot leave a dead host.
 */
function preserveContentEditableOnAttributeSync(view?: RteHostView | null): void {
  if (!view || view.__etsCePreserve) return;
  if (typeof view.updateAttributes !== "function") return;
  view.__etsCePreserve = true;
  const original = view.updateAttributes.bind(view);
  view.updateAttributes = (...args: unknown[]) => {
    const result = original(...args);
    // Always force: this patch is only installed once a view has entered RTE.
    // After disable, rteEnabled is false and stamp becomes a no-op unless force;
    // use rteEnabled check so blur does not leave a sticky CE=true.
    if (view.rteEnabled) stampViewContentEditable(view, true);
    return result;
  };
}

function bindApi(el: HTMLElement, rte: NativeRteInstance): NativeRteInstance {
  rte.el = el;
  rte.exec = (command, value) => {
    try {
      el.ownerDocument.execCommand(command, false, value);
    } catch {
      // ignore unsupported commands
    }
  };
  rte.insertHTML = (html) => {
    try {
      el.ownerDocument.execCommand("insertHTML", false, html);
    } catch {
      // ignore
    }
  };
  rte.selection = () => el.ownerDocument.getSelection();
  return rte;
}

function activate(
  el: HTMLElement,
  opts?: EnableOpts,
  rte?: NativeRteInstance,
): NativeRteInstance {
  const view = opts?.view;
  preserveContentEditableOnAttributeSync(view);
  const host = resolveHost(el, opts);
  setEditable(el, true);
  if (host !== el) setEditable(host, true);
  focusEl(host);
  // Placeholder clear / attribute sync runs on rte:enable (and microtasks run
  // before toggleEvents sets rteEnabled) — always force-stamp these ticks.
  queueMicrotask(() => stampViewContentEditable(view, true));
  requestAnimationFrame(() => stampViewContentEditable(view, true));
  return bindApi(host, rte ?? ({ el: host } as NativeRteInstance));
}

/**
 * Install a minimal custom RTE that owns contentEditable lifecycle.
 * Toolbar stays our React EditorToolbar (`richTextEditor.custom: true`).
 */
export function installNativeCustomRte(editor: Editor): void {
  editor.setCustomRte({
    parseContent: false,

    enable(el: HTMLElement, rte?: NativeRteInstance, opts?: EnableOpts) {
      return activate(el, opts, rte);
    },

    disable(el: HTMLElement, _rte?: NativeRteInstance, opts?: EnableOpts) {
      const host = resolveHost(el, opts);
      setEditable(el, false);
      if (host !== el) setEditable(host, false);
    },

    focus(el: HTMLElement, rte?: NativeRteInstance, opts?: EnableOpts) {
      return activate(el, opts, rte);
    },

    getContent(el: HTMLElement, _rte?: NativeRteInstance, opts?: EnableOpts) {
      const host = resolveHost(el, opts);
      return host.innerHTML ?? el.innerHTML ?? "";
    },
  });

  editor.on("rte:enable", (view: RteHostView) => {
    preserveContentEditableOnAttributeSync(view);
    stampViewContentEditable(view, true);
    queueMicrotask(() => stampViewContentEditable(view, true));
    requestAnimationFrame(() => stampViewContentEditable(view, true));
  });
}
