/**
 * Component registry metadata — single source for block ids/labels/categories.
 * Location: packages/email-components/src/registry.ts
 */

export type BlockCategory = "content" | "layout" | "sections" | "corporate";

export interface EmailComponentDef {
  type: string;
  label: string;
  category: BlockCategory;
  categoryLabel: string;
}

export const EMAIL_COMPONENTS: readonly EmailComponentDef[] = [
  { type: "email-text", label: "Text", category: "content", categoryLabel: "Inhalt" },
  {
    type: "email-heading",
    label: "Überschrift",
    category: "content",
    categoryLabel: "Inhalt",
  },
  { type: "email-image", label: "Bild", category: "content", categoryLabel: "Inhalt" },
  { type: "email-button", label: "Button", category: "content", categoryLabel: "Inhalt" },
  {
    type: "email-divider",
    label: "Trennlinie",
    category: "content",
    categoryLabel: "Inhalt",
  },
  { type: "email-spacer", label: "Abstand", category: "content", categoryLabel: "Inhalt" },
  {
    type: "company-social",
    label: "Social",
    category: "content",
    categoryLabel: "Inhalt",
  },
  {
    type: "email-section",
    label: "Bereich",
    category: "sections",
    categoryLabel: "Bereiche",
  },
  {
    type: "email-section-header",
    label: "Header",
    category: "sections",
    categoryLabel: "Bereiche",
  },
  {
    type: "email-section-footer",
    label: "Footer",
    category: "sections",
    categoryLabel: "Bereiche",
  },
  {
    type: "email-section-social",
    label: "Social Media",
    category: "sections",
    categoryLabel: "Bereiche",
  },
  {
    type: "email-columns-1",
    label: "1 Spalte",
    category: "layout",
    categoryLabel: "Layout",
  },
  {
    type: "email-columns-2",
    label: "2 Spalten",
    category: "layout",
    categoryLabel: "Layout",
  },
  {
    type: "email-columns-3",
    label: "3 Spalten",
    category: "layout",
    categoryLabel: "Layout",
  },
  // Legacy corporate shells — still available for old templates
  {
    type: "company-legal",
    label: "Legal",
    category: "corporate",
    categoryLabel: "Firma (Legacy)",
  },
] as const;

export function listComponentTypes(): string[] {
  return EMAIL_COMPONENTS.map((c) => c.type);
}
