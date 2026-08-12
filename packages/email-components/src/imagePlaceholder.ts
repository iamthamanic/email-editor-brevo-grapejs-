/**
 * Premium empty-state artwork for new email-image blocks (editor only).
 * Exact data-URI is allowlisted in urls.ts — arbitrary data: URLs stay blocked.
 * Location: packages/email-components/src/imagePlaceholder.ts
 */

const MARKER = "ets-email-image-placeholder";

/** Soft ERP-primary invite card: dashed frame, camera glyph, DE label. */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200" role="img" aria-label="Bild einfügen">
  <!--${MARKER}-->
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#275073" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#275073" stop-opacity="0.03"/>
    </linearGradient>
  </defs>
  <rect width="600" height="200" rx="12" ry="12" fill="url(#g)" stroke="#275073" stroke-opacity="0.42" stroke-width="1.5" stroke-dasharray="7 6"/>
  <circle cx="300" cy="78" r="26" fill="#ffffff" fill-opacity="0.92" stroke="#275073" stroke-opacity="0.28" stroke-width="1"/>
  <g fill="none" stroke="#275073" stroke-opacity="0.78" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="283" y="68" width="34" height="26" rx="4"/>
    <circle cx="300" cy="81" r="7"/>
    <path d="M290 68l3.5-5h13l3.5 5"/>
  </g>
  <text x="300" y="128" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="13" font-weight="500" fill="#275073" fill-opacity="0.72">Bild einfügen</text>
  <text x="300" y="148" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="11" font-weight="400" fill="#275073" fill-opacity="0.45">Klicken zum Hochladen oder URL setzen</text>
</svg>`;

/** Trusted starter src for empty email-image components. */
export const EMAIL_IMAGE_PLACEHOLDER_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLACEHOLDER_SVG)}`;

export function isEmailImagePlaceholderSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return false;
  if (trimmed === EMAIL_IMAGE_PLACEHOLDER_SRC) return true;
  // Legacy placehold.co starters still count as empty for flag sync
  return (
    trimmed.includes("placehold.co/") &&
    (trimmed.includes("Bild") || trimmed.includes("text=Bild"))
  );
}

/** Grapes definition for a new empty image block. */
export function emptyEmailImageBlock(): {
  type: "email-image";
  attributes: {
    "data-email-type": "email-image";
    "data-placeholder": "1";
    src: string;
    alt: string;
    width: string;
  };
} {
  return {
    type: "email-image",
    attributes: {
      "data-email-type": "email-image",
      "data-placeholder": "1",
      src: EMAIL_IMAGE_PLACEHOLDER_SRC,
      alt: "Bild",
      width: "600",
    },
  };
}

export function syncEmailImagePlaceholderFlag(
  src: string,
): { "data-placeholder": "1" } | { "data-placeholder": null } {
  if (isEmailImagePlaceholderSrc(src)) {
    return { "data-placeholder": "1" };
  }
  return { "data-placeholder": null };
}
