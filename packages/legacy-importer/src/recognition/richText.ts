/**
 * Rich-text extraction — preserves p/br/strong/links (not textContent).
 * Location: packages/legacy-importer/src/recognition/richText.ts
 */

import type { RichTextBlock } from "../document.js";
import { nextId } from "../ids.js";
import { sanitizeRichHtml } from "../parser/sanitize.js";

export function textOf(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function richTextFromElement(
  el: Element,
  role?: string,
): RichTextBlock | null {
  const raw = el.innerHTML.trim();
  if (!raw) return null;
  const html = sanitizeRichHtml(raw);
  if (!html.trim() && !textOf(el)) return null;
  return {
    id: nextId("rt"),
    type: "rich-text",
    role,
    html: html || `<p>${escapeText(textOf(el))}</p>`,
  };
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Prefer nl2go textstyle container if present. */
export function findTextRoots(cell: Element): Element[] {
  if (cell.classList?.contains("nl2go-default-textstyle")) return [cell];
  const nested = [...cell.querySelectorAll(".nl2go-default-textstyle")];
  if (nested.length > 0) return nested;
  return [cell];
}
