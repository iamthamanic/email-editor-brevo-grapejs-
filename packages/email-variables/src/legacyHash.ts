/**
 * Legacy #TOKEN# → {{ params.key }} migration helpers.
 * Location: packages/email-variables/src/legacyHash.ts
 *
 * Maps ERP/Brevo hash placeholders to the allowlisted params registry.
 * Unknown hashes are left unchanged.
 */

import { toExpression } from "./expression.js";

/** Uppercase legacy token → params path (must be known registry keys). */
export const LEGACY_HASH_TO_PARAM: Readonly<Record<string, string>> = {
  KUNDE_NAME: "name",
  BESTELLNR: "bestellnummer",
  ADRESSE: "adresse",
  DATUM_VON: "datum_von",
  DATUM_BIS: "datum_bis",
  UHR_VON: "uhrzeit_von",
  UHR_BIS: "uhrzeit_bis",
  LANGE: "lange",
  WOFUR: "wofur",
  BWB_ZEICHEN: "bwb.id",
  /** Single-date slot in BWB / order context → bestelldatum (not params.Datum). */
  DATUM: "bestelldatum",
};

/**
 * Matches ###TOKEN### or #TOKEN# (prefer longer so triple hashes do not leave
 * stray # around the replacement).
 */
const LEGACY_HASH_RE = /#{1,3}([A-Za-z][A-Za-z0-9_]*)#{1,3}/g;

export function hasLegacyHashTokens(text: string): boolean {
  if (!text) return false;
  const re = new RegExp(LEGACY_HASH_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1]!.toUpperCase();
    if (key in LEGACY_HASH_TO_PARAM) return true;
  }
  return false;
}

/** Replace known legacy hashes with {{ params.* }}; unknown hashes unchanged. */
export function replaceLegacyHashTokens(text: string): string {
  if (!text || !text.includes("#")) return text;
  return text.replace(LEGACY_HASH_RE, (full, rawKey: string) => {
    const mapped = LEGACY_HASH_TO_PARAM[rawKey.toUpperCase()];
    if (!mapped) return full;
    return toExpression(mapped);
  });
}

/** Deep-walk JSON-like values and replace hashes in every string leaf. */
export function replaceLegacyHashTokensDeep<T>(value: T): T {
  if (typeof value === "string") {
    return replaceLegacyHashTokens(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceLegacyHashTokensDeep(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = replaceLegacyHashTokensDeep(v);
    }
    return out as T;
  }
  return value;
}
