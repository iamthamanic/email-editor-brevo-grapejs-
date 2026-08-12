/**
 * Static SVG mini-previews for the Blöcke toolbar list (Brevo-like thumbs).
 * Location: packages/email-components/src/blockThumbnails.ts
 *
 * Display size: 72px wide. Generic placeholders — no brand assets.
 */

const W = 144;
const H = 96;

function frame(inner: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="72" height="48" aria-hidden="true">` +
    `<rect width="${W}" height="${H}" rx="6" fill="#f7f8fa"/>` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="5.5" fill="none" stroke="#e5e7eb"/>` +
    inner +
    `</svg>`
  );
}

/** Content sits in a white “email card” inset. */
function card(inner: string): string {
  return frame(
    `<rect x="16" y="12" width="112" height="72" rx="3" fill="#ffffff" stroke="#e5e7eb"/>` +
      inner,
  );
}

export const BLOCK_THUMBNAILS: Record<string, string> = {
  "email-text": card(
    `<rect x="28" y="28" width="72" height="5" rx="1.5" fill="#d1d5db"/>` +
      `<rect x="28" y="40" width="88" height="5" rx="1.5" fill="#e5e7eb"/>` +
      `<rect x="28" y="52" width="64" height="5" rx="1.5" fill="#e5e7eb"/>` +
      `<rect x="28" y="64" width="80" height="5" rx="1.5" fill="#e5e7eb"/>`,
  ),

  "email-heading": card(
    `<rect x="28" y="34" width="56" height="10" rx="2" fill="#9ca3af"/>` +
      `<rect x="28" y="52" width="88" height="5" rx="1.5" fill="#e5e7eb"/>` +
      `<rect x="28" y="64" width="72" height="5" rx="1.5" fill="#e5e7eb"/>`,
  ),

  "email-image": card(
    `<rect x="28" y="24" width="88" height="48" rx="2" fill="#eef1f4" stroke="#d1d5db"/>` +
      `<circle cx="48" cy="40" r="6" fill="#c5ccd6"/>` +
      `<path d="M34 64l22-16 14 12 12-8 20 16H34z" fill="#c5ccd6"/>`,
  ),

  "email-button": card(
    `<rect x="28" y="38" width="88" height="24" rx="4" fill="#275073"/>` +
      `<rect x="48" y="46" width="48" height="8" rx="1.5" fill="#ffffff" opacity="0.9"/>`,
  ),

  "email-divider": card(
    `<rect x="28" y="36" width="70" height="4" rx="1" fill="#e5e7eb"/>` +
      `<rect x="28" y="48" width="88" height="2" rx="1" fill="#9ca3af"/>` +
      `<rect x="28" y="58" width="64" height="4" rx="1" fill="#e5e7eb"/>`,
  ),

  "email-spacer": card(
    `<rect x="28" y="24" width="70" height="4" rx="1" fill="#e5e7eb"/>` +
      `<path d="M72 36v28M66 42l6-6 6 6M66 58l6 6 6-6" stroke="#9ca3af" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<rect x="28" y="72" width="70" height="4" rx="1" fill="#e5e7eb"/>`,
  ),

  "company-social": card(
    `<circle cx="44" cy="48" r="9" fill="#e5e7eb" stroke="#c5ccd6"/>` +
      `<circle cx="72" cy="48" r="9" fill="#e5e7eb" stroke="#c5ccd6"/>` +
      `<circle cx="100" cy="48" r="9" fill="#e5e7eb" stroke="#c5ccd6"/>`,
  ),

  "email-section": card(
    `<rect x="28" y="24" width="88" height="14" rx="2" fill="#eef1f4" stroke="#d1d5db"/>` +
      `<rect x="28" y="44" width="88" height="28" rx="2" fill="#f7f8fa" stroke="#e5e7eb"/>` +
      `<rect x="36" y="52" width="48" height="4" rx="1" fill="#d1d5db"/>` +
      `<rect x="36" y="62" width="64" height="4" rx="1" fill="#e5e7eb"/>`,
  ),

  "email-section-header": card(
    `<rect x="28" y="28" width="88" height="40" rx="2" fill="#f7f8fa"/>` +
      `<rect x="52" y="38" width="40" height="12" rx="2" fill="#d1d5db"/>` +
      `<rect x="44" y="56" width="56" height="4" rx="1" fill="#e5e7eb"/>`,
  ),

  "email-section-footer": card(
    `<rect x="28" y="24" width="48" height="8" rx="1.5" fill="#d1d5db"/>` +
      `<rect x="28" y="38" width="40" height="3" rx="1" fill="#e5e7eb"/>` +
      `<rect x="28" y="46" width="36" height="3" rx="1" fill="#e5e7eb"/>` +
      `<rect x="28" y="54" width="32" height="3" rx="1" fill="#e5e7eb"/>` +
      `<rect x="84" y="28" width="32" height="36" rx="2" fill="#eef1f4" stroke="#d1d5db"/>` +
      `<rect x="90" y="36" width="20" height="8" rx="1" fill="#c5ccd6"/>` +
      `<rect x="88" y="50" width="10" height="8" rx="1" fill="#c5ccd6"/>` +
      `<rect x="102" y="50" width="10" height="8" rx="1" fill="#c5ccd6"/>`,
  ),

  "email-section-social": card(
    `<circle cx="40" cy="48" r="8" fill="#374151"/>` +
      `<circle cx="60" cy="48" r="8" fill="#2563eb"/>` +
      `<circle cx="80" cy="48" r="8" fill="#db2777"/>` +
      `<circle cx="100" cy="48" r="8" fill="#1d4ed8"/>` +
      `<circle cx="116" cy="48" r="7" fill="#dc2626"/>`,
  ),

  "email-columns-1": card(
    `<rect x="36" y="22" width="72" height="56" rx="2" fill="#f7f8fa" stroke="#d1d5db"/>` +
      `<rect x="44" y="34" width="56" height="4" rx="1" fill="#d1d5db"/>` +
      `<rect x="44" y="46" width="48" height="4" rx="1" fill="#e5e7eb"/>` +
      `<rect x="44" y="58" width="40" height="4" rx="1" fill="#e5e7eb"/>`,
  ),

  "email-columns-2": card(
    `<rect x="24" y="22" width="44" height="56" rx="2" fill="#f7f8fa" stroke="#d1d5db"/>` +
      `<rect x="76" y="22" width="44" height="56" rx="2" fill="#f7f8fa" stroke="#d1d5db"/>` +
      `<rect x="30" y="36" width="32" height="4" rx="1" fill="#d1d5db"/>` +
      `<rect x="30" y="48" width="28" height="4" rx="1" fill="#e5e7eb"/>` +
      `<rect x="82" y="36" width="32" height="4" rx="1" fill="#d1d5db"/>` +
      `<rect x="82" y="48" width="28" height="4" rx="1" fill="#e5e7eb"/>`,
  ),

  "email-columns-3": card(
    `<rect x="22" y="22" width="30" height="56" rx="2" fill="#f7f8fa" stroke="#d1d5db"/>` +
      `<rect x="57" y="22" width="30" height="56" rx="2" fill="#f7f8fa" stroke="#d1d5db"/>` +
      `<rect x="92" y="22" width="30" height="56" rx="2" fill="#f7f8fa" stroke="#d1d5db"/>` +
      `<rect x="26" y="40" width="22" height="3" rx="1" fill="#d1d5db"/>` +
      `<rect x="61" y="40" width="22" height="3" rx="1" fill="#d1d5db"/>` +
      `<rect x="96" y="40" width="22" height="3" rx="1" fill="#d1d5db"/>`,
  ),

  "company-legal": card(
    `<rect x="36" y="24" width="72" height="52" rx="2" fill="#f7f8fa" stroke="#d1d5db"/>` +
      `<rect x="44" y="34" width="56" height="3" rx="1" fill="#c5ccd6"/>` +
      `<rect x="44" y="44" width="48" height="3" rx="1" fill="#e5e7eb"/>` +
      `<rect x="44" y="54" width="52" height="3" rx="1" fill="#e5e7eb"/>` +
      `<rect x="44" y="64" width="36" height="3" rx="1" fill="#e5e7eb"/>`,
  ),
};

export function blockThumbnail(type: string): string {
  return (
    BLOCK_THUMBNAILS[type] ??
    frame(
      `<rect x="40" y="36" width="64" height="24" rx="3" fill="#e5e7eb"/>`,
    )
  );
}
