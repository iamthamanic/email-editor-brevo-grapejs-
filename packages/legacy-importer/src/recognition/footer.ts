/**
 * Corporate footer / company contact recognition.
 * Location: packages/legacy-importer/src/recognition/footer.ts
 *
 * Footer is a section role — content is normal image + rich-text blocks (no monolith).
 */

import type {
  CompanyInformationBlock,
  EmailBlock,
  ImageBlock,
  RichTextBlock,
} from "../document.js";
import { nextId } from "../ids.js";
import { imageFromElement } from "./images.js";
import { textOf } from "./richText.js";

const CONTACT_HINT =
  /gmbh|ltd|inc\.|straße|strasse|tel\.?|telefon|www\.|http|mailto:|@|impressum|handelsregister/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function extractCompanyInfo(cell: Element): CompanyInformationBlock {
  const lines = (cell.textContent ?? "")
    .split(/\n|•|\|/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const logo = cell.querySelector("img");
  let phone: string | undefined;
  let email: string | undefined;
  let website: string | undefined;
  for (const a of cell.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (/^tel:/i.test(href)) phone = href.replace(/^tel:/i, "");
    else if (/^mailto:/i.test(href)) email = href.replace(/^mailto:/i, "");
    else if (/^https?:/i.test(href)) website = href;
  }
  for (const line of lines) {
    if (!email && /@/.test(line) && !/\s/.test(line)) email = line;
    if (!phone && /\+?\d[\d\s/-]{6,}/.test(line) && /tel|telefon|\+/i.test(line)) {
      phone = line;
    }
    if (!website && /www\./i.test(line)) {
      website = line.startsWith("http") ? line : `https://${line}`;
    }
  }
  return {
    id: nextId("co"),
    type: "company-information",
    companyName: lines[0],
    addressLines: lines.slice(1, 6),
    phone,
    email,
    website,
    logoSrc: logo?.getAttribute("src") ?? undefined,
  };
}

/** Expand company-information into image + rich-text (DRY with normal blocks). */
export function companyInfoToBlocks(
  company: CompanyInformationBlock,
): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  if (company.logoSrc?.trim()) {
    blocks.push({
      id: nextId("img"),
      type: "image",
      role: "brand-logo",
      src: company.logoSrc.trim(),
      alt: company.companyName ?? "Logo",
      width: 120,
      alignment: "left",
    });
  }
  blocks.push(companyInfoToRichText(company));
  return blocks;
}

export function companyInfoToRichText(
  company: CompanyInformationBlock,
): RichTextBlock {
  const parts: string[] = [];
  if (company.companyName) {
    parts.push(`<strong>${escapeHtml(company.companyName)}</strong><br/>`);
  }
  for (const line of company.addressLines) {
    if (!line.trim()) continue;
    // Skip lines that duplicate contact fields already linked below
    if (company.phone && line.includes(company.phone)) continue;
    if (company.email && line.includes(company.email)) continue;
    if (company.website && line.includes(company.website.replace(/^https?:\/\//, ""))) {
      continue;
    }
    parts.push(`${escapeHtml(line)}<br/>`);
  }
  if (company.phone) {
    parts.push(
      `Telefon: <a href="tel:${escapeHtml(company.phone)}">${escapeHtml(company.phone)}</a><br/>`,
    );
  }
  if (company.website) {
    const href = company.website.startsWith("http")
      ? company.website
      : `https://${company.website}`;
    parts.push(
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(company.website)}</a><br/>`,
    );
  }
  if (company.email) {
    parts.push(
      `<a href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a>`,
    );
  }
  return {
    id: nextId("rt"),
    type: "rich-text",
    role: "company-contact",
    html: parts.join("\n") || " ",
  };
}

export function looksLikeCompanyCell(cell: Element): boolean {
  const t = textOf(cell);
  if (t.length < 20) return false;
  const signals =
    (CONTACT_HINT.test(t) ? 1 : 0) +
    (cell.querySelector("img") ? 1 : 0) +
    (cell.querySelector('a[href^="mailto:"], a[href^="tel:"], a[href^="http"]')
      ? 1
      : 0) +
    (t.split(/\s+/).length >= 6 ? 1 : 0);
  return signals >= 2;
}

/** Stricter footer host: company address block, not a promo with a random link. */
export function looksLikeCompanyFooterCell(cell: Element): boolean {
  if (!looksLikeCompanyCell(cell)) return false;
  const t = textOf(cell);
  const hasCompanyName = /gmbh|ltd\.?|inc\.?|ug\b|ag\b|e\.?\s*k\.?/i.test(t);
  const hasAddress = /straße|strasse|weg\b|platz\b|\b\d{5}\b/i.test(t);
  const hasLogo = Boolean(cell.querySelector("img"));
  return hasLogo && (hasCompanyName || hasAddress);
}

export function looksLikeCertImageCell(cell: Element): boolean {
  const imgs = cell.querySelectorAll("img");
  if (imgs.length === 0) return false;
  const t = textOf(cell);
  return t.length < 40;
}

export interface FooterColumnsResult {
  left: EmailBlock[];
  right: EmailBlock[];
  certificationImage?: ImageBlock;
}

/**
 * Detect 50/50 company | cert footer → normal blocks (image + rich-text | image).
 */
export function tryFooterColumns(
  cells: Element[],
  nearEnd: boolean,
): FooterColumnsResult | null {
  if (cells.length !== 2 || !nearEnd) return null;
  const [a, b] = cells;
  if (!a || !b) return null;
  let companyCell: Element | null = null;
  let certCell: Element | null = null;
  if (looksLikeCompanyCell(a) && looksLikeCertImageCell(b)) {
    companyCell = a;
    certCell = b;
  } else if (looksLikeCompanyCell(b) && looksLikeCertImageCell(a)) {
    companyCell = b;
    certCell = a;
  } else {
    return null;
  }
  const company = extractCompanyInfo(companyCell);
  const img = certCell.querySelector("img");
  let certificationImage: ImageBlock | undefined;
  if (img) {
    certificationImage = imageFromElement(img, "certifications") ?? undefined;
  }
  return {
    left: companyInfoToBlocks(company),
    right: certificationImage ? [certificationImage] : [],
    certificationImage,
  };
}

/** @deprecated Use tryFooterColumns. */
export function tryCorporateFooter(
  cells: Element[],
  nearEnd: boolean,
): {
  id: string;
  type: "corporate-footer";
  company: CompanyInformationBlock;
  certificationImage?: ImageBlock;
} | null {
  const cols = tryFooterColumns(cells, nearEnd);
  if (!cols) return null;
  const company = extractCompanyInfo(
    looksLikeCompanyCell(cells[0]!) ? cells[0]! : cells[1]!,
  );
  return {
    id: nextId("footer"),
    type: "corporate-footer",
    company,
    certificationImage: cols.certificationImage,
  };
}
