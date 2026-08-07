/**
 * Placeholder brand copy + email-safe colors aligned to HVAI primary.
 * Location: packages/email-components/src/brandDefaults.ts
 * Hides: Musterfirma defaults (no Brand API yet).
 */

/** Inline color values — email clients ignore CSS custom properties in many cases. */
export const EMAIL_COLORS = {
  primary: "#275073",
  text: "#171717",
  textMuted: "#5a6a7a",
  border: "#e8eef3",
  surface: "#ffffff",
} as const;

export const BRAND_DEFAULTS = {
  companyName: "Musterfirma GmbH",
  logoSrc:
    "https://placehold.co/160x48/275073/ffffff?text=Logo",
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
