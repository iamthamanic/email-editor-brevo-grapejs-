/**
 * Shared fetch JSON parser with clear DE errors when API/proxy is down.
 * Location: apps/editor/src/api/parseApiResponse.ts
 */

import type { ApiResponse } from "@email-template/email-schema";

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) {
    const error = new Error(
      response.status === 0 || response.status === 502 || response.status === 504
        ? "API nicht erreichbar. Starte `npm run dev:api` (Port 3001)."
        : `Leere Antwort vom Server (HTTP ${response.status}). Läuft die API?`,
    ) as Error & { code?: string; status?: number };
    error.code = "EMPTY_RESPONSE";
    error.status = response.status;
    throw error;
  }

  let body: ApiResponse<T>;
  try {
    body = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    const error = new Error(
      `Ungültige API-Antwort (HTTP ${response.status}). Proxy/API prüfen — erwartet JSON.`,
    ) as Error & { code?: string; status?: number };
    error.code = "INVALID_JSON";
    error.status = response.status;
    throw error;
  }

  if (!response.ok || body.error || body.data === null) {
    const message = body.error?.message ?? `Request failed (${response.status})`;
    const code = body.error?.code ?? "REQUEST_FAILED";
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return body.data;
}
