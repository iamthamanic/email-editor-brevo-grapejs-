/**
 * Placeholder brand copy + email-safe color values from theme-contract.
 * Location: packages/email-components/src/brandDefaults.ts
 * Hides: Musterfirma defaults (no Brand API yet).
 */

/** Inline color values — email clients ignore CSS custom properties in many cases. */
export const EMAIL_COLORS = {
  primary: "#1a5f4a",
  text: "#14201c",
  textMuted: "#5c6b66",
  border: "#c5d0cb",
  surface: "#ffffff",
} as const;

export const BRAND_DEFAULTS = {
  companyName: "Musterfirma GmbH",
  logoSrc:
    "https://placehold.co/160x48/1a5f4a/ffffff?text=Logo",
  logoAlt: "Musterfirma Logo",
  addressLine: "Musterstraße 1, 10115 Berlin",
  legalText: "© Musterfirma GmbH. Alle Rechte vorbehalten.",
  emailHref: "mailto:info@musterfirma.example",
  phoneHref: "tel:+493012345678",
  emailLabel: "info@musterfirma.example",
  phoneLabel: "+49 30 12345678",
  website: "https://www.musterfirma.example",
  linkedinUrl: "https://www.linkedin.com/company/musterfirma",
  xUrl: "https://x.com/musterfirma",
  variant: "default",
} as const;
