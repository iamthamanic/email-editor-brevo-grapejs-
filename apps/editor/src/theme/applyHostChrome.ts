/**
 * Apply embed / host theme readiness for HVAI drop-in.
 * Location: apps/editor/src/theme/applyHostChrome.ts
 */

const DEFAULT_PARENT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

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

function allowedParentOrigins(): Set<string> {
  const fromEnv = (
    import.meta.env.VITE_EMBED_PARENT_ORIGINS as string | undefined
  )
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...(fromEnv ?? []), ...DEFAULT_PARENT_ORIGINS]);
}

/**
 * Listen for host theme updates:
 * `{ type: "ets:theme", tokens: { "--erp-color-primary": "#275073" } }`
 */
export function listenHostThemeMessages(): () => void {
  const allow = allowedParentOrigins();
  const onMessage = (event: MessageEvent) => {
    if (!allow.has(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    const msg = data as { type?: unknown; tokens?: unknown };
    if (msg.type !== "ets:theme") return;
    if (
      !msg.tokens ||
      typeof msg.tokens !== "object" ||
      Array.isArray(msg.tokens)
    ) {
      return;
    }
    const tokens: Record<string, string> = {};
    for (const [k, v] of Object.entries(
      msg.tokens as Record<string, unknown>,
    )) {
      if (typeof v === "string") tokens[k] = v;
    }
    applyThemeTokens(tokens);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
