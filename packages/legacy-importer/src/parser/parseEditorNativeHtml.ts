/**
 * Parse editor-exported HTML (data-email-type markers) without Brevo row recognition.
 * Location: packages/legacy-importer/src/parser/parseEditorNativeHtml.ts
 *
 * Grapes getHtml() emits sibling email-section tables. Feeding that through
 * findEmailRoot + recognizeDocument collapses ownership into one content section.
 */

import { parseHTML } from "linkedom";
import type {
  EmailBlock,
  EmailColumn,
  EmailSection,
  NormalizedEmailDocument,
  SocialLinkItem,
} from "../document.js";
import { normalizeSectionRole } from "../document.js";
import { nextId, resetIds } from "../ids.js";
import { convertCellContent } from "../recognition/cells.js";
import { stripBrevoNoise, stripUnsafe } from "./sanitize.js";

export function hasEditorSectionMarkers(html: string): boolean {
  return /data-email-type\s*=\s*["']email-section["']/i.test(html);
}

function roleOf(el: Element): string {
  return (
    normalizeSectionRole(
      el.getAttribute("data-section-role") ||
        el.getAttribute("data-role") ||
        undefined,
    ) ?? "content"
  );
}

function topLevelSections(root: ParentNode): Element[] {
  return [...root.querySelectorAll('table[data-email-type="email-section"]')].filter(
    (el) => {
      const nest = el.parentElement?.closest(
        'table[data-email-type="email-section"]',
      );
      return !nest;
    },
  );
}

function directRows(table: Element): Element[] {
  return [...table.querySelectorAll(":scope > tbody > tr, :scope > tr")];
}

function blockFromNative(el: Element): EmailBlock | null {
  const type = el.getAttribute("data-email-type") ?? "";
  if (type === "email-image" || el.tagName === "IMG") {
    const img = (el.tagName === "IMG" ? el : el.querySelector("img")) as
      | Element
      | null;
    const src =
      img?.getAttribute("src") || el.getAttribute("src") || "";
    if (!src) return null;
    return {
      id: nextId("img"),
      type: "image",
      src,
      alt: img?.getAttribute("alt") || el.getAttribute("alt") || "",
      width: Number.parseInt(
        img?.getAttribute("width") || el.getAttribute("width") || "",
        10,
      ) || undefined,
      role: el.getAttribute("data-role") || img?.getAttribute("data-role") || undefined,
      alignment: (el.getAttribute("align") as "left" | "center" | "right") || undefined,
    };
  }
  if (type === "email-text" || type === "email-heading") {
    return {
      id: nextId("rt"),
      type: "rich-text",
      role: el.getAttribute("data-role") || undefined,
      html: el.innerHTML || "<p></p>",
    };
  }
  if (type === "email-button") {
    return {
      id: nextId("btn"),
      type: "button",
      href: el.getAttribute("href") || "#",
      label: (el.textContent || "Button").trim(),
    };
  }
  if (type === "email-spacer") {
    return {
      id: nextId("sp"),
      type: "spacer",
      height: Number.parseInt(el.getAttribute("height") || "", 10) || undefined,
    };
  }
  if (type === "email-divider") {
    return { id: nextId("div"), type: "divider" };
  }
  if (type === "company-social") {
    let items: SocialLinkItem[] = [];
    const raw = el.getAttribute("data-social-items");
    if (raw) {
      try {
        items = JSON.parse(raw) as SocialLinkItem[];
      } catch {
        items = [];
      }
    }
    if (items.length === 0) {
      const links = [...el.querySelectorAll("a[href]")];
      items = links.map((a) => ({
        network: "other" as const,
        href: a.getAttribute("href") || "#",
        imageSrc: a.querySelector("img")?.getAttribute("src") || undefined,
        label: a.querySelector("img")?.getAttribute("alt") || undefined,
      }));
    }
    return { id: nextId("soc"), type: "social-links", items };
  }
  if (type === "email-legacy-html") {
    return {
      id: nextId("legacy"),
      type: "legacy-html",
      html: el.innerHTML,
      reason: el.getAttribute("data-reason") || "native",
    };
  }
  return null;
}

function blocksFromColumn(td: Element): EmailBlock[] {
  const marked = [
    ...td.querySelectorAll(":scope > [data-email-type]"),
  ] as Element[];
  if (marked.length > 0) {
    const out: EmailBlock[] = [];
    for (const el of marked) {
      const b = blockFromNative(el);
      if (b) out.push(b);
    }
    if (out.length > 0) return out;
  }
  // Also catch bare img/social without wrapper
  const imgs = [...td.querySelectorAll(":scope > img")];
  if (imgs.length && marked.length === 0) {
    return imgs
      .map((img) => blockFromNative(img))
      .filter((b): b is EmailBlock => Boolean(b));
  }
  return convertCellContent(td);
}

function columnsFromRow(tr: Element): EmailColumn[] {
  const cells = [
    ...tr.querySelectorAll(
      ':scope > td[data-email-type="email-column"], :scope > th[data-email-type="email-column"]',
    ),
  ];
  const tds =
    cells.length > 0
      ? cells
      : [...tr.querySelectorAll(":scope > td, :scope > th")];
  if (tds.length === 0) {
    return [{ id: nextId("col"), width: 100, children: [] }];
  }
  const width = Math.floor(100 / tds.length);
  return tds.map((td) => {
    const wAttr = td.getAttribute("width") || "";
    const pct = Number.parseInt(wAttr, 10);
    return {
      id: nextId("col"),
      width: Number.isFinite(pct) && pct > 0 ? pct : width,
      children: blocksFromColumn(td),
    };
  });
}

function sectionFromNativeTable(table: Element): EmailSection {
  const role = roleOf(table);
  const rows = directRows(table);
  // Multi-row sections: merge columns from first content row (email layout is 1 row)
  const primary =
    rows.find((r) =>
      r.querySelector(
        '[data-email-type="email-column"], td, th',
      ),
    ) ?? rows[0];
  const columns = primary
    ? columnsFromRow(primary)
    : [{ id: nextId("col"), width: 100, children: [] as EmailBlock[] }];
  return {
    id: nextId("sec"),
    type: "section",
    role,
    columns,
  };
}

/**
 * Build NormalizedEmailDocument from Grapes/editor-marked section HTML.
 */
export function parseEditorNativeHtml(html: string): NormalizedEmailDocument {
  resetIds();
  const wrapped = html.includes("<html")
    ? html
    : `<!DOCTYPE html><html><body>${html}</body></html>`;
  const { document } = parseHTML(wrapped);
  stripUnsafe(document.documentElement);
  stripBrevoNoise(document.documentElement);

  const sections = topLevelSections(document);
  const children =
    sections.length > 0
      ? sections.map(sectionFromNativeTable)
      : [
          {
            id: nextId("sec"),
            type: "section" as const,
            role: "content",
            columns: [
              {
                id: nextId("col"),
                width: 100,
                children: [
                  {
                    id: nextId("legacy"),
                    type: "legacy-html" as const,
                    html: document.body?.innerHTML ?? html,
                    reason: "native-no-sections",
                  },
                ],
              },
            ],
          },
        ];

  return {
    version: 1,
    settings: { width: 600 },
    children,
    metadata: { source: "html" },
  };
}
