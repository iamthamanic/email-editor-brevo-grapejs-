/**
 * Harvest Textbausteine (paragraph snippets) from template editorData.
 * Location: apps/api/src/saved-sections/harvest.ts
 *
 * Content sections only; split by <p>; coalesce anrede/gruß/field blocks; dedup by hash.
 */

import { createHash } from "node:crypto";

export interface HarvestCandidate {
  name: string;
  html: string;
  plain: string;
  hash: string;
}

const TITLE_MAX = 70;
const MIN_PLAIN = 12;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

export function normalizePlain(plain: string): string {
  return plain.toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashPlain(plain: string): string {
  return createHash("sha256")
    .update(normalizePlain(plain))
    .digest("hex")
    .slice(0, 32);
}

export function titleFromPlain(plain: string): string {
  const lines = plain
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  // Prefer body over anrede when both are in one snippet
  const firstLine =
    lines.find((l) => !/^sehr geehrte/i.test(l) || l.length >= 80) ??
    lines[0] ??
    plain;
  const sentence = firstLine.split(/(?<=[.!?])\s+/)[0] ?? firstLine;
  const t = sentence.trim();
  if (t.length <= TITLE_MAX) return t;
  return `${t.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

function isEmptyPlain(plain: string): boolean {
  const t = plain.replace(/\u00a0/g, " ").trim();
  return t.length < MIN_PLAIN || /^[\s.·•\-–—]+$/.test(t);
}

function isAnrede(plain: string): boolean {
  return /^sehr geehrte/i.test(plain) && plain.length < 80;
}

function isGrussLine(plain: string): boolean {
  return (
    (/^mit freundlichen grüßen/i.test(plain) ||
      /^ihre\s+\w+/i.test(plain) ||
      /^herzliche grüße/i.test(plain)) &&
    plain.length < 80
  );
}

function isShortHeading(plain: string): boolean {
  return plain.length > 0 && plain.length <= 50 && !/[.!?]$/.test(plain);
}

function isFieldLine(plain: string): boolean {
  return (
    plain.length <= 100 &&
    (/[#:]/.test(plain) ||
      /bestellnummer|datum|uhrzeit|ausdehnung|grund|ort der/i.test(plain))
  );
}

interface Para {
  html: string;
  plain: string;
}

function wrapAsP(innerHtml: string): string {
  const trimmed = innerHtml.trim();
  if (/^<p\b/i.test(trimmed)) return trimmed;
  return `<p>${trimmed}</p>`;
}

function mergePara(a: Para, b: Para): Para {
  return {
    html: `${a.html}${b.html}`,
    plain: `${a.plain}\n${b.plain}`.trim(),
  };
}

/** Split HTML into paragraph units (<p> preferred; else double-break). */
export function splitParagraphHtml(html: string): Para[] {
  const raw = html.trim();
  if (!raw) return [];

  const pMatches = [...raw.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/gi)].map((m) =>
    m[0]!.trim(),
  );
  let parts: string[];
  if (pMatches.length >= 1) {
    parts = pMatches;
  } else {
    parts = raw
      .split(/(?:<br\s*\/?>\s*){2,}|\n{2,}/i)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => wrapAsP(p));
  }

  return parts
    .map((pHtml) => ({ html: pHtml, plain: stripHtml(pHtml) }))
    .filter((p) => !isEmptyPlain(p.plain));
}

/** Coalesce anrede / gruß / field clusters into reusable snippets. */
export function coalesceParagraphs(paras: Para[]): Para[] {
  const out: Para[] = [];
  let i = 0;
  while (i < paras.length) {
    let cur = paras[i]!;
    i += 1;

    if (isAnrede(cur.plain) && i < paras.length) {
      cur = mergePara(cur, paras[i]!);
      i += 1;
    }

    // Auftragsdetails-style: heading + only field lines (Bestellnummer:, …)
    if (
      isShortHeading(cur.plain) &&
      i < paras.length &&
      isFieldLine(paras[i]!.plain)
    ) {
      while (i < paras.length && isFieldLine(paras[i]!.plain)) {
        cur = mergePara(cur, paras[i]!);
        i += 1;
      }
    } else if (
      // Tip / subheading + following body paragraph
      isShortHeading(cur.plain) &&
      i < paras.length &&
      !isFieldLine(paras[i]!.plain) &&
      !isAnrede(paras[i]!.plain) &&
      !isGrussLine(paras[i]!.plain) &&
      paras[i]!.plain.length >= MIN_PLAIN
    ) {
      cur = mergePara(cur, paras[i]!);
      i += 1;
    }

    while (i < paras.length && isGrussLine(paras[i]!.plain)) {
      cur = mergePara(cur, paras[i]!);
      i += 1;
    }

    out.push(cur);
  }
  return out;
}

function sectionRoleOf(node: Record<string, unknown>): string {
  const attrs = (node.attributes ?? {}) as Record<string, unknown>;
  return String(
    node.sectionRole ??
      attrs["data-section-role"] ??
      attrs["data-role"] ??
      "",
  );
}

function deepHtmlFromEmailText(node: Record<string, unknown>): string {
  if (typeof node.content === "string" && node.content.trim()) {
    return node.content;
  }
  const parts: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    const o = n as Record<string, unknown>;
    if (typeof o.content === "string") parts.push(o.content);
    walk(o.components);
  };
  walk(node.components);
  return parts.join("");
}

function walkComponents(
  node: unknown,
  inContent: boolean,
  onText: (html: string) => void,
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walkComponents(n, inContent, onText);
    return;
  }
  const o = node as Record<string, unknown>;
  const type = String(o.type ?? "");
  let nextIn = inContent;
  if (type === "email-section") {
    nextIn = sectionRoleOf(o) === "content";
  }
  if (nextIn && (type === "email-text" || type === "email-heading")) {
    const html = deepHtmlFromEmailText(o);
    if (html.trim()) onText(html);
  }
  walkComponents(o.components, nextIn, onText);
}

/** Resolve Grapes project or __etsImport components array. */
export function componentsFromEditorData(editorData: unknown): unknown[] {
  if (!editorData || typeof editorData !== "object") return [];
  const ed = editorData as Record<string, unknown>;
  if (Array.isArray(ed.components)) return ed.components;
  const pages = ed.pages;
  if (!Array.isArray(pages) || pages.length === 0) return [];
  try {
    const page0 = pages[0] as Record<string, unknown>;
    const frames = page0.frames as unknown[];
    const frame0 = frames[0] as Record<string, unknown>;
    const component = frame0.component as Record<string, unknown>;
    const comps = component.components;
    return Array.isArray(comps) ? comps : [];
  } catch {
    return [];
  }
}

export function extractHarvestCandidates(
  editorData: unknown,
): HarvestCandidate[] {
  const comps = componentsFromEditorData(editorData);
  const htmlBlocks: string[] = [];
  walkComponents(comps, false, (html) => htmlBlocks.push(html));

  const candidates: HarvestCandidate[] = [];
  const seen = new Set<string>();

  for (const blockHtml of htmlBlocks) {
    const paras = coalesceParagraphs(splitParagraphHtml(blockHtml));
    for (const para of paras) {
      if (isEmptyPlain(para.plain)) continue;
      const hash = hashPlain(para.plain);
      if (seen.has(hash)) continue;
      seen.add(hash);
      const name = titleFromPlain(para.plain);
      const html = para.html.includes("<p")
        ? para.html
        : `<p>${escapeHtml(para.plain).replace(/\n/g, "<br/>")}</p>`;
      candidates.push({ name, html, plain: para.plain, hash });
    }
  }
  return candidates;
}

export function buildHarvestSectionData(
  candidate: HarvestCandidate,
): Record<string, unknown> {
  return {
    type: "email-text",
    name: candidate.name,
    attributes: {
      "data-email-type": "email-text",
      "data-textbaustein-title": candidate.name,
      "data-textbaustein-hash": candidate.hash,
      "data-textbaustein-source": "harvest",
    },
    content: candidate.html,
  };
}

export function hashFromSectionData(
  sectionData: Record<string, unknown>,
): string | null {
  const attrs = (sectionData.attributes ?? {}) as Record<string, unknown>;
  const h = attrs["data-textbaustein-hash"];
  if (typeof h === "string" && h.length >= 8) return h;
  const content = sectionData.content;
  if (typeof content === "string" && content.trim()) {
    return hashPlain(stripHtml(content));
  }
  // Legacy / nested snapshots: collect plain text from the tree.
  const chunks: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    const o = node as Record<string, unknown>;
    if (typeof o.content === "string" && o.content.trim()) {
      chunks.push(stripHtml(o.content));
    }
    walk(o.components);
  };
  walk(sectionData);
  const plain = chunks.join("\n").trim();
  if (!plain) return null;
  return hashPlain(plain);
}
