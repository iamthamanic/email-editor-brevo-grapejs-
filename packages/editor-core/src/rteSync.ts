/**
 * Sync live GrapesJS RTE DOM back into the component model.
 * Location: packages/editor-core/src/rteSync.ts
 *
 * With `richTextEditor.custom: true`, Grapes getContent()/getHtml() often lag
 * behind the canvas DOM while typing — preview/autosave then miss copy.
 *
 * OWNERSHIP RULE (Phase 2): While a host is actively edited, never rebuild its
 * DOM from the model (`syncContent` / `resetFromString`). Persist silently into
 * the model only; Grapes may rebuild only after a real blur/disable.
 */

import type { Component, Editor } from "grapesjs";
import type { EditorProjectData } from "@email-template/email-schema";
import { sanitizeEmailHtml } from "@email-template/email-components/html";

type RteView = {
  el?: HTMLElement;
  model?: Component;
  rteEnabled?: boolean;
  getContent?: () => Promise<string> | string;
  syncContent?: (opts?: {
    content?: string;
    force?: boolean;
  }) => Promise<unknown> | unknown;
  disableEditing?: (opts?: object) => Promise<unknown> | unknown;
  __etsSyncGuard?: boolean;
};

const TEXT_HOST_SELECTOR =
  '[data-email-type="email-text"], [data-email-type="email-heading"]';

/** Child types that must stay as Grapes components (not flattened to HTML string). */
const STRUCTURAL_CHILD_TYPES = new Set([
  "email-param",
  "email-image",
  "email-button",
  "link",
]);

function isMeaningfulHtml(html: string, plain: string): boolean {
  if (plain.length > 0) return true;
  const compact = html.replace(/\s+/g, "").toLowerCase();
  if (!compact || compact === "<br>" || compact === "<br/>") return false;
  return true;
}

function textHosts(editor: Editor): Component[] {
  const wrap = editor.getWrapper?.();
  if (!wrap || typeof wrap.find !== "function") return [];
  try {
    return wrap.find(TEXT_HOST_SELECTOR) as Component[];
  } catch {
    return [];
  }
}

function childList(comp: Component): Component[] {
  const comps = comp.components?.();
  if (!comps) return [];
  if (typeof comps === "object" && "models" in comps) {
    return (comps as { models: Component[] }).models.slice();
  }
  try {
    return Array.from(comps as Iterable<Component>);
  } catch {
    return [];
  }
}

function hasStructuralChildren(comp: Component): boolean {
  for (const child of childList(comp)) {
    const type = String(child.get("type") ?? "");
    if (STRUCTURAL_CHILD_TYPES.has(type)) return true;
    if (hasStructuralChildren(child)) return true;
  }
  return false;
}

/**
 * Push live DOM text into existing textnode/text children without rebuilding
 * the view (keeps email-param / link components intact).
 */
function persistStructuralTextNodesSilent(comp: Component): boolean {
  let updated = false;
  const walk = (parent: Component) => {
    for (const child of childList(parent)) {
      const type = String(child.get("type") ?? "");
      if (STRUCTURAL_CHILD_TYPES.has(type)) continue;
      if (type === "textnode" || type === "text" || !type) {
        const childEl = child.getEl?.() as HTMLElement | Text | null | undefined;
        if (!childEl) continue;
        const text =
          childEl.nodeType === Node.TEXT_NODE
            ? (childEl as Text).data
            : (childEl.textContent ?? "");
        const prev = String(child.get("content") ?? "");
        if (prev === text) continue;
        try {
          child.set("content", text, { silent: true });
          updated = true;
        } catch {
          // mid-sync
        }
        continue;
      }
      walk(child);
    }
  };
  walk(comp);
  return updated;
}

/**
 * Write live DOM into the model without touching the canvas DOM.
 * Flat hosts: sanitized `content` string.
 * Structural hosts: silent textnode updates (children stay components).
 */
