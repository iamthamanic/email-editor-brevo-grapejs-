/**
 * Register email-safe GrapesJS component types + DE block library.
 * Location: packages/email-components/src/register.ts
 * Hides: GrapesJS DomComponents / BlockManager wiring for email blocks.
 */

import type { Component, Editor } from "grapesjs";
import { EMAIL_COLORS, EMAIL_FONT_STACK } from "./brandDefaults.js";
import { registerBrandColorTrait } from "./brandColorTrait.js";
import { registerImageSrcTrait } from "./imageSrcTrait.js";
import { blockMedia } from "./blockIcons.js";
import { registerCorporateComponents } from "./corporate.js";
import { registerEmailHeaderComponent } from "./header.js";
import { sanitizeEmailHtml } from "./html.js";
import {
  columnsSectionContent,
  footerSectionContent,
  headerSectionContent,
  registerLayoutComponents,
  socialSectionContent,
} from "./layout.js";
import {
  healRteContentEditable,
  isInsideLockedChrome,
  lockNestedTextChrome,
  wireCanvasTextClickToEdit,
} from "./clickToEdit.js";
import {
  isInlineParamDrop,
  registerEmailParamComponent,
} from "./param.js";
import { EMAIL_COMPONENTS } from "./registry.js";
import { sanitizeAltText, toPlainText } from "./text.js";
import { sanitizeImageUrl, sanitizeLinkUrl } from "./urls.js";
import {
  EMAIL_IMAGE_PLACEHOLDER_SRC,
  isEmailImagePlaceholderSrc,
  syncEmailImagePlaceholderFlag,
} from "./imagePlaceholder.js";

const PLACEHOLDER_IMG = EMAIL_IMAGE_PLACEHOLDER_SRC;

/** Default empty-block copy — gray until first edit (data-placeholder). */
export const EMAIL_TEXT_PLACEHOLDER = "Text hier eingeben…";

/** Definition for a brand-new empty text block (palette / starter / empty column). */
export function emptyEmailTextBlock(): {
  type: "email-text";
  content: string;
  attributes: { "data-email-type": "email-text"; "data-placeholder": "1" };
} {
  return {
    type: "email-text",
    content: EMAIL_TEXT_PLACEHOLDER,
    attributes: {
      "data-email-type": "email-text",
      "data-placeholder": "1",
    },
  };
}

function emailTextPlain(comp: Component): string {
  const el = comp.getEl?.();
  const fromDom = (el?.textContent ?? "").replace(/\u00a0/g, " ").trim();
  if (fromDom) return fromDom;
  return toPlainText(String(comp.get("content") ?? ""), "").trim();
}

/**
 * True only for genuine empty starter blocks.
 * Flag alone is not enough — GrapesJS defaults used to stamp data-placeholder
 * onto loaded templates and wipe real content on click.
 */
export function isEmailTextPlaceholder(comp: Component): boolean {
  if (String(comp.getAttributes()?.["data-placeholder"] ?? "") !== "1") {
    return false;
  }
  const plain = emailTextPlain(comp);
  return plain.length === 0 || plain === EMAIL_TEXT_PLACEHOLDER;
}

/**
 * Grapes `removeAttributes` → `updateAttributes` → `__clearAttributes()` strips
 * contenteditable from the live RTE host. Re-stamp after any attribute mutation
 * that runs during / around RTE enable (rteEnabled may still be false).
 */
function restampHostContentEditable(
  comp: Component,
  force = false,
): void {
  const view = comp.getView?.() as
    | {
        el?: HTMLElement;
        rteEnabled?: boolean;
        getChildrenContainer?: () => HTMLElement;
      }
    | undefined;
  if (!force && !view?.rteEnabled) return;
  const host = view?.el ?? (comp.getEl?.() as HTMLElement | undefined);
  if (host) host.contentEditable = "true";
  const child = view?.getChildrenContainer?.();
  if (child && child !== host) child.contentEditable = "true";
}

