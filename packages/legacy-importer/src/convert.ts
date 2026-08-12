/**
 * Public conversion pipeline: Brevo HTML → document → GrapesJS components.
 * Location: packages/legacy-importer/src/convert.ts
 */

import { coalesceBrokenParamHtmlDeep, replaceLegacyHashTokens } from "@email-template/email-variables";
import { parseBrevoHtml } from "./parser/parseBrevoHtml.js";
import {
  hasEditorSectionMarkers,
  parseEditorNativeHtml,
} from "./parser/parseEditorNativeHtml.js";
import {
  normalizedEmailToGrapesComponents,
  tokenizeParams,
} from "./mapper/toGrapesJs.js";
import type { ConversionResult, GrapesComponentDef } from "./types.js";
import { buildConversionReport } from "./validation/validateConversion.js";

export { tokenizeParams };

/**
 * Convert Brevo / table-based email HTML into normalized doc + GrapesJS tree.
 * Editor-exported HTML (data-email-type=email-section) uses a native path so
 * sibling sections are not collapsed by Brevo root/row recognition.
 * Legacy `#TOKEN#` placeholders are rewritten to `{{ params.* }}` first.
 */
export function convertBrevoHtml(html: string): ConversionResult {
  const warnings: string[] = [];
  html = replaceLegacyHashTokens(html ?? "");

  if (!html?.trim()) {
    const emptyDoc = {
      version: 1 as const,
      settings: {},
      children: [
        {
          id: "sec-empty",
          type: "section" as const,
          columns: [
            {
              id: "col-empty",
              width: 100,
              children: [
                {
                  id: "rt-empty",
                  type: "rich-text" as const,
                  html: "<p>Leeres Template</p>",
                },
              ],
            },
          ],
        },
      ],
      metadata: { source: "html" as const },
    };
    const components = normalizedEmailToGrapesComponents(emptyDoc);
    return {
      document: emptyDoc,
      components,
      report: buildConversionReport("", emptyDoc, components, [
        "Empty HTML input",
      ]),
    };
  }

  const document = hasEditorSectionMarkers(html)
    ? parseEditorNativeHtml(html)
    : parseBrevoHtml(html);
  // parseBrevoHtml / native already coalesce; keep as safety net for empty path
  const raw = normalizedEmailToGrapesComponents(document);
  const components = coalesceBrokenParamHtmlDeep(raw) as GrapesComponentDef[];
  const report = buildConversionReport(html, document, components, warnings);
  return { document, components, report };
}

export function needsConversion(
  editorData: Record<string, unknown> | null | undefined,
  legacyHtml: string | null | undefined,
): boolean {
  const empty =
    !editorData ||
    (typeof editorData === "object" && Object.keys(editorData).length === 0);
  return empty && Boolean(legacyHtml?.trim());
}
