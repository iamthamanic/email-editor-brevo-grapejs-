/**
 * Minimal HS256 JWT verify for AUTH_MODE=erp (no extra deps).
 * Location: apps/api/src/auth/erpJwt.ts
 *
 * Expected claims (flexible):
 * - sub | userId | id → user id
 * - exp → Unix seconds expiration (**required**)
 * - name | displayName → display name
 * - permissions: string[]  OR authorized_works / Authorized_Works: string[]
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthUser, Permission } from "@email-template/email-schema";

const KNOWN_PERMISSIONS = new Set<Permission>([
  "email_templates.read",
  "email_templates.create",
  "email_templates.edit",
  "email_templates.publish",
  "email_templates.delete",
  "email_templates.manage_components",
  "email_templates.manage_saved_sections",
  "email_templates.raw_html",
]);

function b64urlDecode(input: string): Buffer {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function b64urlJson(input: string): Record<string, unknown> {
  const text = b64urlDecode(input).toString("utf8");
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid JWT payload");
  }
  return parsed as Record<string, unknown>;
}

function filterPermissions(raw: unknown): Permission[] {
  if (!Array.isArray(raw)) return [];
  const out: Permission[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (KNOWN_PERMISSIONS.has(item as Permission)) {
      out.push(item as Permission);
    }
  }
  return out;
}

export function verifyErpHs256Jwt(
  token: string,
  secret: string,
): AuthUser {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT");
  }
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const header = b64urlJson(headerB64);
  if (header.alg !== "HS256") {
    throw new Error("Unsupported JWT alg");
  }

  const data = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", secret).update(data).digest();
  const actual = b64urlDecode(sigB64);
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    throw new Error("Invalid JWT signature");
  }

  const payload = b64urlJson(payloadB64);
  const exp = payload.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    throw new Error("JWT missing exp");
  }
  if (exp * 1000 < Date.now()) {
    throw new Error("JWT expired");
  }

  const id =
    (typeof payload.sub === "string" && payload.sub) ||
    (typeof payload.userId === "string" && payload.userId) ||
    (typeof payload.id === "string" && payload.id) ||
    "";
  if (!id) throw new Error("JWT missing subject");

  const displayName =
    (typeof payload.displayName === "string" && payload.displayName) ||
    (typeof payload.name === "string" && payload.name) ||
    id;

  const permissions = filterPermissions(
    payload.permissions ??
      payload.authorized_works ??
      payload.Authorized_Works,
  );

  return { id, displayName, permissions };
}

/** Build a test token (HS256). */
export function signErpHs256Jwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}
