/**
 * Brevo params expression helpers ({{ params.key }}).
 * Location: packages/email-variables/src/expression.ts
 */

import { isKnownVariableKey } from "./registry.js";

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/i;
const EXPR_PATTERN = /\{\{\s*params\.(\w+)\s*\}\}/g;

export function toExpression(key: string): string {
  if (!KEY_PATTERN.test(key) || !isKnownVariableKey(key)) {
    throw new Error(`Unknown or invalid variable key: ${key}`);
  }
  return `{{ params.${key} }}`;
}

export function isValidExpression(text: string): boolean {
  const m = /^\{\{\s*params\.(\w+)\s*\}\}$/.exec(text.trim());
  if (!m) return false;
  return isKnownVariableKey(m[1]!);
}

/** Extract all params keys referenced in HTML/text (known or unknown). */
export function extractParamKeys(html: string): string[] {
  const keys = new Set<string>();
  const re = new RegExp(EXPR_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    keys.add(match[1]!);
  }
  return [...keys];
}
