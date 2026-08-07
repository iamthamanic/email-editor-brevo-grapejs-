/**
 * Migrate legacy monolith header/footer composites → section/row/column/blocks.
 * Location: packages/editor-core/src/migrateLegacyLayout.ts
 */

import type { Component, Editor } from "grapesjs";
import {
  footerSectionContent,
  headerSectionContent,
} from "@email-template/email-components";

function attrs(c: Component): Record<string, string> {
  return (c.getAttributes?.() ?? {}) as Record<string, string>;
}

function migrateEmailHeader(comp: Component): object {
  const logoSrc = String(comp.get("logoSrc") ?? attrs(comp).src ?? "");
  const logoAlt = String(comp.get("logoAlt") ?? "Logo");
  const logoWidth = Number(comp.get("logoWidth") ?? 160) || 160;
  const alignment = String(comp.get("alignment") ?? "center");
  const padding = String(comp.get("padding") ?? "20px 16px 40px 16px");
  const tree = headerSectionContent() as {
    sectionPadding?: string;
    components?: Array<{
      components?: Array<{
        components?: Array<Record<string, unknown>>;
      }>;
    }>;
  };
  tree.sectionPadding = padding;
  const img = tree.components?.[0]?.components?.[0]?.components?.[0];
  if (img) {
    img.attributes = {
      ...(img.attributes as object),
      src: logoSrc || (img.attributes as { src?: string }).src,
      alt: logoAlt,
      width: String(logoWidth),
      align: alignment,
      "data-role": "brand-logo",
    };
  }
  return tree;
}

function migrateCompanyHeader(comp: Component): object {
  const logoSrc = String(comp.get("logoSrc") ?? "");
  const companyName = String(comp.get("companyName") ?? "");
  return {
    type: "email-section",
    sectionRole: "header",
    attributes: { "data-role": "header" },
    name: "Header",
    components: [
      {
        type: "email-row",
        components: [
          {
            type: "email-column",
            components: [
              ...(logoSrc
                ? [
                    {
                      type: "email-image",
                      attributes: {
                        src: logoSrc,
                        alt: companyName || "Logo",
                        width: "160",
                        "data-role": "brand-logo",
                      },
                    },
                  ]
                : []),
              ...(companyName
                ? [
                    {
                      type: "email-text",
                      content: `<strong>${companyName}</strong>`,
                    },
                  ]
                : [{ type: "email-text", content: " " }]),
            ],
          },
        ],
      },
    ],
  };
}

function migrateCompanyFooter(comp: Component): object {
  const companyName = String(comp.get("companyName") ?? "");
  const addressLine = String(comp.get("addressLine") ?? "");
  const tree = footerSectionContent() as {
    components?: Array<{
      components?: Array<{
        components?: Array<Record<string, unknown>>;
      }>;
    }>;
  };
  const leftCol = tree.components?.[0]?.components?.[0]?.components;
  if (leftCol) {
    // Replace default text with company traits
    const textIdx = leftCol.findIndex(
      (c) => (c as { type?: string }).type === "email-text",
    );
    if (textIdx >= 0) {
      leftCol[textIdx] = {
        type: "email-text",
        content: `<strong>${companyName || "Firma"}</strong><br/>${addressLine}`,
      };
    }
  }
  return tree;
}

function migrateCompanyContact(comp: Component): object[] {
  const logoSrc = String(comp.get("logoSrc") ?? "").trim();
  const companyName = String(comp.get("companyName") ?? "");
  const addressLine = String(comp.get("addressLine") ?? "");
  const phone = String(comp.get("phone") ?? "");
  const email = String(comp.get("email") ?? "");
  const website = String(comp.get("website") ?? "");
  const parts: string[] = [];
  if (companyName) parts.push(`<strong>${companyName}</strong><br/>`);
  if (addressLine) parts.push(`${addressLine}<br/>`);
  if (phone) parts.push(`Telefon: <a href="tel:${phone}">${phone}</a><br/>`);
  if (website) {
    parts.push(
      `<a href="${website}" target="_blank" rel="noopener noreferrer">${website}</a><br/>`,
    );
  }
  if (email) parts.push(`<a href="mailto:${email}">${email}</a>`);
  const out: object[] = [];
  if (logoSrc) {
    out.push({
      type: "email-image",
      attributes: {
        src: logoSrc,
        alt: companyName || "Logo",
        width: "120",
        "data-role": "brand-logo",
      },
    });
  }
  out.push({
    type: "email-text",
    content: parts.join("\n") || " ",
  });
  return out;
}

/**
 * Walk top-level components and replace legacy composites once.
 * Safe to call after load / import.
 */
export function migrateLegacyLayout(editor: Editor): void {
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const top = [...wrapper.components().models];
  for (const comp of top) {
    const type = String(comp.get("type") ?? "");
    if (type === "email-header") {
      const next = migrateEmailHeader(comp);
      const idx = wrapper.components().indexOf(comp);
      comp.remove();
      wrapper.components().add(next, { at: idx >= 0 ? idx : undefined });
      continue;
    }
    if (type === "company-header") {
      const next = migrateCompanyHeader(comp);
      const idx = wrapper.components().indexOf(comp);
      comp.remove();
      wrapper.components().add(next, { at: idx >= 0 ? idx : undefined });
      continue;
    }
    if (type === "company-footer") {
      const next = migrateCompanyFooter(comp);
      const idx = wrapper.components().indexOf(comp);
      comp.remove();
      wrapper.components().add(next, { at: idx >= 0 ? idx : undefined });
      continue;
    }
  }

  // Nested company-contact → image + text in place
  const contacts = wrapper.findType("company-contact");
  for (const contact of [...contacts]) {
    const parent = contact.parent();
    if (!parent) continue;
    const idx = parent.components().indexOf(contact);
    const kids = migrateCompanyContact(contact);
    contact.remove();
    parent.components().add(kids, { at: idx >= 0 ? idx : undefined });
  }

  // email-columns-* with data-role=footer/corporate-footer → email-section
  const colWrappers = [
    ...wrapper.findType("email-columns-2"),
    ...wrapper.findType("email-columns-3"),
    ...wrapper.findType("email-columns-1"),
  ];
  for (const col of colWrappers) {
    const role = String(attrs(col)["data-role"] ?? "");
    if (role !== "footer" && role !== "corporate-footer" && role !== "header") {
      continue;
    }
    // Leave structure; only retag if already section-like — skip complex rewrite
    col.addAttributes({
      "data-role": role === "corporate-footer" ? "footer" : role,
    });
  }
}
