/**
 * Semantic section recognition from Brevo table rows.
 * Location: packages/legacy-importer/src/recognition/sections.ts
 */

import type {
  EmailBlock,
  EmailColumn,
  EmailSection,
  NormalizedEmailDocument,
  SpacerBlock,
} from "../document.js";
import { nextId } from "../ids.js";
import { convertCellContent } from "./cells.js";
import {
  columnWidthPercent,
  normalizeColumnWidths,
} from "./columns.js";
import { tryFooterColumns, looksLikeCompanyFooterCell } from "./footer.js";
import { isImageOnlyCell } from "./images.js";
import { textOf } from "./richText.js";
import { isSocialCluster, socialBlockFromElement } from "./social.js";
import { findMultiColumnLayoutCells } from "./unwrap.js";
import { coalesceContentCanvas } from "./coalesceContentCanvas.js";

function isDecorativeRow(cells: Element[]): boolean {
  return cells.every(
    (c) => textOf(c).length === 0 && c.querySelectorAll("img").length === 0,
  );
}

function spacerBlock(height?: number): SpacerBlock {
  return { id: nextId("sp"), type: "spacer", height };
}

function sectionFromColumns(
  columns: EmailColumn[],
  role?: string,
): EmailSection {
  return {
    id: nextId("sec"),
    type: "section",
    role,
    columns,
  };
}

function singleColumn(blocks: EmailBlock[], role?: string): EmailSection {
  return sectionFromColumns(
    [{ id: nextId("col"), width: 100, children: blocks }],
    role,
  );
}

function convertCellsAsRow(
  cells: Element[],
  index: number,
  total: number,
  fallbackHtml?: string,
): EmailSection[] {
  if (cells.length === 0) return [];

  if (isDecorativeRow(cells)) {
    const h = Number.parseInt(cells[0]?.getAttribute("height") ?? "", 10);
    return [
      singleColumn([
        spacerBlock(Number.isFinite(h) ? h : undefined),
      ]),
    ];
  }

  // Whole-row social cluster
  if (cells.length === 1 && isSocialCluster(cells[0]!)) {
    const social = socialBlockFromElement(cells[0]!);
    if (social) return [singleColumn([social], "social")];
  }

  const nearEnd = index >= Math.max(0, total - 2);

  // Single outer cell that still wraps a real 50/50 (Brevo presentation chrome)
  if (cells.length === 1 && nearEnd) {
    const nested = findMultiColumnLayoutCells(cells[0]!);
    if (nested && nested.length >= 2) {
      return convertCellsAsRow(nested, index, total, fallbackHtml);
    }
  }

  if (cells.length === 2) {
    const footer = tryFooterColumns(cells, nearEnd);
    if (footer) {
      return [
        sectionFromColumns(
          [
            {
              id: nextId("col"),
              width: 50,
              children: footer.left,
            },
            {
              id: nextId("col"),
              width: 50,
              children: footer.right,
            },
          ],
          "footer",
        ),
      ];
    }
  }

  if (cells.length >= 2) {
    const rawWidths = cells.map((c) =>
      columnWidthPercent(c, Math.floor(100 / cells.length)),
    );
    const widths = normalizeColumnWidths(rawWidths);
    const columns: EmailColumn[] = cells.map((cell, i) => ({
      id: nextId("col"),
      width: widths[i] ?? Math.floor(100 / cells.length),
      children: convertCellContent(cell),
    }));
    if (columns.every((c) => c.children.length === 0)) {
      return [
        singleColumn([
          {
            id: nextId("legacy"),
            type: "legacy-html",
            html: fallbackHtml ?? cells.map((c) => c.outerHTML).join(""),
            reason: "empty-multi-column",
          },
        ]),
      ];
    }
    // Near-end structural 50/50 with company+cert signals → footer even if
    // tryFooterColumns heuristics were slightly short (after unwrap).
    if (
      nearEnd &&
      columns.length === 2 &&
      (widths[0] ?? 0) >= 40 &&
      (widths[0] ?? 0) <= 60 &&
      (widths[1] ?? 0) >= 40 &&
      (widths[1] ?? 0) <= 60
    ) {
      const footer = tryFooterColumns(cells, true);
      if (footer) {
        return [
          sectionFromColumns(
            [
              {
                id: nextId("col"),
                width: 50,
                children: footer.left,
              },
              {
                id: nextId("col"),
                width: 50,
                children: footer.right,
              },
            ],
            "footer",
          ),
        ];
      }
    }
    return [sectionFromColumns(columns, "content")];
  }

  // Single cell — first image-only row is semantic header
  const cell = cells[0]!;
  const isHeader = index === 0 && isImageOnlyCell(cell);
  const isFooter =
    !isHeader &&
    nearEnd &&
    looksLikeCompanyFooterCell(cell) &&
    !isSocialCluster(cell);
  // Always assign a section role (incl. content) for stable Grapes serialization
  const role = isHeader ? "header" : isFooter ? "footer" : "content";
  const blocks = convertCellContent(cell, {
    role: isHeader ? "brand-logo" : undefined,
  });
  if (blocks.length === 0) return [];
  if (index === 1) {
    for (const b of blocks) {
      if (b.type === "rich-text" && !b.role) b.role = "main-content";
    }
  }
  if (isFooter) {
    const imgs = blocks.filter(
      (b): b is Extract<EmailBlock, { type: "image" }> => b.type === "image",
    );
    if (imgs.length >= 2) {
      imgs[0]!.role = "brand-logo";
      imgs[imgs.length - 1]!.role = "certifications";
    } else if (imgs[0] && !imgs[0].role) {
      imgs[0].role = "brand-logo";
    }
  }
  const section = singleColumn(blocks, role);
  if (isHeader) {
    const pad = extractPadding(cell);
    if (pad) section.padding = pad;
  }
  return [section];
}

