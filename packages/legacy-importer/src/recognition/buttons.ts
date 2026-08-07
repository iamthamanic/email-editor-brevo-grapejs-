/**
 * CTA / button detection — requires real button chrome, not plain links.
 * Location: packages/legacy-importer/src/recognition/buttons.ts
 */

import type { ButtonBlock } from "../document.js";
import { nextId } from "../ids.js";
import { textOf } from "./richText.js";

function styleBlob(el: Element): string {
  return (el.getAttribute("style") ?? "").toLowerCase();
}

function hasOpaqueBackground(style: string): boolean {
  if (!/background(-color)?\s*:/.test(style)) return false;
  return !/background(-color)?\s*:\s*(transparent|none|inherit|initial)/i.test(
    style,
  );
}

function hasButtonClass(el: Element): boolean {
  const cls = `${el.className ?? ""}`;
  return /(?:^|[\s_-])(btn|button|cta|default-button)(?:$|[\s_-])/i.test(cls);
}

/**
 * Score button signals. Plain `<a>` with only padding is NOT a button.
 * Brevo textstyle links stay inline rich-text.
 */
export function looksLikeButton(el: Element): boolean {
  const a = el.tagName.toLowerCase() === "a" ? el : el.querySelector("a");
  if (!a) return false;
  const href = (a.getAttribute("href") ?? "").trim();
  if (!href || /^\s*javascript:/i.test(href)) return false;
  const text = textOf(a);
  if (!text || text.length >= 80) return false;

  // Multiple links / surrounding copy → treat as rich text, not a lone CTA
  const links = el.querySelectorAll("a");
  if (links.length > 1) return false;
  const allText = textOf(el);
  if (allText.length > text.length + 8) return false;

  const style = `${styleBlob(a)} ${styleBlob(el)}`;
  const parentTd = a.closest("td, th");
  const parentStyle = parentTd ? styleBlob(parentTd) : "";
  const combined = `${style} ${parentStyle}`;

  let score = 0;
  if (hasOpaqueBackground(combined)) score += 2;
  if (/border-radius\s*:/.test(combined)) score += 1;
  if (hasButtonClass(a) || hasButtonClass(el)) score += 2;
  if (/default-button/i.test(clsName(a) + clsName(el))) score += 2;
  // Soft padding alone is NOT enough (Brevo inline links often have padding)
  if (
    /padding\s*:\s*\d/.test(combined) &&
    (hasOpaqueBackground(combined) || /border-radius\s*:/.test(combined))
  ) {
    score += 1;
  }
  // Table wrapper with bgcolor attribute (classic Brevo button cell)
  if (parentTd?.getAttribute("bgcolor")) score += 2;

  return score >= 2;
}

function clsName(el: Element): string {
  return String(el.className ?? "");
}

/** True when the element is essentially a single CTA link (no other prose). */
export function isButtonOnlyRoot(el: Element): boolean {
  if (!looksLikeButton(el)) return false;
  const a = el.tagName.toLowerCase() === "a" ? el : el.querySelector("a");
  if (!a) return false;
  return textOf(el).length <= textOf(a).length + 5;
}

export function buttonFromElement(el: Element): ButtonBlock | null {
  const a =
    el.tagName.toLowerCase() === "a"
      ? el
      : el.querySelector("a");
  if (!a) return null;
  const href = (a.getAttribute("href") ?? "").trim();
  if (!href || /^\s*javascript:/i.test(href)) return null;
  return {
    id: nextId("btn"),
    type: "button",
    label: textOf(a) || "Button",
    href,
  };
}
