/**
 * GrapesJS email-param — canvas badge, HTML export {{ params.key }}.
 * Location: packages/email-components/src/param.ts
 */

import {
  getVariable,
  isKnownVariableKey,
} from "@email-template/email-variables";
import type { Component, Editor } from "grapesjs";
import { EMAIL_FONT_STACK } from "./brandDefaults.js";

/** Allow dotted keys from legacy imports (export still as {{ params.key }}). */
const KEY_OK = /^[a-z][a-z0-9_.]*$/i;

const BADGE_CSS = `
.email-param-badge,
span[data-email-type="email-param"] {
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  vertical-align: baseline;
  margin: 0 2px;
  padding: 1px 8px;
  border: 1px solid #8fd4a8 !important;
  border-radius: 999px !important;
  background: #e6f6ec !important;
  color: #1b6b3a !important;
  font-family: ${EMAIL_FONT_STACK} !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  line-height: 1.6;
  cursor: pointer;
  user-select: text;
  -webkit-user-select: text;
  white-space: nowrap;
  box-sizing: border-box;
}
.email-param-badge--unknown,
span[data-email-type="email-param"][data-param-known="false"] {
  background: #fde8e8 !important;
  border-color: #f0a0a0 !important;
  color: #a32020 !important;
}
.email-param-badge--known:hover { background: #d4efdf !important; border-color: #1b6b3a !important; }
.email-param-badge--unknown:hover { background: #f8d0d0 !important; border-color: #a32020 !important; }
.email-param-badge__label { pointer-events: none; }
.email-param-badge__remove {
  display: none !important;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  width: 14px;
  height: 14px;
  border: none !important;
  border-radius: 50%;
  background: transparent !important;
  color: inherit !important;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  box-shadow: none !important;
}
.email-param-badge:hover .email-param-badge__remove,
.email-param-badge:focus-within .email-param-badge__remove {
  display: inline-flex !important;
}
.email-param-badge__remove:hover { background: rgba(0, 0, 0, 0.12) !important; }
`;

/** Inline failsafe — GrapesJS canvas.styles expects URLs, not raw CSS. */
const BADGE_STYLE =
  "display:inline-flex;align-items:center;gap:4px;vertical-align:baseline;" +
  "margin:0 2px;padding:1px 8px;border:1px solid #8fd4a8;border-radius:999px;" +
  `background:#e6f6ec;color:#1b6b3a;font-family:${EMAIL_FONT_STACK};` +
  "font-size:12px;font-weight:600;line-height:1.6;cursor:pointer;" +
  "user-select:text;-webkit-user-select:text;white-space:nowrap;box-sizing:border-box;";

const BADGE_STYLE_UNKNOWN =
  "display:inline-flex;align-items:center;gap:4px;vertical-align:baseline;" +
  "margin:0 2px;padding:1px 8px;border:1px solid #f0a0a0;border-radius:999px;" +
  `background:#fde8e8;color:#a32020;font-family:${EMAIL_FONT_STACK};` +
  "font-size:12px;font-weight:600;line-height:1.6;cursor:pointer;" +
  "user-select:text;-webkit-user-select:text;white-space:nowrap;box-sizing:border-box;";

const REMOVE_STYLE =
  "display:none;align-items:center;justify-content:center;margin:0;padding:0;" +
  "width:14px;height:14px;border:none;border-radius:50%;background:transparent;" +
  "color:inherit;font-size:14px;font-weight:700;line-height:1;cursor:pointer;";

function injectBadgeCss(doc: Document): void {
  let style = doc.getElementById("email-param-badge-css") as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = "email-param-badge-css";
    (doc.head ?? doc.documentElement).appendChild(style);
  }
  style.textContent = BADGE_CSS;
}

function paramKeyOf(model: Component): string {
  return String(model.getAttributes()["data-param-key"] ?? "").trim();
}

/** Short pill label (never the long description). */
function paramBadgeLabel(model: Component): string {
  const key = paramKeyOf(model);
  const fromRegistry = getVariable(key)?.label;
  if (fromRegistry) return fromRegistry;
  const short = String(model.getAttributes()["data-param-label"] ?? "").trim();
  if (short && short.length < 40 && short !== key) return short;
  if (key) return humanizeParamKey(key);
  return "Param";
}

/** Long “Angezeigte Informationen” for Eigenschaften → Bedeutung. */
function paramDescriptionOf(model: Component): string {
  const key = paramKeyOf(model);
  const fromRegistry = getVariable(key)?.description;
  if (fromRegistry) return fromRegistry;
  const stored = String(
    model.getAttributes()["data-param-description"] ?? "",
  ).trim();
  if (stored) return stored;
  return paramBadgeLabel(model);
}

