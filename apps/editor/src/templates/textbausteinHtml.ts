/**
 * Safe plain-text → email-text HTML for Textbausteine.
 * Location: apps/editor/src/templates/textbausteinHtml.ts
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip tags / br / p for editing in a textarea. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*p\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Walk Grapes-like JSON and collect HTML content as plain text. */
export function plainTextFromSectionData(data: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const o = node as Record<string, unknown>;
    if (typeof o.content === "string" && o.content.trim()) {
      parts.push(htmlToPlainText(o.content));
    }
    walk(o.components);
  };
  walk(data);
  return parts.filter(Boolean).join("\n\n").trim();
}

/**
 * Escape text, keep {{vars}}, auto-link http(s) URLs.
 * // ponytail: no rich editor; upgrade to limited HTML allowlist if authors need bold UI
 */
export function textToEmailHtml(text: string): string {
  const blocks = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const html = block
        .split(/\n/)
        .map((line) => linkifyPlainLine(line))
        .join("<br/>");
      return `<p>${html}</p>`;
    });
  return blocks.join("") || "<p></p>";
}

function linkifyPlainLine(line: string): string {
  const re = /https?:\/\/[^\s]+/g;
  let out = "";
  let last = 0;
  for (const match of line.matchAll(re)) {
    const idx = match.index ?? 0;
    out += escapeHtml(line.slice(last, idx));
    const raw = match[0];
    const trimmed = raw.replace(/[.,;:!?)\]\}]+$/u, "");
    const trailing = raw.slice(trimmed.length);
    out += safeHttpAnchor(trimmed) + escapeHtml(trailing);
    last = idx + raw.length;
  }
  out += escapeHtml(line.slice(last));
  return out;
}

function safeHttpAnchor(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return escapeHtml(url);
    }
    const href = escapeHtml(parsed.href);
    const label = escapeHtml(url);
    return `<a href="${href}">${label}</a>`;
  } catch {
    return escapeHtml(url);
  }
}
