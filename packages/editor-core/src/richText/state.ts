/**
 * Transient rich-text formatting state (editor UI only).
 * Location: packages/editor-core/src/richText/state.ts
 */

export type RichTextBlockType = "p" | "h1" | "h2" | "h3" | "h4";
export type RichTextAlign = "left" | "center" | "right" | "justify" | "";

export interface RichTextFormatState {
  active: boolean;
  componentId: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  blockType: RichTextBlockType;
  /** px size from selection; 0 = unknown / mixed */
  fontSize: number;
  alignment: RichTextAlign;
  orderedList: boolean;
  unorderedList: boolean;
  linkActive: boolean;
}

export const IDLE_RICH_TEXT_STATE: RichTextFormatState = {
  active: false,
  componentId: null,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  blockType: "p",
  fontSize: 0,
  alignment: "",
  orderedList: false,
  unorderedList: false,
  linkActive: false,
};

export type RichTextCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "removeFormat"
  | "link"
  | "unlink";

export type RichTextRunArg =
  | RichTextCommand
  | { type: "block"; tag: RichTextBlockType }
  | { type: "foreColor"; color: string }
  | { type: "hiliteColor"; color: string }
  | { type: "fontSize"; sizePx: number };

/** Common email-safe sizes shown in the toolbar. */
export const RICH_TEXT_FONT_SIZES = [
  12, 14, 16, 18, 20, 24, 28, 32,
] as const;
