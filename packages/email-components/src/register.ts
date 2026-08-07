/**
 * Register email-safe GrapesJS component types + DE block library.
 * Location: packages/email-components/src/register.ts
 * Hides: GrapesJS DomComponents / BlockManager wiring for email blocks.
 */

import type { Component, Editor } from "grapesjs";
import { registerCorporateComponents } from "./corporate.js";
import { sanitizeEmailHtml } from "./html.js";
import { EMAIL_COMPONENTS } from "./registry.js";
import { escapeHtml, sanitizeAltText, toPlainText } from "./text.js";
import {
  isAllowedLinkUrl,
  sanitizeImageUrl,
  sanitizeLinkUrl,
} from "./urls.js";

const PLACEHOLDER_IMG =
  "https://placehold.co/600x200/eef2f0/5c6b66?text=Bild";

function columnCell(inner = '<div data-gjs-type="email-text">Spalte</div>'): string {
  return `<td valign="top" style="padding:8px;vertical-align:top;">${inner}</td>`;
}

function columnsTable(cols: 1 | 2 | 3): string {
  const cells = Array.from({ length: cols }, () => columnCell()).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>${cells}</tr></table>`;
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

  // Prompt-based RTE link action: reject disallowed protocols before insert
  const rteMod = editor.RichTextEditor;
  const prev = rteMod.get("link");
  rteMod.add("link", {
    icon: prev?.icon ?? '<span style="font-weight:700">L</span>',
    attributes: { ...(prev?.attributes ?? {}), title: "Link" },
    result: (rte) => {
      const sel = rte.selection();
      const selectedText =
        sel && typeof sel.toString === "function" ? sel.toString().trim() : "";
      const selected = selectedText || "Link";
      const input = window.prompt(
        "Link-URL (https, mailto, tel)",
        "https://",
      );
      if (input == null) return;
      const trimmed = input.trim();
      if (!isAllowedLinkUrl(trimmed)) {
        window.alert(
          "Ungültige URL. Erlaubt sind nur http, https, mailto und tel.",
        );
        return;
      }
      const href = sanitizeLinkUrl(trimmed);
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
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-text",
    model: {
      defaults: {
        tagName: "div",
        attributes: { "data-email-type": "email-text" },
        droppable: false,
        editable: true,
        style: {
          padding: "8px 16px",
          "font-family": "Arial, Helvetica, sans-serif",
          "font-size": "16px",
          color: "#14201c",
          "line-height": "1.5",
        },
        content: "Text hier eingeben…",
      },
    },
  });

  domc.addType("email-heading", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-heading",
    model: {
      defaults: {
        tagName: "h2",
        attributes: { "data-email-type": "email-heading" },
        droppable: false,
        editable: true,
        style: {
          padding: "8px 16px",
          margin: "0",
          "font-family": "Arial, Helvetica, sans-serif",
          "font-size": "24px",
          color: "#14201c",
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
        droppable: false,
        // Canvas RTE can inject markup — prefer trait + textnode for label
        editable: false,
        style: {
          display: "inline-block",
          padding: "12px 24px",
          "background-color": "#1a5f4a",
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

  domc.addType("email-section", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-section",
    model: {
      defaults: {
        tagName: "table",
        attributes: {
          "data-email-type": "email-section",
          width: "100%",
          cellpadding: "0",
          cellspacing: "0",
          border: "0",
        },
        droppable: true,
        style: {
          width: "100%",
          "border-collapse": "collapse",
          "background-color": "#ffffff",
        },
        components: `
          <tbody>
            <tr>
              <td style="padding:16px;" data-gjs-droppable="true">
                <div data-gjs-type="email-text">Section-Inhalt</div>
              </td>
            </tr>
          </tbody>
        `,
      },
    },
  });

  for (const cols of [1, 2, 3] as const) {
    const type = `email-columns-${cols}`;
    domc.addType(type, {
      isComponent: (el) => el.getAttribute?.("data-email-type") === type,
      model: {
        defaults: {
          tagName: "div",
          attributes: { "data-email-type": type },
          droppable: false,
          components: columnsTable(cols),
        },
      },
    });
  }

  wireLinkGuards(editor);
  registerCorporateComponents(editor);

  const bm = editor.BlockManager;
  bm.getAll().reset();

  for (const def of EMAIL_COMPONENTS) {
    bm.add(def.type, {
      label: def.label,
      category: {
        id: def.category,
        label: def.categoryLabel,
        open: def.category === "content",
      },
      content: { type: def.type },
      media: `<div style="padding:8px;font-size:12px;text-align:center;">${def.label}</div>`,
    });
  }
}
