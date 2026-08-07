/**
 * Brevo/legacy email HTML → NormalizedEmailDocument → GrapesJS components.
 * Location: packages/legacy-importer
 */

export { convertBrevoHtml, needsConversion, tokenizeParams } from "./convert.js";
export { parseBrevoHtml } from "./parser/parseBrevoHtml.js";
export {
  hasEditorSectionMarkers,
  parseEditorNativeHtml,
} from "./parser/parseEditorNativeHtml.js";
export { normalizedEmailToGrapesComponents } from "./mapper/toGrapesJs.js";
export { sanitizeRichHtml } from "./parser/sanitize.js";

export type {
  ConversionReport,
  ConversionResult,
  GrapesComponentDef,
  NormalizedEmailDocument,
  EmailBlock,
  EmailSection,
} from "./types.js";
