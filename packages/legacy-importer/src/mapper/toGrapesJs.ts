/**
 * Map NormalizedEmailDocument → GrapesJS component defs (section/row/column/blocks).
 * Location: packages/legacy-importer/src/mapper/toGrapesJs.ts
 */

import { replaceLegacyHashTokens, splitParamExpressions } from "@email-template/email-variables";
import type {
  CompanyInformationBlock,
  EmailBlock,
  EmailColumn,
  EmailSection,
  NormalizedEmailDocument,
  SocialLinksBlock,
} from "../document.js";
import {
  normalizeSectionRole,
  sectionDisplayName,
} from "../document.js";
import { companyInfoToBlocks } from "../recognition/footer.js";
import type { GrapesComponentDef } from "../types.js";
import {
  paramBadge,
  richTextToGrapesComponents,
} from "./tokenizeRichText.js";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function mapBlock(block: EmailBlock): GrapesComponentDef | GrapesComponentDef[] {
  switch (block.type) {
    case "rich-text": {
      const kids = richTextToGrapesComponents(block.html);
      // Single HTML string → `content` (one RTE host). Component arrays stay in `components`.
      if (typeof kids === "string") {
        return {
          type: "email-text",
          attributes: {
            "data-email-type": "email-text",
            ...(block.role ? { "data-role": block.role } : {}),
          },
          content: kids,
        };
      }
      return {
        type: "email-text",
        attributes: {
          "data-email-type": "email-text",
          ...(block.role ? { "data-role": block.role } : {}),
        },
        components: kids,
      };
    }
    case "image":
      return {
        type: "email-image",
        attributes: {
          "data-email-type": "email-image",
          src: block.src,
          alt: block.alt,
          ...(block.width ? { width: String(block.width) } : {}),
          ...(block.role ? { "data-role": block.role } : {}),
          // Use data-align only — HTML align="left" becomes float:left in browsers
          // and wraps following text beside wide footer logos.
          ...(block.alignment ? { "data-align": block.alignment } : {}),
        },
        style: {
          display: "block",
          float: "none",
          height: "auto",
          ...(block.width
            ? { width: `${block.width}px`, "max-width": "100%" }
            : { "max-width": "100%" }),
          ...(block.alignment === "center"
            ? { margin: "0 auto" }
            : block.alignment === "right"
              ? { margin: "0 0 0 auto" }
              : { margin: "0" }),
        },
      };
    case "button":
      return {
        type: "email-button",
        attributes: {
          "data-email-type": "email-button",
          href: block.href,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        content: block.label,
      };
    case "spacer":
      return {
        type: "email-spacer",
        attributes: {
          "data-email-type": "email-spacer",
          ...(block.height ? { height: String(block.height) } : {}),
        },
      };
    case "divider":
      return {
        type: "email-divider",
        attributes: { "data-email-type": "email-divider" },
      };
    case "social-links":
      return mapSocial(block);
    case "company-information":
      return companyInfoToBlocks(block).flatMap((b) => {
        const m = mapBlock(b);
        return Array.isArray(m) ? m : [m];
      });
    case "corporate-footer": {
      // Flatten legacy block into left+right content (caller should prefer section)
      const left = companyInfoToBlocks(block.company).flatMap((b) => {
        const m = mapBlock(b);
        return Array.isArray(m) ? m : [m];
      });
      return left;
    }
    case "layout-row":
      return {
        type: "email-layout-row",
        attributes: {
          "data-email-type": "email-layout-row",
          "data-layout": "columns",
          "data-layout-cols": String(block.columns.length),
          width: "100%",
          cellpadding: "0",
          cellspacing: "0",
          border: "0",
        },
        style: {
          width: "100%",
          "border-collapse": "collapse",
          "table-layout": "fixed",
        },
        components: [
          {
            type: "email-row",
            attributes: { "data-email-type": "email-row" },
            components: block.columns.map((c) => mapColumn(c)),
          },
        ],
      };
    case "legacy-html":
      return {
        type: "email-legacy-html",
        attributes: {
          "data-email-type": "email-legacy-html",
          "data-reason": block.reason,
        },
        content: block.html,
      };
    default: {
      const _exhaustive: never = block;
      return {
        type: "email-legacy-html",
        attributes: { "data-email-type": "email-legacy-html" },
        content: JSON.stringify(_exhaustive),
      };
    }
  }
}

function mapBlocks(blocks: EmailBlock[]): GrapesComponentDef[] {
  const out: GrapesComponentDef[] = [];
  for (const b of blocks) {
    const m = mapBlock(b);
    if (Array.isArray(m)) out.push(...m);
    else out.push(m);
  }
  return out;
}

function mapSocial(block: SocialLinksBlock): GrapesComponentDef {
  const linkedin = block.items.find((i) => i.network === "linkedin")?.href;
  const x = block.items.find((i) => i.network === "x")?.href;
  const website = block.items.find((i) => i.href.includes("http"))?.href;
  const itemsJson = JSON.stringify(block.items);
  const icons = block.items
    .map((item) => {
      const img = item.imageSrc
        ? `<img src="${escapeAttr(item.imageSrc)}" alt="${escapeAttr(item.label ?? item.network)}" width="32" height="32" style="display:inline-block;border:0;" />`
        : escapeAttr(item.network);
      return `<a href="${escapeAttr(item.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;">${img}</a>`;
    })
    .join("");
  return {
    type: "company-social",
    attributes: {
      "data-email-type": "company-social",
      "data-social-items": itemsJson,
      align: "center",
    },
    style: {
      width: "100%",
      "text-align": "center",
      margin: "0 auto",
    },
    linkedinUrl: linkedin,
    xUrl: x,
    websiteUrl: website,
    components: `<tbody><tr><td align="center" style="padding:16px;text-align:center;">${icons}</td></tr></tbody>`,
  };
}

function mapColumn(
  col: EmailColumn,
  opts?: { align?: "left" | "center" | "right"; padding?: string },
): GrapesComponentDef {
  const inner = mapBlocks(col.children);
  const w = col.width || 100;
  const align = opts?.align;
  const pad = opts?.padding ?? "15px";
  return {
    type: "email-column",
    columnWidth: w,
    attributes: {
      "data-email-type": "email-column",
      width: `${w}%`,
      valign: "top",
      ...(align ? { align } : {}),
    },
    style: {
      width: `${w}%`,
      "vertical-align": "top",
      padding: pad,
      ...(align ? { "text-align": align } : {}),
    },
    components: inner.length
      ? inner
      : [
          {
            type: "email-text",
            attributes: { "data-email-type": "email-text" },
            content: " ",
          },
        ],
  };
}

function mapColumnCentered(col: EmailColumn): GrapesComponentDef {
  return mapColumn(col, { align: "center" });
}

/** Footer: left company (left), right certs (center) — Brevo 50/50. */
function mapFooterColumn(col: EmailColumn, index: number, total: number): GrapesComponentDef {
  if (total === 2) {
    return mapColumn(col, {
      align: index === 0 ? "left" : "center",
      padding: "15px",
    });
  }
  return mapColumn(col, { align: "left", padding: "15px" });
}

function mapSection(section: EmailSection): GrapesComponentDef {
  const role = normalizeSectionRole(section.role) ?? "content";
  const name = sectionDisplayName(role);
  const cols = section.columns.length
    ? section.columns
    : [{ id: "empty", width: 100, children: [] as EmailBlock[] }];

  const padding =
    section.padding ??
    (role === "header"
      ? "20px 16px 80px 16px"
      : role === "footer"
        ? "80px 15px 20px 15px"
        : "16px");

  const sourceAttrs: Record<string, string> = {};
  if (section.source) {
    sourceAttrs["data-saved-section-id"] = section.source.savedSectionId;
    sourceAttrs["data-saved-section-version"] = String(section.source.version);
    sourceAttrs["data-saved-section-mode"] = section.source.mode;
  }

  return {
    type: "email-section",
    name,
    sectionRole: role,
    attributes: {
      "data-email-type": "email-section",
      "data-role": String(role),
      "data-section-role": String(role),
      width: "100%",
      cellpadding: "0",
      cellspacing: "0",
      border: "0",
      ...sourceAttrs,
    },
    style: {
      width: "100%",
      "border-collapse": "collapse",
      "table-layout": "fixed",
      ...(section.backgroundColor
        ? { "background-color": section.backgroundColor }
        : {}),
    },
    sectionPadding: padding,
    components: [
      {
        type: "email-row",
        attributes: { "data-email-type": "email-row" },
        components: cols.map((c, i) => {
          if (role === "social") return mapColumnCentered(c);
          if (role === "footer") return mapFooterColumn(c, i, cols.length);
          return mapColumn(c);
        }),
      },
    ],
  };
}

export function normalizedEmailToGrapesComponents(
  document: NormalizedEmailDocument,
): GrapesComponentDef[] {
  return document.children.map(mapSection);
}

/** Re-export for tests that still tokenize plain strings. */
export function tokenizeParams(text: string): GrapesComponentDef[] {
  const out: GrapesComponentDef[] = [];
  for (const part of splitParamExpressions(replaceLegacyHashTokens(text))) {
    if (part.type === "text") {
      if (part.value) out.push({ type: "textnode", content: part.value });
    } else {
      out.push(paramBadge(part.key));
    }
  }
  return out;
}

/** @internal unused import guard for CompanyInformationBlock in mapBlock */
void (0 as unknown as CompanyInformationBlock);
