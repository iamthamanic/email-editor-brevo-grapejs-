/**
 * Allowlist sanitizer for email HTML fragments (RTE canvas + future publish/export).
 * Location: packages/email-components/src/html.ts
 * No DOMPurify dependency — strips dangerous tags/handlers and rewrites href/src.
 * Style props are allowlisted; background images/shorthand always dropped.
 * Paste mode also strips theme colors + background-color (chat UIs).
 */

import { sanitizeImageUrl, sanitizeLinkUrl } from "./urls.js";

const BLOCKED_TAGS =
  /<\/?(?:script|iframe|object|embed|form|link|meta|base|svg|math|video|audio|source|style)\b[^>]*>/gi;

const EVENT_ATTR =
  /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** Style properties safe for transactional email HTML. */
const STYLE_ALLOW = new Set([
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "text-align",
  "text-decoration",
  "text-decoration-line",
  "line-height",
  "letter-spacing",
  "vertical-align",
  "white-space",
  "width",
  "max-width",
  "min-width",
  "height",
  "max-height",
  "min-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "border-collapse",
  "border-spacing",
  "display",
  "float",
  "table-layout",
  "mso-line-height-rule",
  "mso-table-lspace",
  "mso-table-rspace",
]);

/** Always strip these (images / shorthand that reintroduces images). */
const STYLE_ALWAYS_DENY = new Set([
  "background",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "background-attachment",
  "background-clip",
  "background-origin",
]);

export type SanitizeEmailHtmlOptions = {
  /**
   * Drop `color` declarations too — useful for paste from dark chat UIs
   * (white/light text would vanish on a white email canvas).
   */
  stripColors?: boolean;
  /**
   * Drop `background-color` (chat paste). Toolbar highlight keeps it when false.
   */
  stripBackgrounds?: boolean;
  /**
   * Paste into a text host: drop layout breakers that make the canvas overflow
   * (white-space:nowrap, fixed widths, floats).
   */
  stripPasteLayout?: boolean;
  /**
   * Drop `font-family` so pasted copy inherits the Brevo/host stack (Tahoma).
   */
  stripFonts?: boolean;
};

function rewriteUrlAttr(
  attr: string,
  quote: string,
  value: string,
): string {
  const name = attr.toLowerCase();
  const raw = value.trim();
  if (name === "src" || name === "xlink:href") {
    const safe = sanitizeImageUrl(raw, "");
    return safe ? ` ${attr}=${quote}${safe}${quote}` : "";
  }
  return ` ${attr}=${quote}${sanitizeLinkUrl(raw)}${quote}`;
}

/**
 * Keep only email-safe CSS declarations.
 * Always drops background images/shorthand; optionally drops colors / bg fills.
 */
export function sanitizeInlineStyle(
  styleValue: string,
  opts: SanitizeEmailHtmlOptions = {},
): string {
  if (!styleValue.trim()) return "";
  const kept: string[] = [];
  for (const part of styleValue.split(";")) {
    const idx = part.indexOf(":");
    if (idx <= 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (!prop || !value) continue;
    if (STYLE_ALWAYS_DENY.has(prop)) continue;
    if (opts.stripBackgrounds && prop === "background-color") continue;
    if (opts.stripColors && prop === "color") continue;
    if (opts.stripFonts && prop === "font-family") continue;
    if (!STYLE_ALLOW.has(prop)) continue;
    // Block expression()/url() in remaining props (F-02)
    if (/expression\s*\(|url\s*\(/i.test(value)) continue;

    if (opts.stripPasteLayout) {
      if (prop === "white-space") {
        const v = value.toLowerCase().replace(/\s+/g, "");
        // nowrap / pre stretch a single line past the column width
        if (v === "nowrap" || v === "pre" || v.startsWith("nowrap,")) continue;
      }
      if (prop === "width" || prop === "min-width") continue;
      if (prop === "float") continue;
      if (prop === "display") {
        const v = value.toLowerCase().replace(/\s+/g, "");
        if (
          v === "inline-block" ||
          v === "flex" ||
          v === "grid" ||
          v === "table" ||
          v === "inline-table"
        ) {
          continue;
        }
      }
    }

    kept.push(`${prop}: ${value}`);
  }
  return kept.join("; ");
}

function scrubStyleAttributes(
  html: string,
  opts: SanitizeEmailHtmlOptions,
): string {
  return html.replace(
    /\sstyle\s*=\s*(["'])([\s\S]*?)\1/gi,
    (_m, quote: string, value: string) => {
      const cleaned = sanitizeInlineStyle(value, opts);
      return cleaned ? ` style=${quote}${cleaned}${quote}` : "";
    },
  );
}

/**
 * Sanitize an HTML fragment before canvas hydrate, paste, or publish/render.
 * Keeps typical email markup; removes script/iframe/handlers; allowlists URL
 * protocols and style properties (no background* / chat chrome).
 *
 * Canvas round-trip markers MUST survive: `data-email-type`, `data-section-role`,
 * `data-role`, `data-layout`, `data-layout-cols`, `data-social-items`, etc.
 * This sanitizer never strips arbitrary `data-*` attributes.
 */
export function sanitizeEmailHtml(
  html: string,
  opts: SanitizeEmailHtmlOptions = {},
): string {
  if (!html) return "";

  let out = html.replace(BLOCKED_TAGS, "");
  out = out.replace(EVENT_ATTR, "");
  // Legacy / Word / chat paste
  out = out.replace(/\sbgcolor\s*=\s*(["'])[\s\S]*?\1/gi, "");
  out = out.replace(/\sbgcolor\s*=\s*[^\s>]+/gi, "");
  out = out.replace(/\sbackground\s*=\s*(["'])[\s\S]*?\1/gi, "");
  out = out.replace(/\sbackground\s*=\s*[^\s>]+/gi, "");

  out = scrubStyleAttributes(out, opts);

  out = out.replace(
    /\s(href|src|xlink:href)\s*=\s*(["'])([\s\S]*?)\2/gi,
    (_m, attr: string, quote: string, value: string) =>
      rewriteUrlAttr(attr, quote, value),
  );

  out = out.replace(
    /\s(href|src)\s*=\s*([^\s>"']+)/gi,
    (_m, attr: string, value: string) => {
      const name = String(attr).toLowerCase();
      const raw = String(value).trim();
      if (name === "src") {
        const safe = sanitizeImageUrl(raw, "");
        return safe ? ` ${attr}="${safe}"` : "";
      }
      return ` ${attr}="${sanitizeLinkUrl(raw)}"`;
    },
  );

  return out;
}

/** Paste from external apps (chat, docs): strip theme colors + backgrounds + layout breakers. */
export function sanitizePastedEmailHtml(html: string): string {
  return sanitizeEmailHtml(html, {
    stripColors: true,
    stripBackgrounds: true,
    stripPasteLayout: true,
    stripFonts: true,
  });
}