/** Drop stale placeholder flag when the block already has real copy. */
export function healEmailTextPlaceholderFlag(comp: Component): void {
  if (String(comp.getAttributes()?.["data-placeholder"] ?? "") !== "1") return;
  if (isEmailTextPlaceholder(comp)) return;
  comp.removeAttributes("data-placeholder");
  restampHostContentEditable(comp, true);
}

function clearEmailTextPlaceholder(
  comp: Component,
  opts: { forceEditing?: boolean } = {},
): void {
  if (!isEmailTextPlaceholder(comp)) return;
  const view = comp.getView?.() as { rteEnabled?: boolean } | undefined;
  // rte:enable fires BEFORE toggleEvents sets rteEnabled — trust the caller flag
  const editing = Boolean(view?.rteEnabled) || Boolean(opts.forceEditing);

  // removeAttributes wipes contenteditable via Grapes __clearAttributes
  comp.removeAttributes("data-placeholder");

  if (editing) {
    // Mid-RTE: do not reset the component tree (extra attribute/content syncs).
    const el = comp.getEl?.() as HTMLElement | undefined;
    if (el) {
      el.innerHTML = "<br>";
      healRteContentEditable(el);
      el.contentEditable = "true";
    }
    try {
      comp.set("content", "", { silent: true } as object);
    } catch {
      comp.set("content", "");
    }
  } else {
    comp.components().reset();
    const el = comp.getEl?.();
    if (el) {
      el.innerHTML = "<br>";
      healRteContentEditable(el);
    }
    comp.set("content", "");
  }

  restampHostContentEditable(comp, true);
  queueMicrotask(() => restampHostContentEditable(comp, true));
  requestAnimationFrame(() => restampHostContentEditable(comp, true));
}

/** Apply plain text as a single textnode — never HTML-parse trait input (F-02). */
function setPlainTextComponents(
  model: {
    set: (k: string, v: unknown, opts?: { silent?: boolean }) => void;
    components: () => {
      reset: () => void;
      add: (c: { type: string; content: string }) => unknown;
    };
  },
  raw: string,
  fallback: string,
): void {
  const text = toPlainText(raw, fallback);
  model.set("content", text, { silent: true });
  model.components().reset();
  model.components().add({ type: "textnode", content: text });
}

function sanitizeHrefOnModel(model: Component): void {
  const current = String(model.getAttributes().href ?? "");
  const safe = sanitizeLinkUrl(current);
  if (safe !== current) {
    model.addAttributes({ href: safe });
  }
}

function wireLinkGuards(editor: Editor): void {
  const domc = editor.DomComponents;

  // RTE / paste inserts built-in `link` components — harden href on init+change
  domc.addType("link", {
    extend: "link",
    model: {
      init() {
        sanitizeHrefOnModel(this);
        this.on("change:attributes:href", () => sanitizeHrefOnModel(this));
      },
    },
  });

  editor.on("component:add", (model: Component) => {
    if (model.get("type") === "link") {
      sanitizeHrefOnModel(model);
    }
  });

  // After RTE edit: scrub dangerous handlers / javascript: URLs.
  // Never call model.components() on routine blur — style-normalization diffs
  // (e.g. "font-size:16px" → "font-size: 16px") rebuilt the DOM and left the
  // host in a dead “can select, can’t type” state on re-entry.
  editor.on("rte:disable", (view: { model?: Component; el?: HTMLElement }) => {
    const model = view?.model;
    if (!model) return;
    const type = model.get("type");
    if (type !== "email-text" && type !== "email-heading") return;

    const el = view.el;
    if (el) {
      const before = el.innerHTML;
      // Rebuild only when dangerous markup is present (avoid style-normalize churn)
      if (
        /on[a-z]+\s*=|javascript\s*:|<script\b|<iframe\b|<object\b|<embed\b/i.test(
          before,
        )
      ) {
        const after = sanitizeEmailHtml(before);
        if (after !== before) {
          model.components(after);
        }
      }
    }

    for (const link of model.findType("link")) {
      sanitizeHrefOnModel(link);
    }
  });

  // Link create/edit runs via RichTextController.applyLink (globalRte is not
  // ready at register time, so rteMod.add("link") was a silent no-op).
}

