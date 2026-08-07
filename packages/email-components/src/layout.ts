/**
 * GrapesJS layout: email-section / email-row / email-column (containers, not leafs).
 * Location: packages/email-components/src/layout.ts
 */

import type { Component, Editor } from "grapesjs";

const CONTENT_TYPES = new Set([
  "email-text",
  "email-heading",
  "email-image",
  "email-button",
  "email-divider",
  "email-spacer",
  "email-param",
  "company-social",
  "email-legacy-html",
  "text",
  "link",
]);

function isType(comp: Component, type: string): boolean {
  return String(comp.get("type") ?? "") === type;
}

function acceptsColumn(src: Component): boolean {
  return isType(src, "email-column");
}

function acceptsRow(src: Component): boolean {
  return isType(src, "email-row");
}

function acceptsContent(src: Component): boolean {
  const t = String(src.get("type") ?? "");
  if (CONTENT_TYPES.has(t)) return true;
  // Allow dropping a column's children when moving blocks
  if (t === "email-column" || t === "email-row" || t === "email-section") {
    return false;
  }
  return Boolean(src.get("textable") || src.get("editable"));
}

const ROLE_LABELS: Record<string, string> = {
  header: "Header",
  footer: "Footer",
  social: "Social Media",
  content: "Inhalt",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? "Inhalt";
}

function lockChrome(model: Component): void {
  // Hide technical table chrome from layers/selection where possible
  const walk = (c: Component) => {
    const tag = String(c.get("tagName") ?? "").toLowerCase();
    const type = String(c.get("type") ?? "");
    if (
      !type.startsWith("email-") &&
      !type.startsWith("company-") &&
      (tag === "tbody" || tag === "thead" || tag === "tfoot")
    ) {
      c.set({
        selectable: false,
        hoverable: false,
        highlightable: false,
        layerable: false,
      });
    }
    const kids = c.components();
    kids.forEach((child: Component) => walk(child));
  };
  walk(model);
}

export function registerLayoutComponents(editor: Editor): void {
  const domc = editor.DomComponents;

  domc.addType("email-column", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-column",
    model: {
      defaults: {
        tagName: "td",
        name: "Spalte",
        droppable: (src: Component) => acceptsContent(src),
        draggable: "[data-email-type=email-row]",
        attributes: {
          "data-email-type": "email-column",
          valign: "top",
          width: "100%",
        },
        style: {
          width: "100%",
          "vertical-align": "top",
          padding: "8px",
        },
        traits: [
          {
            type: "number",
            name: "columnWidth",
            label: "Breite (%)",
            changeProp: true,
            min: 10,
            max: 100,
          },
        ],
      },
      init() {
        const syncWidth = () => {
          const w = Number(this.get("columnWidth"));
          if (Number.isFinite(w) && w > 0) {
            this.addAttributes({ width: `${w}%` });
            this.addStyle({ width: `${w}%` });
          }
        };
        const attrW = this.getAttributes()?.width;
        if (attrW && !this.get("columnWidth")) {
          const n = Number.parseInt(String(attrW), 10);
          if (Number.isFinite(n)) this.set("columnWidth", n, { silent: true });
        }
        this.on("change:columnWidth", syncWidth);
      },
    },
  });

  domc.addType("email-row", {
    isComponent: (el) => el.getAttribute?.("data-email-type") === "email-row",
    model: {
      defaults: {
        tagName: "tr",
        name: "Zeile",
        droppable: (src: Component) => acceptsColumn(src),
        draggable: "[data-email-type=email-section]",
        attributes: { "data-email-type": "email-row" },
        components: [
          {
            type: "email-column",
            components: [{ type: "email-text", content: " " }],
          },
        ],
      },
    },
  });

  domc.addType("email-section", {
    isComponent: (el) => {
      if (el.getAttribute?.("data-email-type") !== "email-section") {
        return false;
      }
      const role =
        el.getAttribute("data-section-role") ||
        el.getAttribute("data-role") ||
        "content";
      return {
        type: "email-section",
        sectionRole: role,
      };
    },
    model: {
      defaults: {
        tagName: "table",
        name: "Inhalt",
        droppable: (src: Component) => acceptsRow(src),
        draggable: true,
        attributes: {
          "data-email-type": "email-section",
          "data-role": "content",
          "data-section-role": "content",
          width: "100%",
          cellpadding: "0",
          cellspacing: "0",
          border: "0",
        },
        style: {
          width: "100%",
          "max-width": "100%",
          "table-layout": "fixed",
          "border-collapse": "collapse",
          "background-color": "#ffffff",
        },
        sectionRole: "content",
        sectionPadding: "16px",
        traits: [
          {
            type: "select",
            name: "sectionRole",
            label: "Rolle",
            changeProp: true,
            options: [
              { id: "header", label: "Header" },
              { id: "content", label: "Inhalt" },
              { id: "footer", label: "Footer" },
              { id: "social", label: "Social Media" },
            ],
          },
          {
            type: "color",
            name: "backgroundColor",
            label: "Hintergrund",
            changeProp: true,
          },
          {
            type: "text",
            name: "sectionPadding",
            label: "Padding",
            changeProp: true,
          },
        ],
        components: [
          {
            type: "email-row",
            components: [
              {
                type: "email-column",
                components: [
                  { type: "email-text", content: "Section-Inhalt" },
                ],
              },
            ],
          },
        ],
      },
      init() {
        const applyRole = () => {
          const role =
            String(this.get("sectionRole") ?? "") ||
            String(this.getAttributes()?.["data-section-role"] ?? "") ||
            String(this.getAttributes()?.["data-role"] ?? "content");
          this.addAttributes({
            "data-role": role,
            "data-section-role": role,
          });
          this.set("name", roleLabel(role), { silent: true });
          this.set("sectionRole", role, { silent: true });
        };
        const applyChrome = () => {
          const pad = String(this.get("sectionPadding") ?? "16px");
          const bg =
            String(this.get("backgroundColor") ?? "") ||
            String(this.getStyle()?.["background-color"] ?? "");
          this.addStyle({
            width: "100%",
            "max-width": "100%",
            "table-layout": "fixed",
          });
          if (bg) this.addStyle({ "background-color": bg });
          // Apply padding to columns
          this.findType("email-column").forEach((col: Component) => {
            col.addStyle({ padding: pad });
          });
        };
        // Seed role from attribute / isComponent prop
        const attrRole =
          this.getAttributes()?.["data-section-role"] ||
          this.getAttributes()?.["data-role"];
        if (attrRole && !this.get("sectionRole")) {
          this.set("sectionRole", String(attrRole), { silent: true });
        }
        applyRole();
        applyChrome();
        lockChrome(this);
        this.on("change:sectionRole", applyRole);
        this.on("change:sectionPadding change:backgroundColor", applyChrome);
        this.on("change:components", () => lockChrome(this));
      },
    },
  });
}