function persistHostDomSilent(comp: Component): boolean {
  const el = comp.getEl?.() as HTMLElement | null | undefined;
  if (!el) return false;
  const raw = el.innerHTML ?? "";
  const html = sanitizeEmailHtml(raw);
  const plain = (el.textContent ?? "").replace(/\u00a0/g, " ").trim();
  if (!isMeaningfulHtml(html, plain)) return false;

  if (hasStructuralChildren(comp)) {
    persistStructuralTextNodesSilent(comp);
    return true;
  }

  const comps = comp.components?.();
  if (comps && childList(comp).length > 0) {
    try {
      comps.reset([], { silent: true });
    } catch {
      return false;
    }
  }

  const prev = String(comp.get("content") ?? "");
  if (prev === html) return true;
  try {
    comp.set("content", html, { silent: true });
  } catch {
    return false;
  }
  return true;
}

/**
 * Install syncContent / resetFromString guards for email text hosts.
 *
 * Must run AFTER `registerEmailComponents` so email-text's View prototype exists
 * before Grapes `listenTo(..., this.syncContent)` binds the method on new views.
 */
export function installRteSyncContentGuard(editor: Editor): () => void {
  type CollProto = {
    reset?: (models?: unknown, opts?: unknown) => unknown;
    resetFromString?: (input?: unknown, opts?: unknown) => unknown;
    parent?: Component;
    __etsResetFromStringGuard?: boolean;
    __etsResetGuard?: boolean;
  };

  try {
    const wrap = editor.getWrapper?.();
    const coll = wrap?.components?.() as CollProto | undefined;
    const collProto = coll ? (Object.getPrototypeOf(coll) as CollProto) : null;
    if (collProto && !collProto.__etsResetFromStringGuard) {
      collProto.__etsResetFromStringGuard = true;
      if (typeof collProto.resetFromString === "function") {
        const origResetFromString = collProto.resetFromString;
        collProto.resetFromString = function (
          this: CollProto,
          input?: unknown,
          opts?: unknown,
        ) {
          const parent = this.parent;
          const type = String(parent?.get?.("type") ?? "");
          if (type === "email-text" || type === "email-heading") {
            if (parent) persistHostDomSilent(parent);
            return this;
          }
          return origResetFromString.call(this, input, opts);
        };
      }
      // parseContent:false path uses comps.reset(undefined, { keepIds }) instead
      // of resetFromString. Do not block plain reset() (placeholder clear, etc.).
      if (typeof collProto.reset === "function" && !collProto.__etsResetGuard) {
        collProto.__etsResetGuard = true;
        const origReset = collProto.reset;
        collProto.reset = function (
          this: CollProto,
          models?: unknown,
          opts?: unknown,
        ) {
          const parent = this.parent;
          const type = String(parent?.get?.("type") ?? "");
          const keepIds = (opts as { keepIds?: unknown } | undefined)?.keepIds;
          if (
            (type === "email-text" || type === "email-heading") &&
            (models === undefined || models === null) &&
            Array.isArray(keepIds)
          ) {
            if (parent) persistHostDomSilent(parent);
            return this;
          }
          return origReset.call(this, models, opts);
        };
      }
    }
  } catch {
    // collection proto unavailable
  }

  const patchedViews = new Set<object>();
  const patchViewProto = (ViewCtor: { prototype: RteView } | undefined) => {
    if (!ViewCtor?.prototype || patchedViews.has(ViewCtor.prototype)) return;
    if (typeof ViewCtor.prototype.syncContent !== "function") return;
    patchedViews.add(ViewCtor.prototype);
    const proto = ViewCtor.prototype;
    const original = proto.syncContent!;
    proto.__etsSyncGuard = true;
    proto.syncContent = async function (
      this: RteView,
      opts: { content?: string; force?: boolean } = {},
    ) {
      const model = this.model;
      const type = String(model?.get?.("type") ?? "");
      if (type === "email-text" || type === "email-heading") {
        if (model) persistHostDomSilent(model);
        return;
      }
      return original.call(this, opts);
    };
  };

  for (const type of ["text", "email-text", "email-heading"]) {
    const def = editor.DomComponents.getType(type) as
      | { view?: { prototype: RteView } }
      | undefined;
    patchViewProto(def?.view);
  }

  const onMount = (comp: Component) => {
    const type = String(comp.get("type") ?? "");
    if (
      type !== "email-text" &&
      type !== "email-heading" &&
      type !== "text"
    ) {
      return;
    }
    const view = comp.getView?.() as RteView | undefined;
    if (view) view.__etsSyncGuard = true;
    const proto = view ? Object.getPrototypeOf(view) : null;
    if (proto?.constructor) {
      patchViewProto(proto.constructor as { prototype: RteView });
    }
  };

  editor.on("component:mount", onMount);
  editor.on("rte:enable", (view: RteView) => {
    if (view) view.__etsSyncGuard = true;
  });

  return () => {
    editor.off("component:mount", onMount);
  };
}

