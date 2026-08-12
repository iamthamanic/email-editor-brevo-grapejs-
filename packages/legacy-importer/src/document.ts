/**
 * Neutral email document model (no GrapesJS dependency).
 * Location: packages/legacy-importer/src/document.ts
 */

/** Top-level section roles (header/footer/social are specialized sections). */
export type EmailSectionRole =
  | "header"
  | "content"
  | "footer"
  | "social"
  /** @deprecated prefer "footer" */
  | "corporate-footer"
  | "brand-logo"
  | "main-content"
  | string;

export type EmailBlock =
  | RichTextBlock
  | ImageBlock
  | ButtonBlock
  | SpacerBlock
  | DividerBlock
  | SocialLinksBlock
  | LayoutRowBlock
  /** @deprecated Prefer image + rich-text blocks inside footer columns. */
  | CompanyInformationBlock
  /** @deprecated Prefer section role=footer with columns. */
  | CorporateFooterBlock
  | LegacyHtmlBlock;

export interface NormalizedEmailDocument {
  version: 1;
  settings: {
    width?: number;
    backgroundColor?: string;
  };
  children: EmailSection[];
  metadata: {
    source: "brevo" | "html";
  };
}

export interface EmailSection {
  id: string;
  type: "section";
  role?: EmailSectionRole;
  padding?: string;
  backgroundColor?: string;
  columns: EmailColumn[];
  /** Optional link to a SavedEmailSection master (snapshot still in columns). */
  source?: {
    savedSectionId: string;
    version: number;
    mode: "linked" | "detached";
  };
}

export interface EmailColumn {
  id: string;
  /** Percent width 1–100 when known. */
  width: number;
  children: EmailBlock[];
}

/** Nested multi-column layout inside the single content canvas. */
export interface LayoutRowBlock {
  id: string;
  type: "layout-row";
  columns: EmailColumn[];
}

export interface RichTextBlock {
  id: string;
  type: "rich-text";
  role?: string;
  /** Allowlisted HTML fragment; may contain {{ params.* }}. */
  html: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  role?: "brand-logo" | "certifications" | string;
  src: string;
  alt: string;
  width?: number;
  alignment?: "left" | "center" | "right";
}

export interface ButtonBlock {
  id: string;
  type: "button";
  label: string;
  href: string;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height?: number;
}

export interface DividerBlock {
  id: string;
  type: "divider";
}

export type SocialNetwork =
  | "tiktok"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "youtube"
  | "x"
  | "other";

export interface SocialLinkItem {
  network: SocialNetwork;
  href: string;
  imageSrc?: string;
  label?: string;
}

export interface SocialLinksBlock {
  id: string;
  type: "social-links";
  items: SocialLinkItem[];
}

/** @deprecated Prefer image + rich-text. Kept for older normalized docs. */
export interface CompanyInformationBlock {
  id: string;
  type: "company-information";
  companyName?: string;
  addressLines: string[];
  phone?: string;
  email?: string;
  website?: string;
  logoSrc?: string;
  /** Pixel width from source <img width> (Brevo footers use ~200–229). */
  logoWidth?: number;
}

/** @deprecated Prefer section role=footer. */
export interface CorporateFooterBlock {
  id: string;
  type: "corporate-footer";
  company: CompanyInformationBlock;
  certificationImage?: ImageBlock;
}

export interface LegacyHtmlBlock {
  id: string;
  type: "legacy-html";
  html: string;
  reason: string;
}

export function normalizeSectionRole(
  role: string | undefined,
): EmailSectionRole | undefined {
  if (!role) return undefined;
  if (role === "corporate-footer" || role === "brand-logo") {
    return role === "brand-logo" ? "header" : "footer";
  }
  return role;
}

export function sectionDisplayName(role: string | undefined): string {
  switch (normalizeSectionRole(role)) {
    case "header":
      return "Header";
    case "footer":
      return "Footer";
    case "social":
      return "Social Media";
    case "content":
    default:
      return "Inhalt";
  }
}
