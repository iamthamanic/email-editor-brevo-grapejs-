/**
 * URL allowlist for email editor traits (F-02 / AGENTS: block javascript:).
 * Location: packages/email-components/src/urls.ts
 */

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

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
