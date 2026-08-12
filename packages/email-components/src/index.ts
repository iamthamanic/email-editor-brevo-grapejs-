/**
 * Email component library for GrapesJS.
 * Location: packages/email-components
 */

export { EMAIL_COMPONENTS, listComponentTypes } from "./registry.js";
export type { BlockCategory, EmailComponentDef } from "./registry.js";
export {
  registerEmailComponents,
  EMAIL_TEXT_PLACEHOLDER,
  emptyEmailTextBlock,
  isEmailTextPlaceholder,
  healEmailTextPlaceholderFlag,
} from "./register.js";
export {
  EMAIL_IMAGE_PLACEHOLDER_SRC,
  emptyEmailImageBlock,
  isEmailImagePlaceholderSrc,
} from "./imagePlaceholder.js";
export { normalizeHexColor } from "./colors.js";
export { registerBrandColorTrait } from "./brandColorTrait.js";
export { registerImageSrcTrait } from "./imageSrcTrait.js";
export {
  BRAND_DEFAULTS,
  BRAND_PALETTE,
  EMAIL_COLORS,
  EMAIL_FONT_STACK,
  type BrandPaletteColor,
  type BrandSocialItem,
} from "./brandDefaults.js";
export {
  isAllowedImageUrl,
  isAllowedLinkUrl,
  sanitizeImageUrl,
  sanitizeLinkUrl,
} from "./urls.js";
export { escapeHtml, sanitizeAltText, toPlainText } from "./text.js";
export { sanitizeEmailHtml, sanitizePastedEmailHtml, sanitizeInlineStyle } from "./html.js";
export type { SanitizeEmailHtmlOptions } from "./html.js";
export {
  buildEmailParamComponent,
  isInlineParamDrop,
  dropSourceType,
} from "./param.js";
export {
  forceEnableTextRte,
  placeCaretInHost,
  ensureCaretOutsideParam,
  wireCanvasTextClickToEdit,
  healRteContentEditable,
  isInsideLockedChrome,
} from "./clickToEdit.js";
export type { ForceEnablePointer } from "./clickToEdit.js";
export {
  columnsSectionContent,
  layoutRowContent,
  footerSectionContent,
  headerSectionContent,
  socialSectionContent,
  emptyContentSectionContent,
  emptyContentCanvasInner,
  ensureContentCanvas,
} from "./layout.js";
export { blockThumbnail, BLOCK_THUMBNAILS } from "./blockThumbnails.js";
export { blockMedia, BLOCK_ICONS } from "./blockIcons.js";
