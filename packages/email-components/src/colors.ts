/**
 * Hex color normalize/validate for toolbar + traits.
 * Location: packages/email-components/src/colors.ts
 */

/** Normalize user hex (#RGB / #RRGGBB / without #) → #rrggbb or null. */
export function normalizeHexColor(raw: string): string | null {
  const t = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(t)) {
    const expanded = t
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(t)) {
    return `#${t.toLowerCase()}`;
  }
  return null;
}
