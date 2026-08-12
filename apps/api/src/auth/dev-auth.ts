/**
 * Auth adapter — hides identity source (dev stub vs ERP JWT).
 * Location: apps/api/src/auth/dev-auth.ts
 *
 * Fail-closed: AUTH_MODE must be explicitly "dev" or "erp".
 * Unset / unknown modes → 401 (no default admin).
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ERROR_CODES,
  fail,
  type AuthUser,
  type Permission,
} from "@email-template/email-schema";
import { verifyErpHs256Jwt } from "./erpJwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

const DEV_PERMISSIONS: Permission[] = [
  "email_templates.read",
  "email_templates.create",
  "email_templates.edit",
  "email_templates.publish",
  "email_templates.delete",
  "email_templates.manage_components",
  "email_templates.manage_saved_sections",
  "email_templates.raw_html",
];

const DEV_USER: AuthUser = {
  id: "dev-user",
  displayName: "Dev User",
  permissions: DEV_PERMISSIONS,
};

/** Explicit mode string, or null when unset (deny-by-default). */
export function getAuthMode(): string | null {
  const raw = process.env.AUTH_MODE?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function isDevAuthEnabled(): boolean {
  return getAuthMode() === "dev";
}

export function isErpAuthEnabled(): boolean {
  return getAuthMode() === "erp";
}

export function isLoopbackHost(host: string): boolean {
  return (
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "localhost"
  );
}

/**
 * Refuse insecure DevAuth binds unless ALLOW_INSECURE_DEV=1.
 * Call once at process startup.
 */
export function assertSafeDevBind(host: string): void {
  if (!isDevAuthEnabled()) return;
  if (isLoopbackHost(host)) return;
  if (process.env.ALLOW_INSECURE_DEV === "1") {
    console.warn(
      "[auth] ALLOW_INSECURE_DEV=1 — DevAuth listening on non-loopback host",
    );
    return;
  }
  throw new Error(
    `Refusing AUTH_MODE=dev on host "${host}". Bind API_HOST=127.0.0.1 or set ALLOW_INSECURE_DEV=1.`,
  );
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || typeof header !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || null;
}

/** Unguessable UUID asset filenames — safe for public GET (canvas img src). */
const PUBLIC_ASSET_PATH =
  /^\/api\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;

function requestPathname(url: string): string {
  return url.split("?")[0] ?? url;
}

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.method === "OPTIONS") {
    return;
  }

  const pathname = requestPathname(request.url);

  // Health stays public for probes
  if (pathname === "/api/health") {
    return;
  }

  // Canvas img src cannot send Authorization — capability URL by UUID name
  if (request.method === "GET" && PUBLIC_ASSET_PATH.test(pathname)) {
    return;
  }

  if (isDevAuthEnabled()) {
    request.user = DEV_USER;
    return;
  }

  if (isErpAuthEnabled()) {
    const secret = process.env.ERP_JWT_SECRET?.trim();
    if (!secret) {
      await reply
        .code(500)
        .send(
          fail(
            ERROR_CODES.INTERNAL,
            "ERP auth misconfigured (ERP_JWT_SECRET).",
          ),
        );
      return;
    }
    const token = bearerToken(request);
    if (!token) {
      await reply
        .code(401)
        .send(fail(ERROR_CODES.UNAUTHORIZED, "Bearer token required."));
      return;
    }
    try {
      request.user = verifyErpHs256Jwt(token, secret);
      return;
    } catch {
      await reply
        .code(401)
        .send(fail(ERROR_CODES.UNAUTHORIZED, "Invalid or expired token."));
      return;
    }
  }

  await reply
    .code(401)
    .send(fail(ERROR_CODES.UNAUTHORIZED, "Authentication required."));
}

export function requirePermission(
  user: AuthUser,
  permission: Permission,
): boolean {
  return user.permissions.includes(permission);
}