export function registerEmailComponents(editor: Editor): void {
  registerBrandColorTrait(editor);
  registerImageSrcTrait(editor);
  const domc = editor.DomComponents;

  // Stock GrapesJS text only opens RTE on dblclick. Bind click too;
  // canvas mousedown wire (below) is the hardened primary path.
  const textClickToEditView = {
    events() {
      return {
        click: "onClickEdit",
        dblclick: "onActive",
        input: "onInput",
      };
    },
    onClickEdit(ev: MouseEvent) {
      const t = ev.target;
      if (
        t instanceof Element &&
        t.closest?.(
          '[data-email-type="email-param"], [data-email-type="email-image"], [data-email-type="email-button"]',
        )
      ) {
        return;
      }
      const self = this as {
        model?: Component;
        onActive?: (e: MouseEvent) => void | Promise<void>;
      };
      const model = self.model;
      if (!model) return;
      // Already live: let the browser own caret / drag-select
      if (editor.getEditing() === model) return;
      // Go through Grapes onActive → setCustomRte.enable (official path)
      void self.onActive?.(ev);
    },
  };

  /** Block-level types that must never live inside email-text (kills click/select). */
  const BLOCK_TYPES_OUTSIDE_TEXT = new Set([
    "email-image",
    "email-button",
    "email-divider",
    "email-spacer",
    "email-heading",
    "email-legacy-html",
  ]);

  const childList = (parent: Component): Component[] => {
    const col = parent.components() as {
      forEach?: (cb: (c: Component) => void) => void;
      models?: Component[];
    };
    if (Array.isArray(col.models)) return [...col.models];
    const out: Component[] = [];
    if (typeof col.forEach === "function") col.forEach((c) => out.push(c));
    return out;
  };

  domc.addType("email-text", {
    extend: "text",
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-text",
    model: {
      defaults: {
        tagName: "div",
        attributes: {
          "data-email-type": "email-text",
        },
        // Allow param badges / links / textbaustein snippets into the block
        droppable: (src: Component) => isInlineParamDrop(src),
        editable: true,
        // Move only via component toolbar handle — not native HTML5 drag on body
        draggable: false,
        stylable: true,
        style: {
          padding: "8px 16px",
          "font-family": EMAIL_FONT_STACK,
          "font-size": "16px",
          color: "#171717",
          "line-height": "1.5",
        },
        content: "",
      },
      init() {
        // Never treat loaded/imported copy as an empty starter block.
        healEmailTextPlaceholderFlag(this);
        // Nested tags must stay inside ONE RTE host (email-text).
        // selectable:false → clicks hit the host; editable:true → no
        // contenteditable=false stamp that blocks typing in the host RTE.
        const ejectBlockKids = () => {
          const host = this as Component;
          const column = host.parent();
          if (!column || String(column.get("type") ?? "") !== "email-column") {
            return;
          }
          const trapped: Component[] = [];
          const collect = (parent: Component) => {
            for (const child of childList(parent)) {
              const type = String(child.get("type") ?? "");
              if (BLOCK_TYPES_OUTSIDE_TEXT.has(type)) {
                trapped.push(child);
                continue;
              }
              if (type === "email-param") continue;
              collect(child);
            }
          };
          collect(host);
          if (trapped.length === 0) return;
          let at =
            typeof host.index === "function" ? host.index() + 1 : undefined;
          for (const block of trapped) {
            try {
              if (typeof block.move === "function") {
                block.move(column, at != null ? { at } : undefined);
              } else {
                column.append(block, at != null ? { at } : undefined);
              }
              if (typeof at === "number") at += 1;
            } catch {
              // already detached / mid-sync
            }
          }
        };

        const flattenNestedTextHosts = () => {
          const host = this as Component;
          const nestedHosts: Component[] = [];
          for (const child of childList(host)) {
            const type = String(child.get("type") ?? "");
            if (type === "email-text" || type === "email-heading") {
              nestedHosts.push(child);
            }
          }
          for (const nested of nestedHosts) {
            const at =
              typeof nested.index === "function" ? nested.index() : undefined;
            const kids = childList(nested);
            const htmlContent = String(nested.get("content") ?? "");
            try {
              nested.remove();
            } catch {
              continue;
            }
            if (kids.length > 0) {
              let insertAt = at;
              for (const kid of kids) {
                try {
                  if (typeof kid.move === "function" && insertAt != null) {
                    kid.move(host, { at: insertAt });
                  } else {
                    host.append(kid, insertAt != null ? { at: insertAt } : undefined);
                  }
                  if (typeof insertAt === "number") insertAt += 1;
                } catch {
                  // mid-sync
                }
              }
            } else if (htmlContent.trim()) {
              try {
                host.components().add(htmlContent, at != null ? { at } : undefined);
              } catch {
                host.append(
                  { type: "textnode", content: htmlContent },
                  at != null ? { at } : undefined,
                );
              }
            }
          }
        };

        const lockKids = () => {
          ejectBlockKids();
          flattenNestedTextHosts();
          const walk = (parent: Component) => {
            for (const child of childList(parent)) {
              const type = String(child.get("type") ?? "");
              if (type === "email-param") continue;
              if (BLOCK_TYPES_OUTSIDE_TEXT.has(type)) continue;
              lockNestedTextChrome(child);
              walk(child);
            }
          };
          walk(this);
          // Heal DOM after model flags (Grapes may have stamped ce=false earlier)
          queueMicrotask(() => {
            healRteContentEditable(this.getEl?.() ?? undefined);
          });
        };
        lockKids();
        this.on("change:components", lockKids);
      },
    },
    view: textClickToEditView,
  });

  // Primary click-to-edit path (canvas mousedown + selection backup)
  wireCanvasTextClickToEdit(editor);

  // When the click lands on section/row/column chrome with a single text host,
  // promote selection into that host (RTE wire picks it up).
  const sectionRoleOf = (comp: Component): string =>
    String(
      comp.get("sectionRole") ??
        comp.getAttributes()?.["data-section-role"] ??
        comp.getAttributes()?.["data-role"] ??
        "",
    );

  const promoteToEditableText = (comp: Component): boolean => {
    const type = String(comp.get("type") ?? "");
    if (type === "email-text" || type === "email-heading") return false;
    if (type === "email-param") return false;
    if (
      type !== "email-section" &&
      type !== "email-row" &&
      type !== "email-column"
    ) {
      return false;
    }
    if (type === "email-section") {
      const role = sectionRoleOf(comp);
      if (role === "header" || role === "footer" || role === "social") {
        return false;
      }
    }
    if (isInsideLockedChrome(comp)) return false;

    const texts = comp.findType("email-text");
    const headings = comp.findType("email-heading");
    const images = comp.findType("email-image");
    const buttons = comp.findType("email-button");
    if (images.length > 0 || buttons.length > 0) return false;
    if (texts.length + headings.length !== 1) return false;
    const target = (texts[0] ?? headings[0]) as Component | undefined;
    if (!target || target === comp) return false;
    editor.select(target);
    return true;
  };

  const onContainerSelect = (comp: Component) => {
    if (!comp) return;
    if (promoteToEditableText(comp)) return;

    // Nested markup inside email-text → select RTE host
    if (String(comp.get("type") ?? "") === "email-param") return;
    let node: Component | undefined = comp;
    for (let i = 0; i < 8 && node; i += 1) {
      const type = String(node.get("type") ?? "");
      if (type === "email-text" || type === "email-heading") return;
      const parent = node.parent();
      if (!parent) return;
      if (
        String(parent.get("type") ?? "") === "email-text" ||
        String(parent.get("type") ?? "") === "email-heading"
      ) {
        editor.select(parent);
        return;
      }
      node = parent;
    }
  };

  editor.on("component:selected", onContainerSelect);
  editor.on("component:select", onContainerSelect);

  editor.on("rte:enable", (view: { model?: Component; el?: HTMLElement }) => {
    healRteContentEditable(view?.el);
    const model = view?.model;
    if (model && String(model.get("type") ?? "") === "email-text") {
      healEmailTextPlaceholderFlag(model);
      if (isEmailTextPlaceholder(model)) {
        // forceEditing: this event runs before view.rteEnabled is set
        clearEmailTextPlaceholder(model, { forceEditing: true });
      }
    }
    // Grapes __clearAttributes may have wiped CE during the handlers above
    if (view?.el) view.el.contentEditable = "true";
    queueMicrotask(() => {
      if (view?.el) view.el.contentEditable = "true";
    });
  });
  editor.on("component:add", (comp: Component) => {
    if (String(comp.get("type") ?? "") !== "email-text") return;
    healEmailTextPlaceholderFlag(comp);
  });

  domc.addType("email-heading", {
    extend: "text",
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-heading",
    model: {
      defaults: {
        tagName: "h2",
        attributes: { "data-email-type": "email-heading" },
        droppable: (src: Component) => isInlineParamDrop(src),
        editable: true,
        draggable: false,
        stylable: true,
        style: {
          padding: "8px 16px",
          margin: "0",
          "font-family": EMAIL_FONT_STACK,
          "font-size": "24px",
          color: "#171717",
        },
        content: "Überschrift",
      },
    },
    view: textClickToEditView,
  });

  domc.addType("email-image", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-image",
    model: {
      defaults: {
        tagName: "img",
        void: true,
        attributes: {
          "data-email-type": "email-image",
          "data-placeholder": "1",
          src: PLACEHOLDER_IMG,
          alt: "Bild",
          width: "600",
        },
        droppable: false,
        selectable: true,
        hoverable: true,
        highlightable: true,
        imageAlign: "center",
        style: {
          display: "block",
          width: "100%",
          "max-width": "100%",
          height: "auto",
          "min-height": "48px",
          "border-radius": "12px",
        },
        traits: [
          {
            type: "image-src",
            name: "src",
            label: "Bild",
          },
          {
            type: "text",
            name: "alt",
            label: "Alt-Text",
          },
          {
            type: "select",
            name: "imageAlign",
            label: "Ausrichtung",
            changeProp: true,
            options: [
              { id: "left", name: "Links" },
              { id: "center", name: "Mitte" },
              { id: "right", name: "Rechts" },
              { id: "full", name: "Volle Breite" },
            ],
          },
        ],
      },
      init() {
        /** Prefer HTML width attr (Brevo logos 200/229px) — never clobber with width:auto. */
        const syncWidthFromAttr = () => {
          if (String(this.get("imageAlign") ?? "center") === "full") return;
          const attrs = this.getAttributes() ?? {};
          let raw = attrs.width;
          const role = String(attrs["data-role"] ?? "");
          // Recover brand chrome if a prior align pass wiped the width attr
          if (
            (raw == null || String(raw).trim() === "") &&
            role === "brand-logo"
          ) {
            raw = "200";
            this.addAttributes({ width: "200" });
          }
          if (
            (raw == null || String(raw).trim() === "") &&
            role === "certifications"
          ) {
            raw = "270";
            this.addAttributes({ width: "270" });
          }
          if (raw == null || String(raw).trim() === "") return;
          const n = Number.parseInt(String(raw), 10);
          if (!Number.isFinite(n) || n <= 0) return;
          this.addStyle({
            width: `${n}px`,
            "max-width": "100%",
            height: "auto",
          });
        };

        const applyAlign = () => {
          const align = String(this.get("imageAlign") ?? "center");
          // Never leave HTML align= / float — browsers float left/right imgs
          // and wrap siblings (footer company name beside wide logos).
          this.removeAttributes("align");
          if (align === "full") {
            this.addStyle({
              display: "block",
              float: "none",
              width: "100%",
              "max-width": "100%",
              height: "auto",
              "margin-left": "0",
              "margin-right": "0",
            });
          } else if (align === "left") {
            // Only margins — keep explicit px width from attr/style (header logo).
            this.addStyle({
              display: "block",
              float: "none",
              height: "auto",
              "max-width": "100%",
              "margin-left": "0",
              "margin-right": "auto",
            });
            syncWidthFromAttr();
          } else if (align === "right") {
            this.addStyle({
              display: "block",
              float: "none",
              height: "auto",
              "max-width": "100%",
              "margin-left": "auto",
              "margin-right": "0",
            });
            syncWidthFromAttr();
          } else {
            this.addStyle({
              display: "block",
              float: "none",
              height: "auto",
              "max-width": "100%",
              "margin-left": "auto",
              "margin-right": "auto",
            });
            syncWidthFromAttr();
          }
          this.addAttributes({ "data-align": align });
        };

        const initialSrc = String(this.getAttributes().src ?? "");
        const safeSrc = sanitizeImageUrl(initialSrc, PLACEHOLDER_IMG);
        // Upgrade legacy placehold.co starters to the premium SVG invite.
        const nextSrc =
          isEmailImagePlaceholderSrc(safeSrc) && safeSrc !== PLACEHOLDER_IMG
            ? PLACEHOLDER_IMG
            : safeSrc;
        if (nextSrc !== initialSrc) {
          this.addAttributes({ src: nextSrc });
        }
        const phFlag = syncEmailImagePlaceholderFlag(
          String(this.getAttributes().src ?? nextSrc),
        );
        if (phFlag["data-placeholder"] === "1") {
          this.addAttributes({ "data-placeholder": "1" });
          this.addStyle({ "border-radius": "12px" });
        } else {
          this.removeAttributes("data-placeholder");
          this.addStyle({ "border-radius": "0" });
        }
        const initialAlt = String(this.getAttributes().alt ?? "");
        const safeAlt = sanitizeAltText(initialAlt, "Bild");
        if (safeAlt !== initialAlt) {
          this.addAttributes({ alt: safeAlt });
        }

        const htmlAlign = this.getAttributes()?.align;
        const attrAlign =
          this.getAttributes()?.["data-align"] ?? htmlAlign;
        if (attrAlign && !this.get("imageAlign")) {
          this.set("imageAlign", String(attrAlign), { silent: true });
        }

        applyAlign();
        this.on("change:imageAlign", applyAlign);
        this.on("change:attributes:width", syncWidthFromAttr);
        this.on("change:attributes:src", () => {
          const current = String(this.getAttributes().src ?? "");
          const safe = sanitizeImageUrl(current, PLACEHOLDER_IMG);
          if (safe !== current) {
            this.addAttributes({ src: safe });
          }
          const next = String(this.getAttributes().src ?? safe);
          if (isEmailImagePlaceholderSrc(next)) {
            this.addAttributes({ "data-placeholder": "1" });
            this.addStyle({ "border-radius": "12px" });
          } else {
            this.removeAttributes("data-placeholder");
            this.addStyle({ "border-radius": "0" });
          }
        });
        this.on("change:attributes:alt", () => {
          const current = String(this.getAttributes().alt ?? "");
          const safe = sanitizeAltText(current, "Bild");
          if (safe !== current) {
            this.addAttributes({ alt: safe });
          }
        });
      },
    },
  });

  domc.addType("email-button", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-button",
    model: {
      defaults: {
        tagName: "a",
        attributes: {
          "data-email-type": "email-button",
          href: "https://example.com",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        droppable: (src: Component) => isInlineParamDrop(src),
        // Label via RTE (double-click); href/colors/align via traits
        editable: true,
        textable: true,
        backgroundColor: EMAIL_COLORS.primary,
        color: "#ffffff",
        buttonAlign: "left",
        style: {
          display: "inline-block",
          // CTA sizing: readable in 600px preview (old 12/24 + 120px looked tiny)
          padding: "16px 32px",
          "background-color": EMAIL_COLORS.primary,
          color: "#ffffff",
          "text-decoration": "none",
          "border-radius": "4px",
          "font-family": EMAIL_FONT_STACK,
          "font-size": "18px",
          "font-weight": "600",
          "line-height": "1.25",
          "text-align": "center",
          "min-width": "200px",
          "box-sizing": "border-box",
        },
        content: "Button",
        traits: [
          {
            type: "text",
            name: "href",
            label: "Link-URL",
          },
          {
            type: "text",
            name: "content",
            label: "Button-Text",
            changeProp: true,
          },
          {
            type: "brand-color",
            name: "backgroundColor",
            label: "Hintergrund",
            changeProp: true,
          },
          {
            type: "brand-color",
            name: "color",
            label: "Textfarbe",
            changeProp: true,
          },
          {
            type: "select",
            name: "buttonAlign",
            label: "Ausrichtung",
            changeProp: true,
            options: [
              { id: "left", name: "Links" },
              { id: "center", name: "Mitte" },
              { id: "right", name: "Rechts" },
            ],
          },
        ],
      },
      init() {
        const applyColors = () => {
          const bg = String(
            this.get("backgroundColor") ??
              this.getStyle()?.["background-color"] ??
              EMAIL_COLORS.primary,
          );
          const fg = String(
            this.get("color") ?? this.getStyle()?.color ?? "#ffffff",
          );
          this.addStyle({
            "background-color": bg,
            color: fg,
          });
          // Keep props in sync when style was loaded from project JSON
          if (!this.get("backgroundColor")) {
            this.set("backgroundColor", bg, { silent: true });
          }
          if (!this.get("color")) {
            this.set("color", fg, { silent: true });
          }
        };
        // Email-safe placement: display:table + auto margins (works in columns)
        const applyAlign = () => {
          const align = String(this.get("buttonAlign") ?? "left");
          if (align === "center") {
            this.addStyle({
              display: "table",
              "margin-left": "auto",
              "margin-right": "auto",
            });
          } else if (align === "right") {
            this.addStyle({
              display: "table",
              "margin-left": "auto",
              "margin-right": "0",
            });
          } else {
            this.addStyle({
              display: "inline-block",
              "margin-left": "0",
              "margin-right": "0",
            });
          }
          this.addAttributes({ "data-align": align });
        };

        const initialHref = String(this.getAttributes().href ?? "");
        const safeHref = sanitizeLinkUrl(initialHref);
        if (safeHref !== initialHref) {
          this.addAttributes({ href: safeHref });
        }
        // Seed props from existing inline styles (imported / older projects)
        const styleBg = this.getStyle()?.["background-color"];
        const styleFg = this.getStyle()?.color;
        if (styleBg && !this.get("backgroundColor")) {
          this.set("backgroundColor", String(styleBg), { silent: true });
        }
        if (styleFg && !this.get("color")) {
          this.set("color", String(styleFg), { silent: true });
        }
        const attrAlign = this.getAttributes()?.["data-align"];
        if (attrAlign && !this.get("buttonAlign")) {
          this.set("buttonAlign", String(attrAlign), { silent: true });
        }

        // Upgrade stock compact CTAs from older defaults (preview looked tiny)
        const styleNow = this.getStyle() ?? {};
        const pad = String(styleNow.padding ?? "")
          .replace(/\s+/g, " ")
          .trim();
        const fs = String(styleNow["font-size"] ?? "").trim();
        const mw = String(styleNow["min-width"] ?? "").trim();
        if (
          pad === "12px 24px" &&
          (fs === "16px" || fs === "") &&
          (mw === "120px" || mw === "")
        ) {
          this.addStyle({
            padding: "16px 32px",
            "font-size": "18px",
            "line-height": "1.25",
            "min-width": "200px",
          });
        }

        // Only seed children when empty — keep RTE edits
        const kids = this.components();
        if (!kids.length) {
          setPlainTextComponents(
            this,
            String(this.get("content") ?? ""),
            "Button",
          );
        }
        applyColors();
        applyAlign();

        this.on("change:attributes:href", () => {
          const current = String(this.getAttributes().href ?? "");
          const safe = sanitizeLinkUrl(current);
          if (safe !== current) {
            this.addAttributes({ href: safe });
          }
        });
        this.on("change:content", () => {
          const raw = String(this.get("content") ?? "");
          setPlainTextComponents(this, raw, "Button");
        });
        this.on("change:backgroundColor change:color", applyColors);
        this.on("change:buttonAlign", applyAlign);
      },
    },
  });

  domc.addType("email-divider", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-divider",
    model: {
      defaults: {
        tagName: "hr",
        void: true,
        attributes: { "data-email-type": "email-divider" },
        droppable: false,
        style: {
          border: "none",
          "border-top": "1px solid #c5d0cb",
          margin: "16px",
        },
      },
    },
  });

  domc.addType("email-spacer", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-spacer",
    model: {
      defaults: {
        tagName: "div",
        attributes: { "data-email-type": "email-spacer" },
        droppable: false,
        style: {
          height: "24px",
          "font-size": "0",
          "line-height": "0",
        },
        content: "&nbsp;",
        traits: [
          {
            type: "number",
            name: "height",
            label: "Höhe (px)",
            changeProp: true,
            min: 4,
            max: 120,
          },
        ],
      },
      init() {
        this.on("change:height", () => {
          const h = this.get("height") as number | undefined;
          if (typeof h === "number") {
            this.addStyle({ height: `${h}px` });
          }
        });
      },
    },
  });

  // Unrecognized Brevo/HTML fragments — preserve, do not drop (I-01)
  domc.addType("email-legacy-html", {
    isComponent: (el) =>
      el.getAttribute?.("data-email-type") === "email-legacy-html",
    model: {
      defaults: {
        tagName: "div",
        attributes: { "data-email-type": "email-legacy-html" },
        droppable: false,
        editable: false,
        stylable: false,
        content: "",
        traits: [
          {
            type: "text",
            name: "content",
            label: "HTML (Legacy)",
            changeProp: true,
          },
        ],
      },
      init() {
        this.on("change:content", () => {
          const raw = String(this.get("content") ?? "");
          const safe = sanitizeEmailHtml(raw);
          if (safe !== raw) {
            this.set("content", safe, { silent: true });
          }
          const el = this.getEl();
          if (el) el.innerHTML = String(this.get("content") ?? "");
        });
      },
      toHTML() {
        return sanitizeEmailHtml(String(this.get("content") ?? ""));
      },
    },
    view: {
      onRender({ el, model }) {
        el.innerHTML = sanitizeEmailHtml(String(model.get("content") ?? ""));
        el.setAttribute("data-legacy", "1");
      },
    },
  });

  registerLayoutComponents(editor);

  // Legacy multi-column wrappers (old imports) — still recognized
  for (const cols of [1, 2, 3] as const) {
    const type = `email-columns-${cols}`;
    const width = Math.floor(100 / cols);
    domc.addType(type, {
      isComponent: (el) => el.getAttribute?.("data-email-type") === type,
      model: {
        defaults: {
          tagName: "table",
          name: `${cols} Spalten`,
          attributes: {
            "data-email-type": type,
            width: "100%",
            cellpadding: "0",
            cellspacing: "0",
            border: "0",
          },
          droppable: false,
          components: [
            {
              type: "email-row",
              components: Array.from({ length: cols }, () => ({
                type: "email-column",
                columnWidth: width,
                attributes: { width: `${width}%` },
                components: [],
              })),
            },
          ],
        },
      },
    });
  }

  registerEmailParamComponent(editor);
  wireLinkGuards(editor);
  // Legacy composite — still loadable; new imports use email-section role=header
  registerEmailHeaderComponent(editor);
  registerCorporateComponents(editor);

  const bm = editor.BlockManager;
  bm.getAll().reset();

  for (const def of EMAIL_COMPONENTS) {
    let content: object = { type: def.type };
    if (def.type === "email-text") content = emptyEmailTextBlock();
    else if (def.type === "email-section-header") content = headerSectionContent();
    else if (def.type === "email-section-footer") content = footerSectionContent();
    else if (def.type === "email-section-social") content = socialSectionContent();
    else if (def.type === "email-section") {
      content = {
        type: "email-section",
        sectionRole: "content",
        attributes: { "data-role": "content", "data-section-role": "content" },
      };
    } else if (def.type === "email-columns-1") content = columnsSectionContent(1);
    else if (def.type === "email-columns-2") content = columnsSectionContent(2);
    else if (def.type === "email-columns-3") content = columnsSectionContent(3);

    bm.add(def.type, {
      label: def.label,
      category: {
        id: def.category,
        label: def.categoryLabel,
        open: def.category === "content",
      },
      content: content as { type: string },
      media: blockMedia(def.type, def.label),
    });
  }
}
