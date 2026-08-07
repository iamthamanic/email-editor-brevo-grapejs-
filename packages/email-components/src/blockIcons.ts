/**
 * Compact SVG media icons for Block Manager list rows.
 * Location: packages/email-components/src/blockIcons.ts
 */

const STROKE = "#275073";

function svg(paths: string): string {
  return `<svg viewBox="0 0 48 48" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${paths}</svg>`;
}

export const BLOCK_ICONS: Record<string, string> = {
  "email-heading": svg(
    `<path d="M10 34V14h4.2v8.2H22V14h4.2v20H22v-8.4h-7.8V34H10z" fill="${STROKE}"/>`,
  ),
  "email-text": svg(
    `<path d="M12 16h24M12 24h20M12 32h16" stroke="${STROKE}" stroke-width="2.2" stroke-linecap="round"/>`,
  ),
  "email-image": svg(
    `<rect x="10" y="14" width="28" height="20" rx="2" stroke="${STROKE}" stroke-width="2"/><circle cx="18" cy="22" r="2.5" fill="${STROKE}"/><path d="M14 32l8-8 6 6 4-4 6 6" stroke="${STROKE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  "email-button": svg(
    `<rect x="10" y="18" width="28" height="12" rx="3" stroke="${STROKE}" stroke-width="2"/><path d="M18 24h12" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "email-divider": svg(
    `<path d="M10 24h28" stroke="${STROKE}" stroke-width="2.2" stroke-linecap="round"/>`,
  ),
  "email-spacer": svg(
    `<path d="M24 12v24M18 18l6-6 6 6M18 30l6 6 6-6" stroke="${STROKE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  "email-section": svg(
    `<rect x="10" y="12" width="28" height="24" rx="2" stroke="${STROKE}" stroke-width="2"/><path d="M10 18h28" stroke="${STROKE}" stroke-width="2"/>`,
  ),
  "email-header": svg(
    `<rect x="10" y="14" width="28" height="20" rx="2" stroke="${STROKE}" stroke-width="2"/><path d="M16 24h16" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "email-columns-1": svg(
    `<rect x="14" y="12" width="20" height="24" rx="2" stroke="${STROKE}" stroke-width="2"/>`,
  ),
  "email-columns-2": svg(
    `<rect x="10" y="12" width="12" height="24" rx="2" stroke="${STROKE}" stroke-width="2"/><rect x="26" y="12" width="12" height="24" rx="2" stroke="${STROKE}" stroke-width="2"/>`,
  ),
  "email-columns-3": svg(
    `<rect x="9" y="12" width="8" height="24" rx="1.5" stroke="${STROKE}" stroke-width="2"/><rect x="20" y="12" width="8" height="24" rx="1.5" stroke="${STROKE}" stroke-width="2"/><rect x="31" y="12" width="8" height="24" rx="1.5" stroke="${STROKE}" stroke-width="2"/>`,
  ),
  "company-header": svg(
    `<rect x="10" y="14" width="28" height="20" rx="2" stroke="${STROKE}" stroke-width="2"/><path d="M14 22h10M14 28h16" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "company-footer": svg(
    `<rect x="10" y="14" width="28" height="20" rx="2" stroke="${STROKE}" stroke-width="2"/><path d="M14 26h20M14 30h12" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "company-legal": svg(
    `<path d="M16 12h16v24H16z" stroke="${STROKE}" stroke-width="2"/><path d="M20 18h8M20 24h8M20 30h5" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "company-contact": svg(
    `<circle cx="24" cy="18" r="5" stroke="${STROKE}" stroke-width="2"/><path d="M14 34c2-6 6-9 10-9s8 3 10 9" stroke="${STROKE}" stroke-width="2" stroke-linecap="round"/>`,
  ),
  "company-social": svg(
    `<circle cx="16" cy="24" r="4" stroke="${STROKE}" stroke-width="2"/><circle cx="24" cy="24" r="4" stroke="${STROKE}" stroke-width="2"/><circle cx="32" cy="24" r="4" stroke="${STROKE}" stroke-width="2"/>`,
  ),
};

export function blockMedia(type: string, label: string): string {
  return (
    BLOCK_ICONS[type] ??
    `<div class="gjs-block-label-fallback">${label}</div>`
  );
}
