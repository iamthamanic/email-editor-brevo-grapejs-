/**
 * Conversion report + GrapesJS emit types.
 * Location: packages/legacy-importer/src/types.ts
 */

import type { NormalizedEmailDocument } from "./document.js";

export type {
  CompanyInformationBlock,
  CorporateFooterBlock,
  EmailBlock,
  EmailColumn,
  EmailSection,
  ImageBlock,
  LegacyHtmlBlock,
  NormalizedEmailDocument,
  RichTextBlock,
  SocialLinkItem,
  SocialLinksBlock,
  SocialNetwork,
} from "./document.js";

export interface ConversionReport {
  variables: { expected: number; preserved: number };
  images: { expected: number; preserved: number };
  links: { expected: number; preserved: number };
  /** Normalized visible text preserved (whitespace-insensitive). */
  textPreserved: boolean;
  sourceParams: string[];
  outputParams: string[];
  sourceImages: string[];
  outputImages: string[];
  sourceLinks: string[];
  outputLinks: string[];
  sectionCount: number;
  columnCount: number;
  richTextCount: number;
  imageCount: number;
  socialGroupCount: number;
  legacyBlockCount: number;
  unknownBlockCount: number;
  /** @deprecated use unknownBlockCount / legacyBlockCount */
  unknownBlocks: number;
  warnings: string[];
  /** 0–1 structural coverage (recognized vs legacy/unknown). */
  coverage: number;
  autoApproved: boolean;
}

/** GrapesJS-compatible component definition (subset we emit). */
export type GrapesComponentDef = {
  type?: string;
  tagName?: string;
  /** Layer / selection label */
  name?: string;
  content?: string;
  components?: GrapesComponentDef[] | string;
  attributes?: Record<string, string>;
  style?: Record<string, string>;
  void?: boolean;
  sectionPadding?: string;
  columnWidth?: number;
  sectionRole?: string;
  /** company-* / email-header trait props passed into GrapesJS model */
  email?: string;
  phone?: string;
  website?: string;
  companyName?: string;
  addressLine?: string;
  linkedinUrl?: string;
  xUrl?: string;
  websiteUrl?: string;
  logoSrc?: string;
  logoAlt?: string;
  logoWidth?: number;
  alignment?: string;
  padding?: string;
};

export interface ConversionResult {
  document: NormalizedEmailDocument;
  components: GrapesComponentDef[];
  report: ConversionReport;
}
