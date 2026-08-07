/**
 * Allowlist sanitizer for email HTML fragments (RTE canvas + future publish/export).
 * Location: packages/email-components/src/html.ts
 * No DOMPurify dependency — strips dangerous tags/handlers and rewrites href/src.
 */

import { sanitizeImageUrl, sanitizeLinkUrl } from "./urls.js";

const BLOCKED_TAGS =
  /<\/?(?:script|iframe|object|embed|form|link|meta|base|svg|math|video|audio|source|style)\b[^>]*>/gi;

const EVENT_ATTR =
  /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

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
 * Sanitize an HTML fragment before canvas hydrate or publish/render.
 * Keeps typical email markup; removes script/iframe/handlers; allowlists URL protocols.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";

  let out = html.replace(BLOCKED_TAGS, "");
  out = out.replace(EVENT_ATTR, "");

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
