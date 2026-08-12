/**
 * GrapesJS layout: email-section / email-row / email-column (containers, not leafs).
 * Location: packages/email-components/src/layout.ts
 */

import type { Component, Editor } from "grapesjs";
import { BRAND_DEFAULTS } from "./brandDefaults.js";

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
  "email-layout-row",
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
  // Legacy multi-col wrappers may nest inside the canvas column
  if (t.startsWith("email-columns-")) return true;
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

/** Header/Footer/Social are brand chrome — viewable, not editable in the canvas. */
function isProtectedRole(role: string): boolean {
  return role === "header" || role === "footer" || role === "social";
}

const BREVO_HINTS: Record<string, string> = {
  header: "Header in Brevo anpassen — hier nicht bearbeitbar.",
  footer: "Footer in Brevo anpassen — hier nicht bearbeitbar.",
  social: "Social Media in Brevo anpassen — hier nicht bearbeitbar.",
};

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

/**
 * Lock header/footer/social: no RTE, no drops, no child selection, no Grape toolbar.
 * Section stays selectable so a click shows the Brevo hint; not draggable/removable.
 * Content canvas is editable but never removable (persistent single canvas).
 */
function applyProtectedLock(section: Component): void {
  const role =
    String(section.get("sectionRole") ?? "") ||
    String(section.getAttributes()?.["data-section-role"] ?? "") ||
    String(section.getAttributes()?.["data-role"] ?? "content");
  const locked = isProtectedRole(role);
  const isContent = role === "content";

  const patch: Record<string, unknown> = {
    droppable: locked ? false : ((src: Component) => acceptsRow(src)),
    // Chrome + content canvas stay in slot order; only nested blocks move.
    draggable: !locked && !isContent,
    copyable: !locked && !isContent,
    removable: !locked && !isContent,
  };
  if (locked) {
    // Empty toolbar = no move/clone/delete chrome on select
    patch.toolbar = [];
    // No hover highlight — Brevo hint only appears after click (selected)
    patch.hoverable = false;
    patch.highlightable = false;
    patch.editable = false;
  } else if (isContent) {
    // Keep select/hover; strip delete/clone from section toolbar only.
    patch.toolbar = [];
  }
  section.set(patch);
  if (locked) {
    const hint =
      BREVO_HINTS[role] ??
      "Diesen Bereich in Brevo anpassen — hier nicht bearbeitbar.";
    section.addAttributes({
      "data-locked": "1",
      "data-brevo-hint": hint,
    });
    section.removeAttributes("title");
  } else {
    section.removeAttributes("data-locked");
    section.removeAttributes("data-brevo-hint");
    section.removeAttributes("title");
  }

  const walk = (c: Component, isRoot: boolean) => {
    if (!isRoot) {
      if (locked) {
        c.set({
          editable: false,
          droppable: false,
          draggable: false,
          selectable: false,
          hoverable: false,
          highlightable: false,
          copyable: false,
          removable: false,
          toolbar: [],
          // Keep in layers for orientation, but not canvas-editable
          layerable: true,
        });
      }
    }
    c.components().forEach((child: Component) => walk(child, false));
  };
  walk(section, true);
}

/** Empty content canvas shell (one row → one column, no seed text). */
export function emptyContentSectionContent(): object {
  return {
    type: "email-section",
    sectionRole: "content",
    attributes: {
      "data-email-type": "email-section",
      "data-role": "content",
      "data-section-role": "content",
    },
    name: "Inhalt",
    components: [
      {
        type: "email-row",
        components: [
          {
            type: "email-column",
            components: [],
          },
        ],
      },
    ],
  };
}

/** Inner row/column only — used to heal a hollow content section. */
export function emptyContentCanvasInner(): object {
  return {
    type: "email-row",
    components: [
      {
        type: "email-column",
        components: [],
      },
    ],
  };
}

function roleOfSection(sec: Component): string {
  return (
    String(sec.get("sectionRole") ?? "") ||
    String(sec.getAttributes()?.["data-section-role"] ?? "") ||
    String(sec.getAttributes()?.["data-role"] ?? "content")
  );
}

function isHollowContentSection(sec: Component): boolean {
  const rows = sec.findType("email-row");
  const cols = sec.findType("email-column");
  return rows.length === 0 || cols.length === 0 || sec.components().length === 0;
}

/**
 * Ensure exactly one content canvas exists with at least one column.
 * Returns the primary canvas column (not a nested layout-row column).
 */
