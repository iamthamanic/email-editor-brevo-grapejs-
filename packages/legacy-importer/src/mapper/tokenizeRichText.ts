/**
 * DOM-based param tokenization for rich-text → GrapesJS.
 * Location: packages/legacy-importer/src/mapper/tokenizeRichText.ts
 *
 * Walks TEXT NODES only — never regex-replaces whole HTML strings
 * (avoids breaking href attributes / markup).
 *
 * Rich HTML is returned as a single HTML string with email-param badge
 * spans so GrapesJS keeps ONE contenteditable host (no double caret).
 * Flat text still becomes textnode + email-param component defs.
 */

import {
  getVariable,
  PARAM_EXPR_GLOBAL,
  splitParamExpressions,
} from "@email-template/email-variables";
import { parseHTML } from "linkedom";
import type { GrapesComponentDef } from "../types.js";

const TEXT_NODE = 3;

/** Human label for canvas pills; expression stays on data-param-key for export. */
export function paramDisplayLabel(key: string): string {
  const known = getVariable(key)?.label;
  if (known) return known;
  const parts = key.split(/[._]/).filter(Boolean);
  if (parts.length === 0) return key;
  return parts
    .map((seg, i) => {
      const lower = seg.toLowerCase();
      if (i === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .join(" ");
}

export function paramBadge(key: string): GrapesComponentDef {
  const label = paramDisplayLabel(key);
  return {
    type: "email-param",
    attributes: {
      "data-email-type": "email-param",
      "data-param-key": key,
      "data-param-label": label,
    },
  };
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Inline badge markup — GrapesJS isComponent upgrades to email-param. */
function paramBadgeHtml(key: string): string {
  const label = paramDisplayLabel(key);
  return (
    `<span data-gjs-type="email-param" data-email-type="email-param" ` +
    `data-param-key="${escapeAttr(key)}" data-param-label="${escapeAttr(label)}" ` +
    `class="email-param-badge" contenteditable="false">{{ params.${key} }}</span>`
  );
}

function tokenizeText(text: string): GrapesComponentDef[] {
  if (!text) return [];
  if (!PARAM_EXPR_GLOBAL.test(text)) {
    PARAM_EXPR_GLOBAL.lastIndex = 0;
    return [{ type: "textnode", content: text }];
  }
  PARAM_EXPR_GLOBAL.lastIndex = 0;
  const out: GrapesComponentDef[] = [];
  for (const part of splitParamExpressions(text)) {
    if (part.type === "text") {
      if (part.value) out.push({ type: "textnode", content: part.value });
    } else {
      out.push(paramBadge(part.key));
    }
  }
  return out;
}

/**
 * Replace params inside a single text node with badge <span>s (DOM-safe).
 * Leaves attributes and element structure untouched.
 */
function replaceParamsInTextNode(textNode: Text, document: Document): void {
  const text = textNode.textContent ?? "";
  if (!/\{\{\s*params\./.test(text)) return;

  const parts = splitParamExpressions(text);
  if (parts.length === 1 && parts[0]?.type === "text") return;

  const frag = document.createDocumentFragment();
  for (const part of parts) {
    if (part.type === "text") {
      if (part.value) frag.appendChild(document.createTextNode(part.value));
    } else {
      const wrap = document.createElement("div");
      wrap.innerHTML = paramBadgeHtml(part.key);
      const span = wrap.firstElementChild;
      if (span) frag.appendChild(span);
    }
  }
  textNode.parentNode?.replaceChild(frag, textNode);
}

function collectTextNodes(root: Element): Text[] {
  const out: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === TEXT_NODE) {
      out.push(node as Text);
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };
  walk(root);
  return out;
}

function walkTextNodes(root: Element, document: Document): void {
  for (const textNode of collectTextNodes(root)) {
    const parent = textNode.parentElement;
    if (
      parent?.getAttribute("data-email-type") === "email-param" ||
      parent?.hasAttribute("data-param-key")
    ) {
      continue;
    }
    replaceParamsInTextNode(textNode, document);
  }
}

/**
 * Parse rich HTML; inject email-param badge spans via text-node walk.
 * Returns HTML string for Grapes (single RTE host → one caret).
 * Flat text returns component defs.
 */
export function richTextToGrapesComponents(
  html: string,
): GrapesComponentDef[] | string {
  const trimmed = html.trim();
  if (!trimmed) return html;

  // Flat text (no tags) → component defs
  if (!/<[a-z][\s\S]*>/i.test(trimmed)) {
    const parts = tokenizeText(trimmed);
    return parts.length ? parts : trimmed;
  }

  // No params — keep HTML as-is
  if (!/\{\{\s*params\./.test(trimmed) && !/data-param-key=/.test(trimmed)) {
    return html;
  }

  const { document } = parseHTML(`<div id="__rt_root">${html}</div>`);
  const root = document.getElementById("__rt_root");
  if (!root) return html;

  walkTextNodes(root, document);
  return root.innerHTML;
}
