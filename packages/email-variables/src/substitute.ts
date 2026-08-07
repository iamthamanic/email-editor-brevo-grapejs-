/**
 * Replace {{ params.x }} with sample values; unknown tags kept.
 * Location: packages/email-variables/src/substitute.ts
 */

import type { SampleData } from "./sample.js";

const PARAM_RE = /\{\{\s*params\.(\w+)\s*\}\}/g;

export function substituteParams(
  html: string,
  sample: SampleData,
): string {
  if (!html) return "";
  return html.replace(PARAM_RE, (match, key: string) => {
    const value = sample[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}
