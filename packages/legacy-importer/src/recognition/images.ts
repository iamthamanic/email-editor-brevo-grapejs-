/**
 * Image block recognition from Brevo nested image tables.
 * Location: packages/legacy-importer/src/recognition/images.ts
 */

import type { ImageBlock } from "../document.js";
import { nextId } from "../ids.js";
import { textOf } from "./richText.js";

function parsePx(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function alignmentOf(img: Element): ImageBlock["alignment"] {
  const align =
    img.getAttribute("align") ??
    img.parentElement?.getAttribute("align") ??
    img.closest("th,td")?.getAttribute("align") ??
    "";
  const style = `${img.getAttribute("style") ?? ""} ${img.parentElement?.getAttribute("style") ?? ""}`.toLowerCase();
  if (/^center$/i.test(align) || style.includes("margin:0 auto") || style.includes("text-align:center")) {
    return "center";
  }
  if (/^right$/i.test(align) || style.includes("text-align:right")) return "right";
  if (/^left$/i.test(align)) return "left";
  return "center";
}

export function imageFromElement(
  img: Element,
  role?: string,
): ImageBlock | null {
  const src = (img.getAttribute("src") ?? "").trim();
  if (!src || /^\s*javascript:/i.test(src)) return null;
  const width =
    parsePx(img.getAttribute("width")) ??
    parsePx(
      /width\s*:\s*(\d+)/i.exec(img.getAttribute("style") ?? "")?.[1],
    ) ??
    parsePx(img.closest("table")?.getAttribute("width"));
  return {
    id: nextId("img"),
    type: "image",
    role,
    src,
    alt: (img.getAttribute("alt") ?? "").trim() || "Bild",
    width,
    alignment: alignmentOf(img),
  };
}

/** Cell is image-only (optional tiny whitespace). */
export function isImageOnlyCell(cell: Element): boolean {
  const imgs = cell.querySelectorAll("img");
  if (imgs.length === 0) return false;
  const text = textOf(cell);
  const hasLinkText =
    [...cell.querySelectorAll("a")].some((a) => textOf(a).length > 0);
  return text.length < 3 && !hasLinkText;
}

export function imagesFromCell(cell: Element, role?: string): ImageBlock[] {
  const out: ImageBlock[] = [];
  for (const img of cell.querySelectorAll("img")) {
    const block = imageFromElement(img, role);
    if (block) out.push(block);
  }
  return out;
}
