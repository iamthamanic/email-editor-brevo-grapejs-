/**
 * Corporate footer / company contact recognition.
 * Location: packages/legacy-importer/src/recognition/footer.ts
 *
 * Footer is a section role — content is normal image + rich-text blocks (no monolith).
 * Layout matches Brevo: left = logo (real px width) + contact | right = cert image(s).
 * Contact lines stay compact (Brevo-like line-height, no spacer blocks between lines).
 */

import type {
  CompanyInformationBlock,
  EmailBlock,
  ImageBlock,
  RichTextBlock,
} from "../document.js";
import { nextId } from "../ids.js";
import { imageFromElement, imagesFromCell } from "./images.js";
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

function parsePx(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Prefer <p> lines (Brevo); fall back to soft-split textContent. */
function contactLinesFromCell(cell: Element): string[] {
  const paragraphs = [...cell.querySelectorAll("p")]
    .map((p) => textOf(p).replace(/\u00a0/g, " ").trim())
    .filter((t) => t.length > 0 && t !== " ");
  if (paragraphs.length >= 2) return paragraphs;

  const raw = (cell.textContent ?? "").replace(/\u00a0/g, " ");
  return raw
    .split(/\n+|•|\|/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function extractCompanyInfo(cell: Element): CompanyInformationBlock {
  const lines = contactLinesFromCell(cell);
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
    if (
      !phone &&
      /\d[\d\s/-]{5,}/.test(line) &&
      (/tel|telefon|\+/i.test(line) || /^\d/.test(line.trim()))
    ) {
      // Plain DE landline lines (e.g. "030-627 35 160")
      if (!/straße|strasse|berlin|gmbh|www\.|@/i.test(line)) {
        phone = line.trim();
      }
    }
    if (!website && /www\./i.test(line)) {
      website = line.startsWith("http") ? line : `https://${line}`;
    }
  }
  const logoWidth =
    parsePx(logo?.getAttribute("width")) ??
    parsePx(
      /width\s*:\s*(\d+)/i.exec(logo?.getAttribute("style") ?? "")?.[1],
    ) ??
    parsePx(logo?.closest("table")?.getAttribute("width"));

  return {
    id: nextId("co"),
    type: "company-information",
    companyName: lines[0],
    addressLines: lines.slice(1, 8),
    phone,
    email,
    website,
    logoSrc: logo?.getAttribute("src") ?? undefined,
    logoWidth,
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
      alt: company.companyName?.split(/\s+/).slice(0, 3).join(" ") || "Logo",
      // Brevo footers use ~200–229px — never shrink to a tiny default
      width: company.logoWidth && company.logoWidth > 0 ? company.logoWidth : 200,
      alignment: "left",
    });
  }
  blocks.push(companyInfoToRichText(company));
  return blocks;
}

/**
 * Compact contact block — Brevo-like <p> lines (margin:0), not spacer stacks.
 * Company name dark; address/phone/links grey 14px.
 */
export function companyInfoToRichText(
  company: CompanyInformationBlock,
): RichTextBlock {
  const linesHtml: string[] = [];
  if (company.companyName) {
    linesHtml.push(
      `<p style="margin:0;color:#000000;font-size:14px;">${escapeHtml(company.companyName)}</p>`,
    );
  }

  const websiteHost = company.website
    ? company.website.replace(/^https?:\/\//i, "").replace(/\/$/, "")
    : "";

  for (const line of company.addressLines) {
    if (!line.trim()) continue;
    // Skip lines already rendered as structured contact fields below
    if (company.phone && line.includes(company.phone)) continue;
    if (company.email && line.includes(company.email)) continue;
    if (
      websiteHost &&
      (line.includes(websiteHost) ||
        line.replace(/^https?:\/\//i, "") === websiteHost)
    ) {
      continue;
    }
    // Skip bare www / email / phone-looking residual lines (rendered below)
    if (/^www\./i.test(line) || (/@/.test(line) && !/\s/.test(line))) continue;
    if (/^\d[\d\s/-]{5,}$/.test(line.trim())) continue;
    linesHtml.push(
      `<p style="margin:0;color:#666666;font-size:14px;">${escapeHtml(line.trim())}</p>`,
    );
  }

  if (company.phone) {
    linesHtml.push(
      `<p style="margin:0;color:#666666;font-size:14px;"><a href="tel:${escapeHtml(company.phone.replace(/\s+/g, ""))}" style="color:#666666;text-decoration:none;">${escapeHtml(company.phone)}</a></p>`,
    );
  }
  if (company.website) {
    const href = company.website.startsWith("http")
      ? company.website
      : `https://${company.website}`;
    const label = company.website.replace(/^https?:\/\//i, "");
    linesHtml.push(
      `<p style="margin:0;color:#666666;font-size:14px;"><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:#666666;text-decoration:underline;">${escapeHtml(label)}</a></p>`,
    );
  }
  if (company.email) {
    linesHtml.push(
      `<p style="margin:0;color:#666666;font-size:14px;"><a href="mailto:${escapeHtml(company.email)}" style="color:#666666;text-decoration:underline;">${escapeHtml(company.email)}</a></p>`,
    );
  }

  const inner = linesHtml.join("") || "<p style=\"margin:0;\"> </p>";
  return {
    id: nextId("rt"),
    type: "rich-text",
    role: "company-contact",
    // Compact Brevo-like spacing — never insert spacer blocks between lines
    html: `<div style="margin:0;line-height:1.25;font-size:14px;font-family:Tahoma,Arial,sans-serif;">${inner}</div>`,
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
 * Logo width/src come from the real <img>; cert column keeps every image.
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

  const logoEl = companyCell.querySelector("img");
  const logoBlock = logoEl
    ? imageFromElement(logoEl, "brand-logo")
    : null;
  if (logoBlock) {
    logoBlock.alignment = "left";
    // Fallback if Brevo omitted width attr
    if (!logoBlock.width || logoBlock.width < 40) logoBlock.width = 200;
  }

  const company = extractCompanyInfo(companyCell);
  // Prefer real img block over reconstructed company.logoSrc (keeps exact width)
  const left: EmailBlock[] = logoBlock
    ? [logoBlock, companyInfoToRichText(company)]
    : companyInfoToBlocks(company);

  const certImages = imagesFromCell(certCell, "certifications").map((img) => ({
    ...img,
    alignment: "center" as const,
    role: "certifications" as const,
  }));

  return {
    left,
    right: certImages,
    certificationImage: certImages[0],
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
