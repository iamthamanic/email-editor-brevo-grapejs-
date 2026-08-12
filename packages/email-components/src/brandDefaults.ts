/**
 * Halteverbot123 / Browo brand chrome for email defaults.
 * Location: packages/email-components/src/brandDefaults.ts
 * Hides: seeded from production Brevo fixture URLs (no Brand API yet).
 */

/** Inline color values — email clients ignore CSS custom properties in many cases. */
export const EMAIL_COLORS = {
  primary: "#275073",
  text: "#171717",
  textMuted: "#5a6a7a",
  border: "#e8eef3",
  surface: "#ffffff",
} as const;

/**
 * Brevo production template body font (HVAI / Halteverbot123).
 * Use on email-text / heading / button / canvas defaults; paste strips foreign families.
 */
export const EMAIL_FONT_STACK = "Tahoma, Arial, sans-serif";

/**
 * Corporate brand swatches for toolbar / traits (HEX from brand book).
 * CMYK/RAL are labels for editors — runtime uses HEX only.
 */
export const BRAND_PALETTE = [
  {
    hex: "#4eb2e5",
    label: "Lichtblau",
    ral: "RAL 5012",
  },
  {
    hex: "#ff543f",
    label: "Reinorange",
    ral: "RAL 2004",
  },
  {
    hex: "#192643",
    label: "Perlnachtblau",
    ral: "RAL 5026",
  },
] as const;

export type BrandPaletteColor = (typeof BRAND_PALETTE)[number];

/** Logo from Brevo content library (production template fixture). */
const HV_LOGO =
  "https://img.mailinblue.com/8349272/images/content_library/original/68931b9c9c93196114cb1597.png";

/** Certifications strip from same production fixture. */
const HV_CERT =
  "https://img.mailinblue.com/8349272/images/content_library/original/6896086514347905733766ab.png";

const SOCIAL_ICON = {
  tiktok:
    "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/tiktok_32px.png",
  linkedin:
    "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/linkedin_32px.png",
  instagram:
    "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/instagram_32px.png",
  facebook:
    "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/facebook_32px.png",
  youtube:
    "https://creative-assets.mailinblue.com/editor/social-icons/rounded_colored/youtube_32px.png",
} as const;

export type BrandSocialItem = {
  network: string;
  href: string;
  imageSrc: string;
  label: string;
};

export const BRAND_DEFAULTS = {
  companyName: "Browo GmbH",
  logoSrc: HV_LOGO,
  logoAlt: "halteverbot123",
  certSrc: HV_CERT,
  certAlt: "Zertifikate",
  /** Street line from production Brevo footer. */
  addressStreet: "Späthstraße 144",
  addressCity: "12359 Berlin",
  /** Single-line fallback for corporate blocks. */
  addressLine: "Späthstraße 144, 12359 Berlin",
  legalText: "© Browo GmbH / halteverbot123. Alle Rechte vorbehalten.",
  emailHref: "mailto:info@halteverbot123.de",
  phoneHref: "tel:+493062735160",
  emailLabel: "info@halteverbot123.de",
  phoneLabel: "030-627 35 160",
  website: "https://www.halteverbot123.de",
  websiteLabel: "www.halteverbot123.de",
  linkedinUrl:
    "https://www.linkedin.com/company/halteverbot123/posts/?feedView=all",
  xUrl: "https://www.tiktok.com/@halteverbot123",
  variant: "default",
  socialItems: [
    {
      network: "tiktok",
      href: "https://www.tiktok.com/@halteverbot123",
      imageSrc: SOCIAL_ICON.tiktok,
      label: "TikTok",
    },
    {
      network: "linkedin",
      href: "https://www.linkedin.com/company/halteverbot123/posts/?feedView=all",
      imageSrc: SOCIAL_ICON.linkedin,
      label: "LinkedIn",
    },
    {
      network: "instagram",
      href: "https://www.instagram.com/halteverbot_123",
      imageSrc: SOCIAL_ICON.instagram,
      label: "Instagram",
    },
    {
      network: "facebook",
      href: "https://www.facebook.com/halteverbot123.de",
      imageSrc: SOCIAL_ICON.facebook,
      label: "Facebook",
    },
    {
      network: "youtube",
      href: "https://www.youtube.com/@halteverbot123",
      imageSrc: SOCIAL_ICON.youtube,
      label: "YouTube",
    },
  ] as BrandSocialItem[],
} as const;
