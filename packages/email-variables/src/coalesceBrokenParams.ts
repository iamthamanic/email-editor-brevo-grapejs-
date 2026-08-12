/**
 * Heal GrapesJS RTE splits: `… bis</p><div>{{ params.x }}…` → one line.
 * Location: packages/email-variables/src/coalesceBrokenParams.ts
 */

/** True if markup is only email-param badge(s) and/or {{ params.* }} text. */
export function isParamOnlyMarkup(html: string): boolean {
  const withoutBadges = html.replace(
    /<span\b[^>]*(?:\bdata-email-type\s*=\s*["']email-param["']|\bdata-param-key\s*=)[^>]*>[\s\S]*?<\/span>/gi,
    "",
  );
  const text = withoutBadges
    .replace(/<\/?span\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return /(?:\bdata-email-type\s*=\s*["']email-param["']|\bdata-param-key\s*=)/i.test(
      html,
    );
  }

  // Plain mustache-only (import document.html before badge upgrade)
  const withoutMustache = text
    .replace(/\{\{\s*params\.[^}]+\}\}/g, "")
    .replace(/\s+/g, "")
    .trim();
  return withoutMustache.length === 0 && /\{\{\s*params\./.test(text);
}

function findBalancedClose(
  html: string,
  innerStart: number,
  tag: string,
): { innerEnd: number; closeEnd: number } | null {
  const token = new RegExp(`</?${tag}\\b[^>]*>`, "gi");
  token.lastIndex = innerStart;
  let depth = 1;
  while (true) {
    const m = token.exec(html);
    if (!m) return null;
    if (/^<\//.test(m[0])) {
      depth -= 1;
      if (depth === 0) {
        return { innerEnd: m.index, closeEnd: m.index + m[0].length };
      }
      continue;
    }
    if (!/\/\s*>$/.test(m[0])) depth += 1;
  }
}

function elementEnd(html: string, start: number): number {
  const open = html.slice(start).match(/^<([a-z][\w-]*)\b[^>]*\/?>/i);
  if (!open) return -1;
  const tag = open[1]!;
  if (/\/\s*>$/.test(open[0]) || /^br$/i.test(tag)) {
    return start + open[0].length;
  }
  const bal = findBalancedClose(html, start + open[0].length, tag);
  return bal ? bal.closeEnd : -1;
}

/**
 * Consume leading param-only `<span>…</span>` chunks before `<br>` or text.
 */
export function takeLeadingParamChunks(
  inner: string,
): { leading: string; rest: string } | null {
  let i = 0;
  while (i < inner.length) {
    if (/\s/.test(inner[i]!)) {
      i += 1;
      continue;
    }
    const nbsp = inner.slice(i).match(/^&nbsp;|^&#160;/i);
    if (nbsp) {
      i += nbsp[0].length;
      continue;
    }
    break;
  }
  const contentStart = i;
  let end = i;
  while (i < inner.length) {
    if (inner[i] !== "<") break;
    if (/^<br\s*\/?>/i.test(inner.slice(i))) break;
    if (!/^<span\b/i.test(inner.slice(i))) break;
    const closeAt = elementEnd(inner, i);
    if (closeAt < 0) break;
    const chunk = inner.slice(i, closeAt);
    if (!isParamOnlyMarkup(chunk)) break;
    end = closeAt;
    i = closeAt;
  }
  if (end <= contentStart) return null;
  return {
    leading: inner.slice(contentStart, end),
    rest: inner.slice(end),
  };
}

/**
 * Merge `bis</p><div>PARAM…` / partial leading PARAM before `<br>` back into
 * the preceding block so canvas + export stay on one line.
 */
export function coalesceBrokenParamHtml(html: string): string {
  if (!html || !/bis/i.test(html)) return html;

  const bisSplit =
    /(bis)((?:\s|&nbsp;|&#160;)*)<\/(p|div)>\s*<(p|div)(\s[^>]*)?>/gi;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = bisSplit.exec(html)) !== null) {
    const matchStart = m.index;
    const matchEnd = m.index + m[0].length;
    const bis = m[1]!;
    const space = m[2]!;
    const closeTag = m[3]!;
    const openTag = m[4]!;
    const attrs = m[5] ?? "";

    const bal = findBalancedClose(html, matchEnd, openTag);
    if (!bal) continue;

    const inner = html.slice(matchEnd, bal.innerEnd);
    const taken = takeLeadingParamChunks(inner);
    if (!taken) continue;

    parts.push(html.slice(last, matchStart));

    const restEmpty = !taken.rest.replace(/(?:\s|&nbsp;|&#160;)/gi, "").trim();
    if (restEmpty) {
      parts.push(`${bis}${space}${taken.leading}</${closeTag}>`);
    } else {
      parts.push(
        `${bis}${space}${taken.leading}</${closeTag}><${openTag}${attrs}>${taken.rest}</${openTag}>`,
      );
    }

    last = bal.closeEnd;
    bisSplit.lastIndex = last;
  }

  if (last === 0) return html;
  parts.push(html.slice(last));
  return parts.join("");
}

/** Deep-walk JSON / editorData and coalesce string fields that look like HTML. */
export function coalesceBrokenParamHtmlDeep(value: unknown): unknown {
  if (typeof value === "string") {
    if (/bis/i.test(value) && /<[a-z]/i.test(value)) {
      return coalesceBrokenParamHtml(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(coalesceBrokenParamHtmlDeep);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = coalesceBrokenParamHtmlDeep(v);
    }
    return out;
  }
  return value;
}
