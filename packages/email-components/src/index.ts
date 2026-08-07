/**
 * Email component library for GrapesJS.
 * Location: packages/email-components
 */

export { EMAIL_COMPONENTS, listComponentTypes } from "./registry.js";
export type { BlockCategory, EmailComponentDef } from "./registry.js";
export { registerEmailComponents } from "./register.js";
export {
  isAllowedImageUrl,
  isAllowedLinkUrl,
  sanitizeImageUrl,
  sanitizeLinkUrl,
} from "./urls.js";
export { escapeHtml, sanitizeAltText, toPlainText } from "./text.js";
export { sanitizeEmailHtml } from "./html.js";
