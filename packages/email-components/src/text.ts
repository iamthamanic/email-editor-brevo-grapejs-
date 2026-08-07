/**
 * Plain-text helpers for component traits (no HTML parse sinks).
 * Location: packages/email-components/src/text.ts
 */

/** Strip tags and collapse whitespace — never pass result to HTML parsers as markup. */
export function toPlainText(input: string, fallback = ""): string {
  const stripped = input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : fallback;
}

/** Escape for safe insertion into HTML attribute/text contexts. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Image alt trait: plain text only, no quotes/angle brackets, max 200 chars.
 */
export function sanitizeAltText(input: string, fallback = "Bild"): string {
  const plain = toPlainText(input, fallback)
    .replace(/["'<>`]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
  return plain.length > 0 ? plain : fallback;
}
