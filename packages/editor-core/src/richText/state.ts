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
  | "unlink"
  | "quote";

export type RichTextRunArg =
  | RichTextCommand
  | { type: "block"; tag: RichTextBlockType }
  | { type: "foreColor"; color: string };
