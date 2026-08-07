/**
 * Apply embed / host theme readiness for HVAI drop-in.
 * Location: apps/editor/src/theme/applyHostChrome.ts
 */

/** Sets data-embed when opened as ERP iframe (?embed=1). */
export function applyEmbedModeFromUrl(search = window.location.search): void {
  const params = new URLSearchParams(search);
  if (params.get("embed") === "1") {
    document.documentElement.setAttribute("data-embed", "1");
  }
}

/**
 * Apply a subset of Theme Contract tokens from a host map (postMessage later).
 * Only allows --erp-* keys already present on :root.
 */
export function applyThemeTokens(
  tokens: Record<string, string>,
  root: HTMLElement = document.documentElement,
): void {
  for (const [key, value] of Object.entries(tokens)) {
    if (!key.startsWith("--erp-")) continue;
    if (typeof value !== "string" || value.length === 0 || value.length > 200) {
      continue;
    }
    // Block CSS injection attempts
    if (/[;{}]|url\s*\(/i.test(value)) continue;
    root.style.setProperty(key, value);
  }
}
