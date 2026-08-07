/**
 * Security + Brevo noise sanitization for untrusted HTML.
 * Location: packages/legacy-importer/src/parser/sanitize.ts
 */

import { parseHTML } from "linkedom";

const BLOCKED_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "link",
  "meta",
  "base",
  "svg",
  "math",
  "video",
  "audio",
  "style",
]);

/** Dynamic Brevo layout class tokens (r0-o, r1-i, …) — noise only. */
const BREVO_NOISE_CLASS = /^r\d+-[a-z]$/i;

const NOISE_ATTRS = new Set([
  "data-start",
  "data-end",
  "data-fr-linked",
  "data-gramm",
  "data-gramm_id",
  "data-gramm_editor",
]);

export function stripUnsafe(root: Element): void {
  const walk = root.querySelectorAll("*");
  for (const el of [...walk]) {
    const tag = el.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === "href" || name === "src") &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

/** Remove Brevo/editor noise attrs and classes; keep semantic classes. */
export function stripBrevoNoise(root: Element): void {
  const seenIds = new Set<string>();
  for (const el of [...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (NOISE_ATTRS.has(name)) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.id === "isPasted") {
      el.removeAttribute("id");
    }
    if (el.id) {
      if (seenIds.has(el.id)) {
        el.removeAttribute("id");
      } else {
        seenIds.add(el.id);
      }
    }
    if (el.classList?.length) {
      const keep: string[] = [];
      for (const c of [...el.classList]) {
        if (BREVO_NOISE_CLASS.test(c)) continue;
        keep.push(c);
      }
      el.className = keep.join(" ");
      if (!el.className) el.removeAttribute("class");
    }
  }
}

const RICH_ALLOWED = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "span",
  "ul",
  "ol",
  "li",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

const STYLE_ALLOWED =
  /^(color|font-weight|font-style|text-decoration|font-size|text-align)\s*:/i;

/**
 * Allowlist-sanitize a rich-text fragment (keeps structure; strips scripts/handlers).
 */
export function sanitizeRichHtml(html: string): string {
  if (!html.trim()) return "";
  const { document } = parseHTML(`<div id="__rt">${html}</div>`);
  const root = document.getElementById("__rt");
  if (!root) return "";

  stripUnsafe(root);
  stripBrevoNoise(root);

  for (const el of [...root.querySelectorAll("*")]) {
    const tag = el.tagName.toLowerCase();
    if (!RICH_ALLOWED.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name === "href" && tag === "a") {
        if (/^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
        continue;
      }
      if (name === "target" || name === "title" || name === "rel") continue;
      if (name === "style") {
        const kept = attr.value
          .split(";")
          .map((s) => s.trim())
          .filter(
            (s) =>
              s && STYLE_ALLOWED.test(s) && !/expression|url\s*\(/i.test(s),
          )
          .join("; ");
        if (kept) el.setAttribute("style", kept);
        else el.removeAttribute("style");
        continue;
      }
      el.removeAttribute(attr.name);
    }
    if (tag === "a" && el.getAttribute("href")) {
      el.setAttribute("rel", "noopener noreferrer");
    }
  }

  return root.innerHTML;
}
