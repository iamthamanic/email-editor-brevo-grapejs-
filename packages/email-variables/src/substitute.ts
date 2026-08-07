/**
 * Replace {{ params.x }} / nested paths with sample values; unknown tags kept.
 * Location: packages/email-variables/src/substitute.ts
 */

import { PARAM_EXPR_GLOBAL } from "./expression.js";
import type { SampleData } from "./sample.js";

function lookupSample(sample: SampleData, path: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(sample, path)) {
    const v = sample[path];
    if (v === undefined || v === null) return undefined;
    return String(v);
  }
  // Nested path: walk object if sample stored as nested (rare); else miss.
  const parts = path.split(".");
  let cur: unknown = sample;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur === undefined || cur === null) return undefined;
  return String(cur);
}

export function substituteParams(
  html: string,
  sample: SampleData,
): string {
  if (!html) return "";
  const re = new RegExp(PARAM_EXPR_GLOBAL.source, "g");
  return html.replace(re, (match, key: string) => {
    const value = lookupSample(sample, key);
    if (value === undefined) return match;
    return value;
  });
}
