/**
 * Convert a table cell into normalized EmailBlock[].
 * Location: packages/legacy-importer/src/recognition/cells.ts
 */

import { parseHTML } from "linkedom";
import type { EmailBlock, LegacyHtmlBlock } from "../document.js";
import { nextId } from "../ids.js";
import {
  buttonFromElement,
  isButtonOnlyRoot,
  looksLikeButton,
} from "./buttons.js";
import { imageFromElement, imagesFromCell, isImageOnlyCell } from "./images.js";
import { findTextRoots, richTextFromElement, textOf } from "./richText.js";
import { isSocialCluster, socialBlockFromElement } from "./social.js";

function legacy(html: string, reason: string): LegacyHtmlBlock {
  return {
    id: nextId("legacy"),
    type: "legacy-html",
    html,
    reason,
  };
}

/** Unwrap single nested layout table → work on its cell content. */
function unwrapSingleTable(cell: Element): Element {
  const tables = [...cell.querySelectorAll(":scope > table")];
  if (tables.length !== 1) return cell;
  const only = tables[0]!;
  const innerCells = only.querySelectorAll("td, th");
  if (innerCells.length === 1) return innerCells[0] as Element;
  return cell;
}

export function convertCellContent(
  cell: Element,
  opts?: { role?: string; preferImages?: boolean },
): EmailBlock[] {
  const working = unwrapSingleTable(cell);
  const out: EmailBlock[] = [];

  if (isSocialCluster(working)) {
    const social = socialBlockFromElement(working);
    if (social) return [social];
  }

  // Whole-cell CTA only when the cell is essentially a single button
  if (isButtonOnlyRoot(working)) {
    const btn = buttonFromElement(working);
    if (btn) return [btn];
  }

  if (isImageOnlyCell(working) || opts?.preferImages) {
    const imgs = imagesFromCell(working, opts?.role);
    if (imgs.length > 0) return imgs;
  }

  const imgs = [...working.querySelectorAll("img")];
  const textRoots = findTextRoots(working);
  const hasNestedDeepTables =
    working.querySelectorAll("table table").length > 0;

  if (
    hasNestedDeepTables &&
    !isImageOnlyCell(working) &&
    textOf(working).length < 5
  ) {
    const nestedImgs = imagesFromCell(working, opts?.role);
    if (nestedImgs.length > 0 && textOf(working).length < 3) {
      return nestedImgs;
    }
  }

  if (textRoots.length > 0 && textOf(working)) {
    for (const root of textRoots) {
      // nl2go textstyle with prose + links stays rich-text; only lone CTAs → button
      if (isButtonOnlyRoot(root) && looksLikeButton(root)) {
        const btn = buttonFromElement(root);
        if (btn) out.push(btn);
        continue;
      }
      if (isImageOnlyCell(root)) {
        out.push(...imagesFromCell(root, opts?.role));
        continue;
      }
      const rt = richTextFromElement(root, opts?.role);
      if (rt) out.push(rt);
    }
    for (const img of imgs) {
      if (!textRoots.some((r) => r.contains(img))) {
        const block = imageFromElement(img);
        if (block) out.push(block);
      }
    }
    if (out.length > 0) return out;
  }

  if (imgs.length && textOf(working)) {
    for (const img of imgs) {
      const block = imageFromElement(img);
      if (block) out.push(block);
    }
    const cloneHtml = working.innerHTML.replace(/<img\b[^>]*>/gi, "");
    const { document } = parseHTML(`<div id="x">${cloneHtml}</div>`);
    const node = document.getElementById("x");
    if (node && textOf(node)) {
      const rt = richTextFromElement(node, opts?.role);
      if (rt) out.push(rt);
    }
    return out.length ? out : [legacy(working.innerHTML, "mixed-fallback")];
  }

  if (imgs.length) {
    return imagesFromCell(working, opts?.role);
  }

  if (textOf(working)) {
    const rt = richTextFromElement(working, opts?.role);
    if (rt) return [rt];
  }

  if (working.innerHTML.trim()) {
    return [legacy(working.innerHTML, "unrecognized-cell")];
  }
  return out;
}
