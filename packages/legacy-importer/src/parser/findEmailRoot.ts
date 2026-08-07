/**
 * Locate Brevo email root table and width.
 * Location: packages/legacy-importer/src/parser/findEmailRoot.ts
 *
 * Outer nl2go-body-table is often a 100% wrapper with one cell that holds
 * the real width=600 content table — use that content table as root.
 */

export interface EmailRootInfo {
  root: Element;
  width?: number;
  backgroundColor?: string;
}

function parseWidth(el: Element): number | undefined {
  const w = el.getAttribute("width") ?? "";
  const n = Number.parseInt(w, 10);
  if (Number.isFinite(n) && n >= 200 && n <= 900) return n;
  // 100% wrappers are not content width
  if (w === "100%") return undefined;
  const style = el.getAttribute("style") ?? "";
  const m = /width\s*:\s*(\d+)\s*px/i.exec(style);
  if (m) {
    const px = Number.parseInt(m[1]!, 10);
    if (px >= 200 && px <= 900) return px;
  }
  return undefined;
}

function directRows(table: Element): Element[] {
  return [...table.querySelectorAll(":scope > tbody > tr, :scope > tr")];
}

/**
 * If `candidate` is a Brevo wrapper (1 row / 1 cell / nested content table),
 * return the nested content table; otherwise `candidate`.
 *
 * Real Brevo often uses: 100% wrapper → table[width=600] (still 1 row) →
 * sibling block tables inside that cell. We must unwrap to the 600 box even
 * when it only has one row.
 */
export function resolveContentRoot(candidate: Element): Element {
  let current = candidate;
  // Unwrap a few levels of centering wrappers
  for (let depth = 0; depth < 6; depth += 1) {
    const rows = directRows(current);
    if (rows.length !== 1) break;
    const cells = [
      ...rows[0]!.querySelectorAll(":scope > td, :scope > th"),
    ];
    if (cells.length !== 1) break;
    const cell = cells[0]!;

    // Already at modular Brevo body: one cell, many sibling section tables
    const siblingSections = [
      ...cell.querySelectorAll(":scope > table"),
    ];
    if (siblingSections.length >= 2) {
      break;
    }

    const nested =
      cell.querySelector(':scope > table[width="600"]') ??
      cell.querySelector(':scope > table[style*="600px"]') ??
      cell.querySelector(':scope > table[align="center"]') ??
      cell.querySelector(":scope > table.nl2go-body-table") ??
      cell.querySelector(":scope > table");
    if (!nested) break;

    const nestedRows = directRows(nested);
    const nestedWidth = parseWidth(nested);
    const isContentWidth =
      Boolean(nestedWidth) ||
      nested.getAttribute("width") === "600" ||
      /(?:^|;)\s*width\s*:\s*600px/i.test(nested.getAttribute("style") ?? "");

    // Prefer nested table when it has more section rows, or is the fixed-width canvas
    if (
      nestedRows.length >= 2 ||
      nestedRows.length > rows.length ||
      isContentWidth
    ) {
      current = nested;
      continue;
    }
    break;
  }
  return current;
}

function bgOf(el: Element): string | undefined {
  const attr = el.getAttribute("bgcolor");
  if (attr) return attr;
  const m = /background(?:-color)?\s*:\s*([^;]+)/i.exec(
    el.getAttribute("style") ?? "",
  );
  const v = m?.[1]?.trim();
  return v || undefined;
}

export function findEmailRoot(document: Document): EmailRootInfo {
  const bodyTable =
    document.querySelector("table.nl2go-body-table") ??
    document.querySelector('table[width="600"]') ??
    document.querySelector("table[style*='600px']") ??
    document.querySelector('table[align="center"]');

  if (bodyTable) {
    const root = resolveContentRoot(bodyTable);
    let width = parseWidth(root) ?? parseWidth(bodyTable);
    if (!width) {
      const inner = root.querySelector(
        'table[width="600"], table[style*="600"]',
      );
      if (inner) width = parseWidth(inner);
    }
    return {
      root,
      width,
      backgroundColor: bgOf(root) ?? bgOf(bodyTable),
    };
  }

  const body = document.body;
  if (body) return { root: body };
  return { root: document.documentElement };
}
