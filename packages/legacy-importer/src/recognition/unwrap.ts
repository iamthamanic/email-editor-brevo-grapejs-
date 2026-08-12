/**
 * Unwrap Brevo single-child presentation tables to find real layout rows.
 * Location: packages/legacy-importer/src/recognition/unwrap.ts
 */

function directRows(table: Element): Element[] {
  return [...table.querySelectorAll(":scope > tbody > tr, :scope > tr")];
}

function directCells(tr: Element): Element[] {
  return [...tr.querySelectorAll(":scope > th, :scope > td")];
}

function onlyElementChild(el: Element): Element | null {
  const elements = [...el.children].filter(
    (c) => c.nodeType === 1,
  ) as Element[];
  return elements.length === 1 ? elements[0]! : null;
}

/**
 * From a section module / row / cell, walk single-child presentation wrappers
 * until a row with 2+ cells is found (or give up).
 *
 * Handles:
 *   table > tr > td > table > tr > th[50%] + th[50%]
 */
export function findMultiColumnLayoutCells(
  start: Element,
  maxDepth = 8,
): Element[] | null {
  let el: Element | null = start;

  for (let depth = 0; depth < maxDepth && el; depth++) {
    const tag = el.tagName.toLowerCase();

    if (tag === "tr") {
      const cells = directCells(el);
      if (cells.length >= 2) return cells;
      if (cells.length === 1) {
        const only = cells[0]!;
        const innerTable = onlyElementChild(only);
        if (innerTable && innerTable.tagName.toLowerCase() === "table") {
          el = innerTable;
          continue;
        }
        // single cell with nested table among wrappers
        const nested = only.querySelector(":scope > table");
        if (nested && onlyElementChild(only)?.tagName.toLowerCase() === "table") {
          el = nested;
          continue;
        }
      }
      return null;
    }

    if (tag === "table") {
      const rows = directRows(el);
      if (rows.length === 0) return null;
      if (rows.length === 1) {
        el = rows[0]!;
        continue;
      }
      // Multi-row module: prefer first row that already has 2+ cells
      for (const row of rows) {
        const cells = directCells(row);
        if (cells.length >= 2) return cells;
      }
      // Else dive into first row's single-cell wrapper
      el = rows[0]!;
      continue;
    }

    if (tag === "td" || tag === "th") {
      const only = onlyElementChild(el);
      if (only && only.tagName.toLowerCase() === "table") {
        el = only;
        continue;
      }
      const nested: Element | null = el.querySelector(":scope > table");
      if (
        nested &&
        onlyElementChild(el)?.tagName.toLowerCase() === "table"
      ) {
        el = nested;
        continue;
      }
      return null;
    }

    // Unknown wrapper — try sole table child
    const only = onlyElementChild(el);
    if (only && only.tagName.toLowerCase() === "table") {
      el = only;
      continue;
    }
    return null;
  }

  return null;
}