/** Default empty header structure for palette. */
export function headerSectionContent(): object {
  return {
    type: "email-section",
    sectionRole: "header",
    attributes: { "data-role": "header", "data-section-role": "header" },
    name: "Header",
    sectionPadding: "20px 16px 40px 16px",
    components: [
      {
        type: "email-row",
        components: [
          {
            type: "email-column",
            components: [
              {
                type: "email-image",
                attributes: {
                  src: "https://placehold.co/200x64/275073/ffffff?text=Logo",
                  alt: "Logo",
                  width: "200",
                  "data-role": "brand-logo",
                  align: "center",
                },
                style: {
                  width: "200px",
                  "max-width": "100%",
                  display: "block",
                  margin: "0 auto",
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Default empty footer structure (50/50). */
export function footerSectionContent(): object {
  return {
    type: "email-section",
    sectionRole: "footer",
    attributes: { "data-role": "footer", "data-section-role": "footer" },
    name: "Footer",
    components: [
      {
        type: "email-row",
        components: [
          {
            type: "email-column",
            columnWidth: 50,
            attributes: { width: "50%" },
            components: [
              {
                type: "email-image",
                attributes: {
                  src: "https://placehold.co/120x40/275073/ffffff?text=Logo",
                  alt: "Logo",
                  width: "120",
                  "data-role": "brand-logo",
                },
              },
              {
                type: "email-text",
                content: "<strong>Firma GmbH</strong><br/>Adresse",
              },
            ],
          },
          {
            type: "email-column",
            columnWidth: 50,
            attributes: { width: "50%" },
            components: [
              {
                type: "email-image",
                attributes: {
                  src: "https://placehold.co/120x80/e8e8e8/666?text=Cert",
                  alt: "Zertifikat",
                  width: "120",
                  "data-role": "certifications",
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export function socialSectionContent(): object {
  return {
    type: "email-section",
    sectionRole: "social",
    attributes: { "data-role": "social", "data-section-role": "social" },
    name: "Social Media",
    components: [
      {
        type: "email-row",
        components: [
          {
            type: "email-column",
            components: [{ type: "company-social" }],
          },
        ],
      },
    ],
  };
}
