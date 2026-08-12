/**
 * URL allowlist for email editor traits (F-02 / AGENTS: block javascript:).
 * Location: packages/email-components/src/urls.ts
 */

import { EMAIL_IMAGE_PLACEHOLDER_SRC } from "./imagePlaceholder.js";

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

/** Same-origin editor asset path served by API (vite proxies /api). */
const LOCAL_ASSET_PATH = /^\/api\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;

export function isAllowedLinkUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return LINK_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function isAllowedImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Exact editor starter artwork only — arbitrary data: URLs stay blocked.
  if (trimmed === EMAIL_IMAGE_PLACEHOLDER_SRC) return true;
  if (LOCAL_ASSET_PATH.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return IMAGE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/** Returns sanitized URL or fallback when protocol is disallowed / invalid. */
export function sanitizeLinkUrl(
  raw: string,
  fallback = "https://example.com",
): string {
  return isAllowedLinkUrl(raw) ? raw.trim() : fallback;
}

export function sanitizeImageUrl(raw: string, fallback: string): string {
  return isAllowedImageUrl(raw) ? raw.trim() : fallback;
}