export function ensureContentCanvas(editor: Editor): Component | null {
  const wrap = editor.getWrapper();
  if (!wrap) return null;

  let content =
    (wrap.findType("email-section") as Component[]).find(
      (s) => roleOfSection(s) === "content",
    ) ?? null;

  if (!content) {
    const added = wrap.append(emptyContentSectionContent());
    content = (Array.isArray(added) ? added[0] : added) as Component;
    // Place between header and footer when possible
    const models = [...wrap.components().models] as Component[];
    const footerIdx = models.findIndex(
      (m) =>
        String(m.get("type") ?? "") === "email-section" &&
        roleOfSection(m) === "footer",
    );
    if (footerIdx >= 0 && content) {
      try {
        content.move(wrap, { at: footerIdx });
      } catch {
        // order enforced later by slot wire
      }
    }
  }

  if (content && isHollowContentSection(content)) {
    content.components().reset([emptyContentCanvasInner() as object]);
  }

  if (content) applyProtectedLock(content);

  const cols = content?.findType("email-column") ?? [];
  const canvasCol =
    cols.find((col) => {
      let p: Component | undefined = col.parent() as Component | undefined;
      for (let i = 0; i < 8 && p; i += 1) {
        const t = String(p.get("type") ?? "");
        if (t === "email-layout-row") return false;
        if (t === "email-section") return roleOfSection(p) === "content";
        p = p.parent() as Component | undefined;
      }
      return false;
    }) ?? cols[0];
  return canvasCol ?? null;
}

export function registerLayoutComponents(editor: Editor): void {
  // Hollow content → restore shell (never delete the persistent canvas).
  const healContentCanvas = () => {
    const wrap = editor.getWrapper();
    if (!wrap) return;
    const contents = (wrap.findType("email-section") as Component[]).filter(
      (s) => roleOfSection(s) === "content",
    );
    if (contents.length === 0) {
      ensureContentCanvas(editor);
      return;
    }
    for (const sec of contents) {
      if (isHollowContentSection(sec)) {
        try {
          sec.components().reset([emptyContentCanvasInner() as object]);
          applyProtectedLock(sec);
        } catch {
          // ignore mid-teardown
        }
      } else {
        applyProtectedLock(sec);
      }
    }
  };

  const scheduleHeal = () => {
    queueMicrotask(healContentCanvas);
    requestAnimationFrame(() => {
      healContentCanvas();
      queueMicrotask(healContentCanvas);
    });
  };

  editor.on("component:remove", () => {
    scheduleHeal();
  });
  // Abort deleting the content section itself (keyboard / API).
  editor.on(
    "component:remove:before",
    (comp: Component, _remove: () => void, opts) => {
      if (String(comp.get("type") ?? "") !== "email-section") return;
      if (roleOfSection(comp) !== "content") return;
      // Runtime AbortOption; Grapes RemoveOptions typings omit `abort`.
      (opts as { abort?: boolean }).abort = true;
      // Clear inner blocks instead of removing the canvas.
      try {
        const cols = comp.findType("email-column");
        const canvasCol = cols.find((col) => {
          let p: Component | undefined = col.parent() as Component | undefined;
          for (let i = 0; i < 8 && p; i += 1) {
            if (String(p.get("type") ?? "") === "email-layout-row") return false;
            if (String(p.get("type") ?? "") === "email-section") return true;
            p = p.parent() as Component | undefined;
          }
          return false;
        }) ?? cols[0];
        if (canvasCol) {
          canvasCol.components().reset([]);
        } else {
          comp.components().reset([emptyContentCanvasInner() as object]);
        }
        applyProtectedLock(comp);
      } catch {
        // ignore
      }
    },
  );
  editor.on("run:core:component-delete", () => scheduleHeal());
  editor.on("run:tlb-delete", () => scheduleHeal());

  // Re-assert empty toolbar if GrapesJS rehydrates defaults on select
  editor.on("component:selected", (comp: Component) => {
    let c: Component | undefined = comp;
    while (c) {
      if (String(c.get("type") ?? "") === "email-section") {
        const role = roleOfSection(c);
        if (isProtectedRole(role) || role === "content") {
          c.set({
            toolbar: [],
            copyable: false,
            removable: false,
            draggable: false,
          });
        }
        break;
      }
      c = c.parent();
    }
  });
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
        draggable:
          "[data-email-type=email-section], [data-email-type=email-layout-row]",
        attributes: { "data-email-type": "email-row" },
        // ponytail: empty column = visible canvas dropzone (CSS :has)
        components: [{ type: "email-column" }],
      },
    },
  });

  /** Nested multi-column block inside the single content canvas column. */
  domc.addType("email-layout-row", {
    isComponent: (el) =>
      el.getAttribute?.("data-email-type") === "email-layout-row",
    model: {
      defaults: {
        tagName: "table",
        name: "Spalten",
        droppable: (src: Component) => acceptsRow(src),
        draggable: true,
        attributes: {
          "data-email-type": "email-layout-row",
          "data-layout": "columns",
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
        },
        components: [
          {
            type: "email-row",
            components: [
              {
                type: "email-column",
                columnWidth: 50,
                attributes: { width: "50%" },
                components: [],
              },
              {
                type: "email-column",
                columnWidth: 50,
                attributes: { width: "50%" },
                components: [],
              },
            ],
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
        draggable: false,
        removable: false,
        copyable: false,
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
              { id: "header", name: "Header" },
              { id: "content", name: "Inhalt" },
              { id: "footer", name: "Footer" },
              { id: "social", name: "Social Media" },
            ],
          },
          {
            type: "brand-color",
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
            components: [{ type: "email-column" }],
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
        // Retrofit: multi-column content sections from older projects get layout chrome
        {
          const roleNow =
            String(this.get("sectionRole") ?? "") ||
            String(this.getAttributes()?.["data-role"] ?? "content");
          const colCount = this.findType("email-column").length;
          if (
            roleNow === "content" &&
            colCount >= 2 &&
            !this.getAttributes()?.["data-layout"]
          ) {
            this.addAttributes({
              "data-layout": "columns",
              "data-layout-cols": String(colCount),
            });
          }
        }
        lockChrome(this);
        applyProtectedLock(this);
        this.on("change:sectionRole", () => {
          applyRole();
          applyProtectedLock(this);
        });
        this.on("change:sectionPadding change:backgroundColor", applyChrome);
        this.on("change:components", () => {
          lockChrome(this);
          applyProtectedLock(this);
        });
      },
    },
  });
}