/**
 * Read wrapper innerHTML from the canvas DOM (includes in-progress RTE text).
 * Prefer this for preview/export so we do not reparse the live editing host.
 */
function htmlFromCanvasDom(editor: Editor): string | null {
  const wrap = editor.getWrapper?.();
  const el = wrap?.getEl?.() as HTMLElement | null | undefined;
  if (!el) return null;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[contenteditable]").forEach((node) => {
    node.removeAttribute("contenteditable");
  });
  const html = clone.innerHTML ?? "";
  return html.trim() ? html : null;
}

/**
 * Push live canvas HTML for text/heading hosts into the Grapes model.
 * Always silent while a host is (or was) mid-edit — never syncContent here.
 */
export async function syncActiveRteToModel(editor: Editor): Promise<void> {
  const editing = editor.getEditing?.() as Component | undefined;
  if (editing) {
    persistHostDomSilent(editing);
  }

  for (const host of textHosts(editor)) {
    if (host === editing) continue;
    const el = host.getEl?.() as HTMLElement | null | undefined;
    if (!el) continue;
    const plain = (el.textContent ?? "").replace(/\u00a0/g, " ").trim();
    if (!plain) continue;
    // Silent for all hosts — autosave must not rebuild inactive structural hosts
    // either (that still races a quick re-entry into the same block).
    persistHostDomSilent(host);
  }
}

/** HTML export that includes in-progress RTE edits (DOM-first, no caret yank). */
export async function getSyncedHtml(editor: Editor): Promise<string> {
  const fromDom = htmlFromCanvasDom(editor);
  if (fromDom) return fromDom;
  await syncActiveRteToModel(editor);
  return editor.getHtml() ?? "";
}

/**
 * Project JSON that includes in-progress RTE edits.
 * Mid-edit: silent model overlay only — never rebuild the live host DOM.
 */
export async function getSyncedProjectData(
  editor: Editor,
): Promise<EditorProjectData> {
  await syncActiveRteToModel(editor);
  return editor.getProjectData() as EditorProjectData;
}

/**
 * Previously force-synced on rte:disable; that raced re-entry (caret→0) and
 * duplicated Grapes' own disableEditing syncContent. Kept as a no-op hook so
 * callers stay stable — Grapes blur sync + installRteSyncContentGuard suffice.
 */
export function wireLiveRteModelSync(editor: Editor): () => void {
  void editor;
  return () => {
    // no-op
  };
}

/**
 * Wait until Grapes finishes post-disable mount/render churn.
 * disableEditing()'s promise resolves before ~40 component:mount events.
 */
export function waitForEditorDomSettle(
  editor: Editor,
  quietMs = 48,
  maxMs = 400,
): Promise<void> {
  return new Promise((resolve) => {
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (quietTimer) clearTimeout(quietTimer);
      if (maxTimer) clearTimeout(maxTimer);
      editor.off("component:mount", onMount);
      resolve();
    };

    const armQuiet = () => {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    };

    const onMount = () => armQuiet();

    editor.on("component:mount", onMount);
    maxTimer = setTimeout(finish, maxMs);
    // No mounts → still wait two frames + quiet window
    requestAnimationFrame(() => {
      requestAnimationFrame(armQuiet);
    });
  });
}
