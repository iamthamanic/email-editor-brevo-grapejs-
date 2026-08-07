/**
 * Conversion quality report from source inventory + normalized doc + grapes emit.
 * Location: packages/legacy-importer/src/validation/validateConversion.ts
 */

import type { NormalizedEmailDocument } from "../document.js";
import type { ConversionReport, GrapesComponentDef } from "../types.js";
import {
  collectInventory,
  inventoryFromSerialized,
  normalizeVisibleText,
  type Inventory,
} from "./inventory.js";

function walkDoc(doc: NormalizedEmailDocument) {
  let sectionCount = 0;
  let columnCount = 0;
  let richTextCount = 0;
  let imageCount = 0;
  let socialGroupCount = 0;
  let legacyBlockCount = 0;
  const texts: string[] = [];

  for (const sec of doc.children) {
    sectionCount += 1;
    columnCount += sec.columns.length;
    for (const col of sec.columns) {
      for (const b of col.children) {
        switch (b.type) {
          case "rich-text":
            richTextCount += 1;
            texts.push(b.html.replace(/<[^>]+>/g, " "));
            break;
          case "image":
            imageCount += 1;
            break;
          case "social-links":
            socialGroupCount += 1;
            break;
          case "legacy-html":
            legacyBlockCount += 1;
            texts.push(b.html.replace(/<[^>]+>/g, " "));
            break;
          case "company-information":
            texts.push(
              [b.companyName, ...b.addressLines, b.phone, b.email, b.website]
                .filter(Boolean)
                .join(" "),
            );
            break;
          case "corporate-footer":
            texts.push(
              [b.company.companyName, ...b.company.addressLines]
                .filter(Boolean)
                .join(" "),
            );
            if (b.certificationImage) imageCount += 1;
            break;
          case "button":
            texts.push(b.label);
            break;
          default:
            break;
        }
      }
    }
  }

  return {
    sectionCount,
    columnCount,
    richTextCount,
    imageCount,
    socialGroupCount,
    legacyBlockCount,
    text: normalizeVisibleText(texts.join(" ")),
  };
}

function countPreserved(expected: string[], found: Set<string> | string[]): number {
  const set = found instanceof Set ? found : new Set(found);
  return expected.filter((x) => {
    if (set.has(x)) return true;
    // substring match for encoded urls
    for (const f of set) {
      if (f.includes(x) || x.includes(f)) return true;
    }
    return false;
  }).length;
}

export function buildConversionReport(
  sourceHtml: string,
  document: NormalizedEmailDocument,
  components: GrapesComponentDef[],
  warnings: string[],
): ConversionReport {
  const source = collectInventory(sourceHtml);
  const serialized = JSON.stringify(components);
  const output = inventoryFromSerialized(serialized);
  const stats = walkDoc(document);

  const sourceParams = source.variables;
  const outputParams = output.variables;
  const sourceImages = source.images;
  const outputImages = [...new Set([...output.images, ...extractImgFromDoc(document)])];
  const sourceLinks = source.links;
  const outputLinks = [...new Set([...output.links, ...extractLinksFromDoc(document)])];

  const variables = {
    expected: sourceParams.length,
    preserved: countPreserved(sourceParams, outputParams),
  };
  const images = {
    expected: sourceImages.length,
    preserved: countPreserved(sourceImages, outputImages),
  };
  const links = {
    expected: sourceLinks.length,
    preserved: countPreserved(sourceLinks, outputLinks),
  };

  // Text: every significant source token should appear in doc text or serialized
  const textPreserved =
    !source.text ||
    source.text.length < 3 ||
    tokensCovered(source.text, `${stats.text} ${output.text}`);

  const unknownBlockCount = stats.legacyBlockCount;
  const totalBlocks = Math.max(
    1,
    stats.richTextCount +
      stats.imageCount +
      stats.socialGroupCount +
      stats.legacyBlockCount +
      1,
  );
  const coverage = Math.max(
    0,
    Math.min(1, 1 - stats.legacyBlockCount / totalBlocks),
  );

  const autoApproved =
    variables.preserved === variables.expected &&
    images.preserved === images.expected &&
    links.preserved === links.expected &&
    textPreserved &&
    stats.legacyBlockCount === 0 &&
    coverage >= 0.95;

  if (!textPreserved) warnings.push("Visible text coverage incomplete");
  if (stats.legacyBlockCount > 0) {
    warnings.push(`${stats.legacyBlockCount} legacy-html block(s)`);
  }

  return {
    variables,
    images,
    links,
    textPreserved,
    sourceParams,
    outputParams,
    sourceImages,
    outputImages,
    sourceLinks,
    outputLinks,
    sectionCount: stats.sectionCount,
    columnCount: stats.columnCount,
    richTextCount: stats.richTextCount,
    imageCount: stats.imageCount,
    socialGroupCount: stats.socialGroupCount,
    legacyBlockCount: stats.legacyBlockCount,
    unknownBlockCount,
    unknownBlocks: unknownBlockCount,
    warnings,
    coverage,
    autoApproved,
  };
}

function tokensCovered(source: string, haystack: string): boolean {
  const tokens = source.split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return true;
  const hit = tokens.filter((t) => haystack.includes(t)).length;
  return hit / tokens.length >= 0.85;
}

function extractImgFromDoc(doc: NormalizedEmailDocument): string[] {
  const out: string[] = [];
  for (const s of doc.children) {
    for (const c of s.columns) {
      for (const b of c.children) {
        if (b.type === "image") out.push(b.src);
        if (b.type === "corporate-footer" && b.certificationImage) {
          out.push(b.certificationImage.src);
        }
        if (b.type === "company-information" && b.logoSrc) out.push(b.logoSrc);
        if (b.type === "social-links") {
          for (const i of b.items) if (i.imageSrc) out.push(i.imageSrc);
        }
      }
    }
  }
  return out;
}

function extractLinksFromDoc(doc: NormalizedEmailDocument): string[] {
  const out: string[] = [];
  for (const s of doc.children) {
    for (const c of s.columns) {
      for (const b of c.children) {
        if (b.type === "button") out.push(b.href);
        if (b.type === "social-links") {
          for (const i of b.items) out.push(i.href);
        }
        if (b.type === "company-information") {
          if (b.website) out.push(b.website);
          if (b.email) out.push(`mailto:${b.email}`);
          if (b.phone) {
            const digits = b.phone.replace(/[^\d+]/g, "");
            out.push(b.phone.startsWith("tel:") ? b.phone : `tel:${digits || b.phone}`);
            out.push(b.phone);
          }
        }
        if (b.type === "corporate-footer") {
          if (b.company.website) out.push(b.company.website);
          if (b.company.email) out.push(`mailto:${b.company.email}`);
          if (b.company.phone) {
            out.push(`tel:${b.company.phone.replace(/[^\d+]/g, "")}`);
            out.push(b.company.phone);
          }
        }
        if (b.type === "rich-text") {
          for (const m of b.html.matchAll(/href="([^"]+)"/g)) out.push(m[1]!);
        }
        if (b.type === "legacy-html") {
          for (const m of b.html.matchAll(/href="([^"]+)"/g)) out.push(m[1]!);
        }
      }
    }
  }
  return out;
}

export { collectInventory };
export type { Inventory };
