/**
 * Collapse multiple content sections into one canvas document.
 * Location: packages/legacy-importer/src/recognition/coalesceContentCanvas.ts
 */

import type {
  EmailBlock,
  EmailSection,
  LayoutRowBlock,
  NormalizedEmailDocument,
} from "../document.js";
import { normalizeSectionRole } from "../document.js";
import { nextId } from "../ids.js";

function roleOf(section: EmailSection): string {
  return normalizeSectionRole(section.role) ?? "content";
}

function blocksFromContentSection(section: EmailSection): EmailBlock[] {
  if (section.columns.length <= 1) {
    return [...(section.columns[0]?.children ?? [])];
  }
  const row: LayoutRowBlock = {
    id: nextId("lr"),
    type: "layout-row",
    columns: section.columns,
  };
  return [row];
}

/**
 * Ensure at most one content section. Multi-column content → layout-row block.
 * Chrome roles (header/footer/social) keep relative order.
 */
export function coalesceContentCanvas(
  doc: NormalizedEmailDocument,
): NormalizedEmailDocument {
  const headers: EmailSection[] = [];
  const contents: EmailSection[] = [];
  const footers: EmailSection[] = [];
  const socials: EmailSection[] = [];
  const other: EmailSection[] = [];

  for (const section of doc.children) {
    const role = roleOf(section);
    if (role === "header") headers.push(section);
    else if (role === "footer") footers.push(section);
    else if (role === "social") socials.push(section);
    else if (role === "content") contents.push(section);
    else other.push(section);
  }

  const needsMerge =
    contents.length !== 1 ||
    (contents[0] !== undefined && contents[0].columns.length > 1) ||
    other.length > 0;

  if (!needsMerge && contents.length === 1) {
    return doc;
  }

  const blocks: EmailBlock[] = [];
  for (const section of contents) {
    blocks.push(...blocksFromContentSection(section));
  }
  for (const section of other) {
    blocks.push(...blocksFromContentSection(section));
  }

  const canvas: EmailSection = {
    id: contents[0]?.id ?? nextId("sec"),
    type: "section",
    role: "content",
    padding: contents[0]?.padding,
    backgroundColor: contents[0]?.backgroundColor,
    columns: [
      {
        id: nextId("col"),
        width: 100,
        children:
          blocks.length > 0
            ? blocks
            : [
                {
                  id: nextId("rt"),
                  type: "rich-text",
                  html: "<p></p>",
                },
              ],
      },
    ],
  };

  return {
    ...doc,
    children: [...headers, canvas, ...footers, ...socials],
  };
}