function convertRow(
  tr: Element,
  index: number,
  total: number,
): EmailSection[] {
  let cells = [...tr.querySelectorAll(":scope > th, :scope > td")];
  // Brevo wraps real 50/50 rows in single-child presentation tables
  if (cells.length <= 1) {
    const unwrapped = findMultiColumnLayoutCells(tr);
    if (unwrapped && unwrapped.length >= 2) {
      cells = unwrapped;
    }
  }
  return convertCellsAsRow(cells, index, total, tr.outerHTML);
}

/** Read CSS padding from cell / nested td when present. */
function extractPadding(el: Element): string | undefined {
  const candidates = [el, ...el.querySelectorAll("td, th")];
  for (const node of candidates) {
    const style = node.getAttribute("style") ?? "";
    const m = /padding\s*:\s*([^;]+)/i.exec(style);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
}

function directTableRows(table: Element): Element[] {
  return [...table.querySelectorAll(":scope > tbody > tr, :scope > tr")];
}

/**
 * Real Brevo layout: content canvas (often width=600) has one cell whose
 * direct children are modular section tables (header / body / footer / social).
 */
function findSiblingSectionTables(root: Element): Element[] | null {
  const rows = directTableRows(root);
  if (rows.length !== 1) return null;
  const cells = [
    ...rows[0]!.querySelectorAll(":scope > td, :scope > th"),
  ];
  if (cells.length !== 1) return null;
  const tables = [...cells[0]!.querySelectorAll(":scope > table")];
  return tables.length >= 2 ? tables : null;
}

/**
 * Convert one Brevo modular section table (usually 1 row) using sibling index
 * for header/footer/social heuristics.
 */
function convertSectionTable(
  table: Element,
  index: number,
  total: number,
): EmailSection[] {
  // Prefer unwrapping presentation chrome before treating outer tr as content
  const layoutCells = findMultiColumnLayoutCells(table);
  if (layoutCells && layoutCells.length >= 2) {
    return convertCellsAsRow(layoutCells, index, total, table.outerHTML);
  }

  const rows = directTableRows(table);
  if (rows.length === 0) {
    return convertRow(table, index, total);
  }
  if (rows.length === 1) {
    return convertRow(rows[0]!, index, total);
  }
  const out: EmailSection[] = [];
  rows.forEach((tr, i) => {
    out.push(...convertRow(tr, index + i, total + rows.length));
  });
  return out;
}

/**
 * Build NormalizedEmailDocument from sanitized email root element.
 */
export function recognizeDocument(
  root: Element,
  settings: { width?: number; backgroundColor?: string },
  source: "brevo" | "html",
): NormalizedEmailDocument {
  const children: EmailSection[] = [];
  const siblingTables = findSiblingSectionTables(root);

  if (siblingTables) {
    siblingTables.forEach((table, i) => {
      children.push(...convertSectionTable(table, i, siblingTables.length));
    });
  } else {
    const rootRows = directTableRows(root);
    const rows =
      rootRows.length > 0
        ? rootRows
        : [...root.querySelectorAll("tr")].slice(0, 60);

    if (rows.length === 0) {
      const html = root.innerHTML.trim();
      children.push(
        singleColumn([
          {
            id: nextId("legacy"),
            type: "legacy-html",
            html: html || "<p></p>",
            reason: "no-rows",
          },
        ]),
      );
    } else {
      rows.forEach((tr, i) => {
        // Skip rows that belong to nested tables (not direct children of root)
        const parentTable = tr.closest("table");
        if (parentTable && parentTable !== root) return;
        children.push(...convertRow(tr, i, rows.length));
      });
    }
  }

  if (children.length === 0) {
    children.push(
      singleColumn([
        {
          id: nextId("legacy"),
          type: "legacy-html",
          html: root.innerHTML,
          reason: "empty-recognition",
        },
      ]),
    );
  }

  return coalesceContentCanvas({
    version: 1,
    settings: {
      width: settings.width,
      backgroundColor: settings.backgroundColor,
    },
    children,
    metadata: { source },
  });
}
