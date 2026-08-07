/**
 * Register email-safe GrapesJS component types + DE block library.
 * Location: packages/email-components/src/register.ts
 * Hides: GrapesJS DomComponents / BlockManager wiring for email blocks.
 */

import type { Component, Editor } from "grapesjs";
import { blockMedia } from "./blockIcons.js";
import { registerCorporateComponents } from "./corporate.js";
import { registerEmailHeaderComponent } from "./header.js";
import { sanitizeEmailHtml } from "./html.js";
import {
  footerSectionContent,
  headerSectionContent,
  registerLayoutComponents,
  socialSectionContent,
} from "./layout.js";
import {
  isInlineParamDrop,
  registerEmailParamComponent,
} from "./param.js";
import { EMAIL_COMPONENTS } from "./registry.js";
import { escapeHtml, sanitizeAltText, toPlainText } from "./text.js";
import {
  isAllowedLinkUrl,
  sanitizeImageUrl,
  sanitizeLinkUrl,
} from "./urls.js";

const PLACEHOLDER_IMG =
  "https://placehold.co/600x200/dfecf8/275073?text=Bild";

function columnsSectionContent(cols: 1 | 2 | 3): object {
  const width = Math.floor(100 / cols);
  return {
    type: "email-section",
    sectionRole: "content",
    attributes: { "data-role": "content", "data-section-role": "content" },
    components: [
      {
        type: "email-row",
        components: Array.from({ length: cols }, () => ({
          type: "email-column",
          columnWidth: width,
          attributes: { width: `${width}%` },
          components: [{ type: "email-text", content: "Spalte" }],
        })),
      },
    ],
  };
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

  // After RTE edit: scrub pasted handlers / javascript: URLs in text blocks
  editor.on("rte:disable", (view: { model?: Component; el?: HTMLElement }) => {
    const model = view?.model;
    if (!model) return;
    const type = model.get("type");
    if (type !== "email-text" && type !== "email-heading") return;

    const el = view.el;
    if (el) {
      const before = el.innerHTML;
      const after = sanitizeEmailHtml(before);
      if (after !== before) {
        model.components(after);
      }
    }

    for (const link of model.findType("link")) {
      sanitizeHrefOnModel(link);
    }
  });

  // Prompt-based RTE link action: edit existing / create / unlink (empty = unlink)
  const rteMod = editor.RichTextEditor;
  const prev = rteMod.get("link");
  rteMod.add("link", {
    icon: prev?.icon ?? '<span style="font-weight:700">L</span>',
    attributes: { ...(prev?.attributes ?? {}), title: "Link" },
    result: (rte) => {
      const sel = rte.selection();
      const anchorNode =
        sel?.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as Element)
          : sel?.anchorNode?.parentElement ?? null;
      const existingA = anchorNode?.closest?.("a") ?? null;
      const currentHref = existingA?.getAttribute("href") ?? "https://";

      const input = window.prompt(
        existingA
          ? "Link-URL bearbeiten (leer = Link entfernen)"
          : "Link-URL (https, mailto, tel)",
        currentHref,
      );
      if (input == null) return;
      const trimmed = input.trim();

      if (!trimmed) {
        if (existingA) rte.exec("unlink");
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
        return;
      }
      const selectedText =
        sel && typeof sel.toString === "function" ? sel.toString().trim() : "";
      const selected = selectedText || "Link";
      const label = escapeHtml(toPlainText(selected, "Link"));
      rte.insertHTML(
        `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`,
      );
    },
  });
}

export function registerEmailComponents(editor: Editor): void {
  const domc = editor.DomComponents;

  domc.addType("email-text", {
    extend: "text",
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-text",
    model: {
      defaults: {
        tagName: "div",
        attributes: { "data-email-type": "email-text" },
        // Allow param badges / links to be dropped into the block
        droppable: (src: Component) => isInlineParamDrop(src),
        editable: true,
        stylable: true,
        style: {
          padding: "8px 16px",
          "font-family": "Arial, Helvetica, sans-serif",
          "font-size": "16px",
          color: "#171717",
          "line-height": "1.5",
        },
        content: "Text hier eingeben…",
      },
      init() {
        // Nested tags must not become their own contenteditable (double caret)
        const lockKids = () => {
          const col = this.components() as {
            forEach?: (cb: (c: Component) => void) => void;
            models?: Component[];
          };
          const apply = (child: Component) => {
            if (String(child.get("type") ?? "") === "email-param") return;
            child.set({ editable: false, textable: true });
          };
          if (typeof col.forEach === "function") {
            col.forEach(apply);
            return;
          }
          for (const child of col.models ?? []) apply(child);
        };
        lockKids();
        this.on("change:components", lockKids);
      },
    },
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
        stylable: true,
        style: {
          padding: "8px 16px",
          margin: "0",
          "font-family": "Arial, Helvetica, sans-serif",
          "font-size": "24px",
          color: "#171717",
        },
        content: "Überschrift",
      },
    },
  });

  domc.addType("email-image", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-image",
    model: {
      defaults: {
        tagName: "img",
        void: true,
        attributes: {
          "data-email-type": "email-image",
          src: PLACEHOLDER_IMG,
          alt: "Bild",
        },
        droppable: false,
        style: {
          display: "block",
          "max-width": "100%",
          height: "auto",
        },
        traits: [
          {
            type: "text",
            name: "src",
            label: "Bild-URL (https)",
          },
          {
            type: "text",
            name: "alt",
            label: "Alt-Text",
          },
        ],
      },
      init() {
        const initialSrc = String(this.getAttributes().src ?? "");
        const safeSrc = sanitizeImageUrl(initialSrc, PLACEHOLDER_IMG);
        if (safeSrc !== initialSrc) {
          this.addAttributes({ src: safeSrc });
        }
        const initialAlt = String(this.getAttributes().alt ?? "");
        const safeAlt = sanitizeAltText(initialAlt, "Bild");
        if (safeAlt !== initialAlt) {
          this.addAttributes({ alt: safeAlt });
        }
        this.on("change:attributes:src", () => {
          const current = String(this.getAttributes().src ?? "");
          const safe = sanitizeImageUrl(current, PLACEHOLDER_IMG);
          if (safe !== current) {
            this.addAttributes({ src: safe });
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
        // Canvas RTE can inject markup — prefer trait + textnode for label
        editable: false,
        style: {
          display: "inline-block",
          padding: "12px 24px",
          "background-color": "#275073",
          color: "#ffffff",
          "text-decoration": "none",
          "border-radius": "4px",
          "font-family": "Arial, Helvetica, sans-serif",
          "font-size": "16px",
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
        ],
      },
      init() {
        const initialHref = String(this.getAttributes().href ?? "");
        const safeHref = sanitizeLinkUrl(initialHref);
        if (safeHref !== initialHref) {
          this.addAttributes({ href: safeHref });
        }
        setPlainTextComponents(
          this,
          String(this.get("content") ?? ""),
          "Button",
        );
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
                components: [{ type: "email-text", content: "Spalte" }],
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
    if (def.type === "email-section-header") content = headerSectionContent();
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