/** Fallback label when key is not in the registry. */
function humanizeParamKey(key: string): string {
  const parts = key.split(/[._]/).filter(Boolean);
  if (parts.length === 0) return key;
  return parts
    .map((seg, i) => {
      const lower = seg.toLowerCase();
      if (i === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .join(" ");
}

/** Badge face text: {{ params.key }} */
function paramExpressionOf(model: Component): string {
  const key = paramKeyOf(model);
  if (KEY_OK.test(key)) return `{{ params.${key} }}`;
  return paramBadgeLabel(model);
}

/** Trait defs for Eigenschaften — Variable ({{ params.* }}) + description. */
const EMAIL_PARAM_TRAITS = [
  {
    type: "param-expression",
    name: "data-param-expr",
    label: "Variable",
  },
  {
    type: "param-description",
    name: "data-param-description",
    label: "Angezeigte Informationen",
  },
] as const;

/** Sync trait attributes before opening Eigenschaften. */
function syncParamTraits(model: Component): void {
  // Replace Grapes default id/title if a badge was ever typed as plain text
  model.setTraits([...EMAIL_PARAM_TRAITS]);
  const key = paramKeyOf(model);
  if (!KEY_OK.test(key)) return;
  const expression = `{{ params.${key} }}`;
  const description = paramDescriptionOf(model);
  const shortLabel = paramBadgeLabel(model);
  model.addAttributes({
    "data-param-key": key,
    "data-param-expr": expression,
    "data-param-description": description,
    "data-param-label": shortLabel,
  });
}

function isParamBadgeEl(el: Element | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    (el.getAttribute("data-email-type") === "email-param" ||
      el.classList.contains("email-param-badge"))
  );
}

function isTextHostEl(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const t = el.getAttribute("data-email-type");
  return t === "email-text" || t === "email-heading" || t === "email-button";
}

/** Walk to previous/next sibling, climbing past nested wrappers. */
function adjacentElement(node: Node, offset: number, dir: -1 | 1): Element | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    const atEdge =
      dir < 0
        ? offset === 0
        : offset === (text.textContent?.length ?? 0);
    if (!atEdge) return null;
    let walk: Node | null = text;
    while (walk) {
      const sib = dir < 0 ? walk.previousSibling : walk.nextSibling;
      if (sib) {
        return sib.nodeType === Node.ELEMENT_NODE
          ? (sib as Element)
          : null;
      }
      walk = walk.parentNode;
      if (isTextHostEl(walk as Element | null)) break;
    }
    return null;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const idx = dir < 0 ? offset - 1 : offset;
    if (idx < 0 || idx >= el.childNodes.length) return null;
    const child = el.childNodes[idx];
    return child?.nodeType === Node.ELEMENT_NODE ? (child as Element) : null;
  }
  return null;
}

function paramModelFromEl(editor: Editor, el: HTMLElement): Component | undefined {
  const id = el.getAttribute("id");
  if (id) {
    try {
      const byId = editor.Components.getById(id);
      if (byId) return byId;
    } catch {
      // id not registered yet
    }
  }
  const all = editor.getWrapper()?.find('[data-email-type="email-param"]') ?? [];
  return all.find((c) => c.getEl() === el);
}

/** Backspace/Delete removes adjacent param badges while editing text. */
function wireParamBadgeKeys(editor: Editor): void {
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Backspace" && ev.key !== "Delete") return;
    if (ev.defaultPrevented) return;

    const doc = (ev.target as Node | null)?.ownerDocument;
    if (!doc) return;
    const sel = doc.getSelection?.();
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const dir: -1 | 1 = ev.key === "Backspace" ? -1 : 1;
    const targetEl = adjacentElement(range.startContainer, range.startOffset, dir);
    if (!isParamBadgeEl(targetEl)) return;

    const model = paramModelFromEl(editor, targetEl);
    if (!model) return;
    ev.preventDefault();
    ev.stopPropagation();
    model.remove();
  };

  const bind = (frameDoc: Document) => {
    injectBadgeCss(frameDoc);
    frameDoc.addEventListener("keydown", onKey, true);
  };

  editor.on("canvas:frame:load", ({ window: win }: { window: Window }) => {
    if (win?.document) bind(win.document);
  });
  editor.on("canvas:frame:load:body", ({ window: win }: { window: Window }) => {
    if (win?.document) injectBadgeCss(win.document);
  });

  const frame = editor.Canvas?.getFrameEl?.();
  const frameWin = frame?.contentWindow;
  if (frameWin?.document) bind(frameWin.document);
}

