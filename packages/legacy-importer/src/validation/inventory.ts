/**
 * Source/output inventory for preservation checks.
 * Location: packages/legacy-importer/src/validation/inventory.ts
 */

import { extractParamKeys } from "@email-template/email-variables";
import { parseHTML } from "linkedom";

export interface Inventory {
  variables: string[];
  images: string[];
  links: string[];
  text: string;
}

export function normalizeVisibleText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function collectInventory(html: string): Inventory {
  const variables = extractParamKeys(html);
  const { document } = parseHTML(
    html.includes("<html") ? html : `<body>${html}</body>`,
  );
  const images = [...document.querySelectorAll("img")]
    .map((img) => img.getAttribute("src") ?? "")
    .filter(Boolean);
  const links = [...document.querySelectorAll("a[href]")]
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h && !/^\s*javascript:/i.test(h));
  const text = normalizeVisibleText(document.body?.textContent ?? html);
  return { variables, images, links, text };
}

export function inventoryFromSerialized(output: string): {
  variables: string[];
  images: string[];
  links: string[];
  text: string;
} {
  const variables = new Set(extractParamKeys(output));
  for (const m of output.matchAll(/data-param-key":"([^"]+)"/g)) {
    variables.add(m[1]!);
  }
  const images = [
    ...output.matchAll(/"src":"([^"]+)"/g),
  ].map((m) => m[1]!.replace(/\\u002F/g, "/"));
  // also bare urls in content
  const links = [
    ...output.matchAll(/"href":"([^"]+)"/g),
  ].map((m) => m[1]!);
  // strip tags for text approx from html fragments in json
  const text = normalizeVisibleText(
    output
      .replace(/\\"/g, '"')
      .replace(/<[^>]+>/g, " ")
      .replace(/\{\{\s*params\.[^}]+\}\}/g, " "),
  );
  return {
    variables: [...variables],
    images,
    links,
    text,
  };
}
