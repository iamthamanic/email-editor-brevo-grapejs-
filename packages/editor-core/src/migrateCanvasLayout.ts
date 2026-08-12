/**
 * Merge multiple content sections into one canvas; multi-col → layout-row.
 * Location: packages/editor-core/src/migrateCanvasLayout.ts
 *
 * Idempotent. Safe after loadProjectData / setComponents / migrateLegacyLayout.
 */

import type { Component, Editor } from "grapesjs";

export type CanvasCompJson = {
  type?: string;
  sectionRole?: string;
  attributes?: Record<string, string | number | undefined>;
  components?: CanvasCompJson[];
  content?: string;
  columnWidth?: number;
  name?: string;
  sectionPadding?: string;
  [key: string]: unknown;
};

function attrsOf(c: CanvasCompJson): Record<string, string> {
  const a = c.attributes ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

function roleOf(c: CanvasCompJson): string {
  return String(
    c.sectionRole ??
      attrsOf(c)["data-section-role"] ??
      attrsOf(c)["data-role"] ??
      "content",
  );
}

function isEmailSection(c: CanvasCompJson): boolean {
  return String(c.type ?? "") === "email-section";
}

function kids(c: CanvasCompJson): CanvasCompJson[] {
  const raw = c.components as unknown;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null && "models" in raw) {
    const models = (raw as { models: unknown[] }).models;
    return Array.isArray(models) ? (models as CanvasCompJson[]) : [];
  }
  return [];
}

/**
 * GrapesJS often inserts anonymous `tbody` between table/`email-section` and
 * `email-row`. Collect rows without requiring them to be direct children.
 */
function directRows(section: CanvasCompJson): CanvasCompJson[] {
  const rows: CanvasCompJson[] = [];
  const walk = (node: CanvasCompJson, depth: number) => {
    const t = String(node.type ?? "");
    if (t === "email-layout-row") return;
    if (t === "email-row") {
      rows.push(node);
      return;
    }
    if (depth > 6) return;
    for (const child of kids(node)) walk(child, depth + 1);
  };
  for (const child of kids(section)) walk(child, 0);
  return rows;
}

function directColumns(row: CanvasCompJson): CanvasCompJson[] {
  const cols: CanvasCompJson[] = [];
  const walk = (node: CanvasCompJson, depth: number) => {
    const t = String(node.type ?? "");
    if (t === "email-column") {
      cols.push(node);
      return;
    }
    if (depth > 6) return;
    for (const child of kids(node)) walk(child, depth + 1);
  };
  for (const child of kids(row)) walk(child, 0);
  return cols;
}

function emptyText(): CanvasCompJson {
  return {
    type: "email-text",
    attributes: { "data-email-type": "email-text" },
    content: " ",
  };
}

function layoutRowFromColumns(cols: CanvasCompJson[]): CanvasCompJson {
  const n = Math.max(cols.length, 1);
  return {
    type: "email-layout-row",
    attributes: {
      "data-email-type": "email-layout-row",
      "data-layout": "columns",
      "data-layout-cols": String(n),
      width: "100%",
      cellpadding: "0",
      cellspacing: "0",
      border: "0",
    },
    components: [
      {
        type: "email-row",
        attributes: { "data-email-type": "email-row" },
        components: cols,
      },
    ],
  };
}

/**
 * Flatten one content section into blocks for the canvas column.
 * Single-column → leaf blocks; multi-column → one email-layout-row.
 */
export function blocksFromContentSection(
  section: CanvasCompJson,
): CanvasCompJson[] {
  const rows = directRows(section);
  if (rows.length === 0) return [];

  const out: CanvasCompJson[] = [];
  for (const row of rows) {
    const cols = directColumns(row);
    if (cols.length === 0) continue;
    if (cols.length === 1) {
      out.push(...kids(cols[0]!));
    } else {
      out.push(layoutRowFromColumns(cols));
    }
  }
  return out;
}

/** True when section is already the canonical single-column canvas. */
export function isCanonicalContentCanvas(section: CanvasCompJson): boolean {
  if (!isEmailSection(section) || roleOf(section) !== "content") return false;
  const rows = directRows(section);
  if (rows.length !== 1) return false;
  const cols = directColumns(rows[0]!);
  return cols.length === 1;
}

/**
 * Pure tree transform: exactly one content canvas among top-level sections.
 * Non-section nodes stay after sections. Relative chrome order preserved.
 */
export function migrateCanvasComponents(
  top: CanvasCompJson[],
): CanvasCompJson[] {
  const sections = top.filter(isEmailSection);
  const nonSections = top.filter((c) => !isEmailSection(c));

  const headers = sections.filter((s) => roleOf(s) === "header");
  const contents = sections.filter((s) => roleOf(s) === "content");
  const footers = sections.filter((s) => roleOf(s) === "footer");
  const socials = sections.filter((s) => roleOf(s) === "social");
  const otherRoles = sections.filter((s) => {
    const r = roleOf(s);
    return (
      r !== "header" && r !== "content" && r !== "footer" && r !== "social"
    );
  });

  if (
    contents.length === 1 &&
    isCanonicalContentCanvas(contents[0]!) &&
    otherRoles.length === 0
  ) {
    return top;
  }

  const blocks: CanvasCompJson[] = [];
  for (const sec of contents) {
    blocks.push(...blocksFromContentSection(sec));
  }
  for (const sec of otherRoles) {
    blocks.push(...blocksFromContentSection(sec));
  }

  const canvas: CanvasCompJson = {
    type: "email-section",
    name: "Inhalt",
    sectionRole: "content",
    sectionPadding: String(contents[0]?.sectionPadding ?? "16px"),
    attributes: {
      "data-email-type": "email-section",
      "data-role": "content",
      "data-section-role": "content",
      width: "100%",
      cellpadding: "0",
      cellspacing: "0",
      border: "0",
    },
    components: [
      {
        type: "email-row",
        attributes: { "data-email-type": "email-row" },
        components: [
          {
            type: "email-column",
            columnWidth: 100,
            attributes: {
              "data-email-type": "email-column",
              width: "100%",
              valign: "top",
            },
            components: blocks.length > 0 ? blocks : [emptyText()],
          },
        ],
      },
    ],
  };

  return [...headers, canvas, ...footers, ...socials, ...nonSections];
}

/**
 * Apply canvas migration on the live Grapes editor. No-op when already canonical.
 * @returns true when the tree changed
 */
export function migrateCanvasLayout(editor: Editor): boolean {
  const wrapper = editor.getWrapper();
  if (!wrapper) return false;

  const collection = wrapper.components();
  const models = [...collection.models] as Component[];
  // Grapes toJSON() can leave nested `components` as Collections — walk models.
  const topJson = models.map((m) => plainTree(m));
  const next = migrateCanvasComponents(topJson);

  try {
    if (JSON.stringify(topJson) === JSON.stringify(next)) return false;
  } catch {
    // continue with reset
  }

  collection.reset(next as object[]);
  return true;
}

/** Deep plain JSON for one component (always arrays under `components`). */
function plainTree(comp: Component): CanvasCompJson {
  const raw = comp.toJSON() as CanvasCompJson;
  const childModels = (() => {
    try {
      const col = comp.components?.();
      if (col && typeof col === "object" && "models" in col) {
        return [...(col as { models: Component[] }).models];
      }
    } catch {
      // ignore
    }
    return [] as Component[];
  })();
  return {
    ...raw,
    components: childModels.map((child) => plainTree(child)),
  };
}