export function registerEmailParamComponent(editor: Editor): void {
  const domc = editor.DomComponents;
  const tm = editor.TraitManager;

  function attachCopyButton(
    field: HTMLInputElement | HTMLTextAreaElement,
    wrap: HTMLElement,
  ): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ed-trait-copy-btn";
    btn.textContent = "Kopieren";
    btn.setAttribute("aria-label", "In Zwischenablage kopieren");
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const text = field.value.trim();
      if (!text) return;
      void (async () => {
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = "Kopiert";
          window.setTimeout(() => {
            btn.textContent = "Kopieren";
          }, 1500);
        } catch {
          // Fallback for older browsers / denied permission
          field.focus();
          field.select();
          try {
            document.execCommand("copy");
            btn.textContent = "Kopiert";
            window.setTimeout(() => {
              btn.textContent = "Kopieren";
            }, 1500);
          } catch {
            btn.textContent = "Fehler";
            window.setTimeout(() => {
              btn.textContent = "Kopieren";
            }, 1500);
          }
        }
      })();
    });
    wrap.appendChild(btn);
  }

  // Long “Angezeigte Informationen” as textarea + copy
  tm.addType("param-description", {
    createInput() {
      const wrap = document.createElement("div");
      wrap.className = "ed-trait-copy-wrap ed-trait-copy-wrap--stack";
      const el = document.createElement("textarea");
      el.rows = 6;
      el.className = "ed-trait-param-desc";
      el.setAttribute("aria-label", "Angezeigte Informationen");
      wrap.appendChild(el);
      attachCopyButton(el, wrap);
      return wrap;
    },
    onUpdate({ elInput, component }) {
      const input = (elInput as HTMLElement).querySelector(
        "textarea",
      ) as HTMLTextAreaElement | null;
      if (!input) return;
      input.value = String(
        component.getAttributes()["data-param-description"] ?? "",
      );
    },
    onEvent({ elInput, component }) {
      const input = (elInput as HTMLElement).querySelector(
        "textarea",
      ) as HTMLTextAreaElement | null;
      if (!input) return;
      component.addAttributes({
        "data-param-description": input.value,
      });
    },
  });

  tm.addType("param-expression", {
    createInput() {
      const wrap = document.createElement("div");
      wrap.className = "ed-trait-copy-wrap ed-trait-copy-wrap--row";
      const el = document.createElement("input");
      el.type = "text";
      el.readOnly = true;
      el.className = "ed-trait-param-expr";
      el.setAttribute("aria-label", "Variable");
      wrap.appendChild(el);
      attachCopyButton(el, wrap);
      return wrap;
    },
    onUpdate({ elInput, component }) {
      const input = (elInput as HTMLElement).querySelector(
        "input",
      ) as HTMLInputElement | null;
      if (!input) return;
      const key = String(
        component.getAttributes()["data-param-key"] ?? "",
      ).trim();
      input.value = KEY_OK.test(key) ? `{{ params.${key} }}` : "";
    },
  });

  domc.addType("email-param", {
    isComponent: (el) =>
      el.getAttribute?.("data-email-type") === "email-param" ||
      Boolean(el.getAttribute?.("data-param-key")),
    model: {
      defaults: {
        tagName: "span",
        droppable: false,
        editable: false,
        textable: true,
        draggable: true,
        selectable: true,
        hoverable: true,
        highlightable: true,
        removable: true,
        stylable: false,
        void: false,
        attributes: {
          "data-email-type": "email-param",
          "data-param-key": "",
          "data-param-label": "",
          "data-param-expr": "",
          "data-param-description": "",
        },
        traits: [...EMAIL_PARAM_TRAITS],
      },
      // Canvas shows a badge; Brevo/getHtml gets the merge tag only.
      toHTML() {
        const key = paramKeyOf(this);
        if (!KEY_OK.test(key)) return "";
        return `{{ params.${key} }}`;
      },
      init() {
        this.on("change:attributes:data-param-key", () => {
          syncParamTraits(this);
        });
      },
    },
    view: {
      events() {
        return {
          mousedown: "onBadgeMouseDown",
          click: "onBadgeClick",
          dblclick: "onBadgeDblClick",
          "click .email-param-badge__remove": "onRemoveClick",
        };
      },
      onRemoveClick(ev: Event) {
        ev.preventDefault();
        ev.stopPropagation();
        this.model.remove();
      },
      onBadgeMouseDown(ev: MouseEvent) {
        const t = ev.target as HTMLElement | null;
        if (t?.closest?.(".email-param-badge__remove")) return;
        const host = (this.el as HTMLElement | undefined)?.closest?.(
          '[data-email-type="email-text"], [data-email-type="email-heading"]',
        );
        // Keep drag/⌘A text selection; block Grapes component-select steal.
        if (host?.getAttribute("contenteditable") === "true") {
          ev.stopPropagation();
        }
      },
      onBadgeDblClick(ev: Event) {
        const t = ev.target as HTMLElement | null;
        if (t?.closest?.(".email-param-badge__remove")) return;
        ev.preventDefault();
        ev.stopPropagation();
        syncParamTraits(this.model);
        editor.select(this.model);
      },
      onBadgeClick(ev: Event) {
        const t = ev.target as HTMLElement | null;
        if (t?.closest?.(".email-param-badge__remove")) return;
        const host = (this.el as HTMLElement | undefined)?.closest?.(
          '[data-email-type="email-text"], [data-email-type="email-heading"]',
        );
        // Inside active RTE: let the browser keep text selection (incl. this pill).
        // Traits open via double-click instead.
        if (host?.getAttribute("contenteditable") === "true") {
          return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        syncParamTraits(this.model);
        editor.select(this.model);
      },
      onRender({ el, model }) {
        syncParamTraits(model);
        const key = paramKeyOf(model);
        const known = KEY_OK.test(key) && isKnownVariableKey(key);
        const meaning = paramBadgeLabel(model);
        const expression = paramExpressionOf(model);

        injectBadgeCss(el.ownerDocument);

        el.setAttribute("contenteditable", "false");
        el.classList.add("email-param-badge");
        el.classList.toggle("email-param-badge--known", known);
        el.classList.toggle("email-param-badge--unknown", !known);
        el.setAttribute("data-param-known", known ? "true" : "false");
        el.title = `${meaning} — ${expression}`;
        el.setAttribute("aria-label", `${meaning}: ${expression}`);
        // ponytail: inline styles because canvas.styles is URL-only in GrapesJS
        el.style.cssText = known ? BADGE_STYLE : BADGE_STYLE_UNKNOWN;

        const doc = el.ownerDocument;
        el.replaceChildren();
        const label = doc.createElement("span");
        label.className = "email-param-badge__label";
        // Visual editor shows merge tag; toHTML() emits the same {{ params.key }}
        label.textContent = expression;

        const remove = doc.createElement("button");
        remove.type = "button";
        remove.className = "email-param-badge__remove";
        remove.setAttribute("aria-label", "Variable entfernen");
        remove.setAttribute("tabindex", "-1");
        remove.textContent = "×";
        remove.style.cssText = REMOVE_STYLE;

        el.append(label, remove);

        el.onmouseenter = () => {
          remove.style.display = "inline-flex";
        };
        el.onmouseleave = () => {
          remove.style.display = "none";
        };
      },
      init() {
        this.listenTo(
          this.model,
          "change:attributes:data-param-key change:attributes:data-param-label change:attributes:data-param-description",
          this.render,
        );
      },
    },
  });

  editor.on("component:selected", (component: Component) => {
    if (String(component.get("type") ?? "") === "email-param") {
      syncParamTraits(component);
    }
  });

  wireParamBadgeKeys(editor);
}