/**
 * Layout palette: nested multi-column block for the single content canvas.
 * (Previously created a top-level content section — that broke the one-canvas rule.)
 */
export function layoutRowContent(cols: 1 | 2 | 3): object {
  const width = Math.floor(100 / cols);
  return {
    type: "email-layout-row",
    attributes: {
      "data-email-type": "email-layout-row",
      "data-layout": "columns",
      "data-layout-cols": String(cols),
      width: "100%",
      cellpadding: "0",
      cellspacing: "0",
      border: "0",
    },
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
  };
}

/** @deprecated Use layoutRowContent — kept name for call sites. */
export function columnsSectionContent(cols: 1 | 2 | 3): object {
  return layoutRowContent(cols);
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
                  src: BRAND_DEFAULTS.logoSrc,
                  alt: BRAND_DEFAULTS.logoAlt,
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

/** Default empty footer structure (50/50 Brevo-like). */
export function footerSectionContent(): object {
  const company = BRAND_DEFAULTS.companyName;
  const street = BRAND_DEFAULTS.addressStreet;
  const city = BRAND_DEFAULTS.addressCity;
  const phone = BRAND_DEFAULTS.phoneLabel;
  const website = BRAND_DEFAULTS.website;
  const websiteLabel = BRAND_DEFAULTS.websiteLabel;
  return {
    type: "email-section",
    sectionRole: "footer",
    attributes: { "data-role": "footer", "data-section-role": "footer" },
    name: "Footer",
    sectionPadding: "80px 15px 20px 15px",
    components: [
      {
        type: "email-row",
        components: [
          {
            type: "email-column",
            columnWidth: 50,
            attributes: { width: "50%", align: "left" },
            style: { width: "50%", "text-align": "left", "vertical-align": "top" },
            components: [
              {
                type: "email-image",
                attributes: {
                  src: BRAND_DEFAULTS.logoSrc,
                  alt: BRAND_DEFAULTS.logoAlt,
                  width: "229",
                  "data-role": "brand-logo",
                  "data-align": "left",
                },
                style: {
                  width: "229px",
                  "max-width": "100%",
                  display: "block",
                  float: "none",
                  margin: "0",
                },
              },
              {
                type: "email-text",
                content: `<div style="margin:0;line-height:1.25;font-size:14px;"><p style="margin:0;color:#000000;font-size:14px;">${company}</p><p style="margin:0;color:#666666;font-size:14px;">${street}</p><p style="margin:0;color:#666666;font-size:14px;">${city}</p><p style="margin:0;color:#666666;font-size:14px;">${phone}</p><p style="margin:0;font-size:14px;"><a href="${website}" style="color:#47b1e5;text-decoration:underline;" target="_blank" rel="noopener noreferrer">${websiteLabel}</a></p></div>`,
              },
            ],
          },
          {
            type: "email-column",
            columnWidth: 50,
            attributes: { width: "50%", align: "center" },
            style: {
              width: "50%",
              "text-align": "center",
              "vertical-align": "top",
            },
            components: [
              {
                type: "email-image",
                attributes: {
                  src: BRAND_DEFAULTS.certSrc,
                  alt: BRAND_DEFAULTS.certAlt,
                  width: "270",
                  "data-role": "certifications",
                  align: "center",
                },
                style: {
                  width: "270px",
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
            attributes: { align: "center", width: "100%" },
            style: {
              width: "100%",
              "text-align": "center",
            },
            components: [
              {
                type: "company-social",
                attributes: {
                  "data-social-items": JSON.stringify(BRAND_DEFAULTS.socialItems),
                  align: "center",
                },
                style: {
                  margin: "0 auto",
                  width: "auto",
                  "max-width": "100%",
                },
                linkedinUrl: BRAND_DEFAULTS.linkedinUrl,
                xUrl: BRAND_DEFAULTS.xUrl,
                websiteUrl: BRAND_DEFAULTS.website,
              },
            ],
          },
        ],
      },
    ],
  };
}
