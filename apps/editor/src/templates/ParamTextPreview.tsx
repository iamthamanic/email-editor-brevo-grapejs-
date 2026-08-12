/**
 * Read-only plain text with {{ params.* }} rendered as subject-style pills.
 * Location: apps/editor/src/templates/ParamTextPreview.tsx
 */

import {
  getVariable,
  isKnownVariableKey,
  replaceLegacyHashTokens,
  splitParamExpressions,
} from "@email-template/email-variables";

interface ParamTextPreviewProps {
  text: string;
  className?: string;
}

/** Normalize legacy #TOKEN# then split into text + param segments for pills. */
export function ParamTextPreview({ text, className }: ParamTextPreviewProps) {
  const normalized = replaceLegacyHashTokens(text);
  const parts = splitParamExpressions(normalized);
  if (parts.length === 0) return null;

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <span key={`t-${i}`}>{part.value}</span>;
        }
        const known = isKnownVariableKey(part.key);
        const expression = `{{ params.${part.key} }}`;
        const meaning = getVariable(part.key)?.label ?? part.key;
        return (
          <span
            key={`p-${part.key}-${i}`}
            className={`compose-subject-pill${known ? "" : " is-unknown"}`}
            title={`${meaning} — ${expression}`}
            aria-label={`${meaning}: ${expression}`}
          >
            {expression}
          </span>
        );
      })}
    </span>
  );
}

/** First sentence of body text (collapsed preview). */
export function firstSentenceOf(plain: string): string {
  const t = plain.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const match = t.match(/^(.+?[.!?])(?:\s|$)/u);
  return (match?.[1] ?? t).trim();
}

/** True when body has more than the first sentence (or is long enough to need expand). */
export function hasMoreAfterFirstSentence(plain: string): boolean {
  const compact = plain.replace(/\s+/g, " ").trim();
  if (!compact) return false;
  const first = firstSentenceOf(compact);
  if (compact.length > first.length + 1) return true;
  // Long single sentence still needs expand (line-clamp hides the rest)
  return compact.length > 140;
}