/** Accept inline drops into text/heading/button hosts (components or drag defs). */
export function isInlineParamDrop(source: unknown): boolean {
  // Grapes may pass raw HTML strings from Canvas.startDrag({ content: "..." })
  if (typeof source === "string") return source.trim().length > 0;
  const type = dropSourceType(source);
  return (
    type === "email-param" ||
    type === "textnode" ||
    type === "text" ||
    type === "link" ||
    // Textbausteine / snippet drag (Canvas.startDrag definition)
    type === "email-text" ||
    type === "email-heading"
  );
}

/** Resolve Grapes component type from a live model or a plain drag definition. */
export function dropSourceType(source: unknown): string {
  if (!source || typeof source !== "object") return "";
  const s = source as {
    get?: (k: string) => unknown;
    type?: unknown;
  };
  if (typeof s.get === "function") {
    return String(s.get("type") ?? "");
  }
  return String(s.type ?? "");
}

export function buildEmailParamComponent(key: string, label: string) {
  const safeKey = KEY_OK.test(key) ? key : "";
  const def = safeKey ? getVariable(safeKey) : undefined;
  const meaning = def?.label || label || safeKey;
  const description = def?.description || meaning;
  const expression = safeKey ? `{{ params.${safeKey} }}` : "";
  return {
    type: "email-param" as const,
    attributes: {
      "data-email-type": "email-param",
      "data-param-key": safeKey,
      "data-param-label": meaning,
      "data-param-description": description,
      "data-param-expr": expression,
      "data-param-known":
        safeKey && isKnownVariableKey(safeKey) ? "true" : "false",
    },
  };
}
