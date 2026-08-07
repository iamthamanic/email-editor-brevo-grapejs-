/**
 * Brevo params expression helpers ({{ params.key }} / nested paths).
 * Location: packages/email-variables/src/expression.ts
 *
 * Single shared regex for importer, editor, and renderer (DRY).
 */

import { isKnownVariableKey } from "./registry.js";

/** One path segment: letters, digits, underscore. */
export const PARAM_SEGMENT = "[a-zA-Z0-9_]+";

/** Full path: name or name.nested.deep */
export const PARAM_PATH = `${PARAM_SEGMENT}(?:\\.${PARAM_SEGMENT})*`;

/** Matches {{ params.foo }} / {{params.a.b}} anywhere in text/HTML. */
export const PARAM_EXPR_GLOBAL = new RegExp(
  `\\{\\{\\s*params\\.(${PARAM_PATH})\\s*\\}\\}`,
  "g",
);

const KEY_PATTERN = new RegExp(`^${PARAM_PATH}$`);
const FULL_EXPR = new RegExp(`^\\{\\{\\s*params\\.(${PARAM_PATH})\\s*\\}\\}$`);

export function isValidParamPath(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function toExpression(key: string): string {
  if (!isValidParamPath(key)) {
    throw new Error(`Invalid variable key: ${key}`);
  }
  if (!isKnownVariableKey(key)) {
    throw new Error(`Unknown or invalid variable key: ${key}`);
  }
  return `{{ params.${key} }}`;
}

export function isValidExpression(text: string): boolean {
  const m = FULL_EXPR.exec(text.trim());
  if (!m) return false;
  return isKnownVariableKey(m[1]!);
}

/** Extract all params paths referenced in HTML/text (known or unknown). */
export function extractParamKeys(html: string): string[] {
  const keys = new Set<string>();
  const re = new RegExp(PARAM_EXPR_GLOBAL.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    keys.add(match[1]!);
  }
  return [...keys];
}

/** Split plain text into alternating text chunks and param keys. */
export function splitParamExpressions(
  text: string,
): Array<{ type: "text"; value: string } | { type: "param"; key: string }> {
  const out: Array<
    { type: "text"; value: string } | { type: "param"; key: string }
  > = [];
  const re = new RegExp(PARAM_EXPR_GLOBAL.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", value: text.slice(last, m.index) });
    }
    out.push({ type: "param", key: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ type: "text", value: text.slice(last) });
  }
  if (out.length === 0 && text) {
    out.push({ type: "text", value: text });
  }
  return out;
}
