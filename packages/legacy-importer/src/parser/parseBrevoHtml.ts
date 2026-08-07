/**
 * Parse Brevo/legacy HTML → NormalizedEmailDocument (no GrapesJS).
 * Location: packages/legacy-importer/src/parser/parseBrevoHtml.ts
 */

import { parseHTML } from "linkedom";
import type { NormalizedEmailDocument } from "../document.js";
import { resetIds } from "../ids.js";
import { recognizeDocument } from "../recognition/sections.js";
import { findEmailRoot } from "./findEmailRoot.js";
import { stripBrevoNoise, stripUnsafe } from "./sanitize.js";

export function parseBrevoHtml(html: string): NormalizedEmailDocument {
  resetIds();
  const wrapped = html.includes("<html")
    ? html
    : `<!DOCTYPE html><html><body>${html}</body></html>`;
  const { document } = parseHTML(wrapped);
  stripUnsafe(document.documentElement);
  stripBrevoNoise(document.documentElement);
  const { root, width, backgroundColor } = findEmailRoot(document);
  const source = document.querySelector("table.nl2go-body-table")
    ? "brevo"
    : "html";
  return recognizeDocument(root, { width, backgroundColor }, source);
}
