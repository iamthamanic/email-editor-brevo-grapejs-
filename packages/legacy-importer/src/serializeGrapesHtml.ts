/**
 * Serialize GrapesComponentDef trees to marker HTML (Grapes getHtml stand-in).
 * Location: packages/legacy-importer/src/serializeGrapesHtml.ts
 *
 * Used for R1 golden round-trips without a live Grapes instance. Emits the same
 * data-email-type / data-section-role / data-role markers the editor publish path keeps.
 */

import type { GrapesComponentDef } from "./types.js";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function attrsToString(attrs: Record<string, string> | undefined): string {
  if (!attrs) return "";
  let out = "";
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw == null) continue;
    out += ` ${key}="${escapeAttr(String(raw))}"`;
  }
  return out;
}

function resolveTag(node: GrapesComponentDef): string {
  if (node.tagName) return String(node.tagName).toLowerCase();
  const type = node.type ?? "";
  switch (type) {
    case "email-section":
    case "email-layout-row":
      return "table";
    case "email-row":
      return "tr";
    case "email-column":
      return "td";
    case "email-image":
      return "img";
    case "email-button":
      return "a";
    case "email-param":
      return "span";
    case "email-divider":
      return "hr";
    default:
      return "div";
  }
}

function isVoid(tag: string, node: GrapesComponentDef): boolean {
  if (node.void) return true;
  return tag === "img" || tag === "hr" || tag === "br";
}

function childrenAreRows(kids: GrapesComponentDef[]): boolean {
  return (
    kids.length > 0 &&
    kids.every(
      (c) =>
        c.type === "email-row" ||
        String(c.tagName ?? "").toLowerCase() === "tr",
    )
  );
}

/** One Grapes component → HTML fragment with canvas markers. */
export function serializeGrapesComponent(node: GrapesComponentDef): string {
  const tag = resolveTag(node);
  const attrs = attrsToString(node.attributes);

  if (isVoid(tag, node)) {
    return `<${tag}${attrs} />`;
  }

  let inner = "";
  if (typeof node.components === "string") {
    inner = node.components;
  } else if (Array.isArray(node.components) && node.components.length > 0) {
    const kids = node.components;
    const body = kids.map(serializeGrapesComponent).join("");
    if (tag === "table" && childrenAreRows(kids)) {
      inner = `<tbody>${body}</tbody>`;
    } else {
      inner = body;
    }
  } else if (node.content) {
    inner = node.content;
  }

  return `<${tag}${attrs}>${inner}</${tag}>`;
}

/**
 * Mirror of editor `buildPublishHtml`: wrap body HTML (+ optional CSS) for Brevo.
 */
export function grapesComponentsToPublishHtml(
  components: GrapesComponentDef[],
  css = "",
): string {
  const body = components.map(serializeGrapesComponent).join("\n");
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>` +
    `<style>${safeCss}</style></head><body>${body}</body></html>`
  );
}
