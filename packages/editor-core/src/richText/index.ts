/**
 * Rich-text controller public API.
 * Location: packages/editor-core/src/richText/index.ts
 */

export {
  attachRichTextController,
  getRichTextController,
  RichTextController,
} from "./controller.js";
export {
  IDLE_RICH_TEXT_STATE,
  type RichTextAlign,
  type RichTextBlockType,
  type RichTextCommand,
  type RichTextFormatState,
  type RichTextRunArg,
} from "./state.js";
