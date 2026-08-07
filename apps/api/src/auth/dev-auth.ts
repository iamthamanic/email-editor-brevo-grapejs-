/**
 * Auth adapter — hides identity source (dev stub vs future ERP tokens).
 * Location: apps/api/src/auth/dev-auth.ts
 *
 * Fail-closed: AUTH_MODE must be explicitly "dev" for the stub.
 * Unset / unknown modes → 401 (no default admin).
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ERROR_CODES,
  fail,
  type AuthUser,
  type Permission,
} from "@email-template/email-schema";

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

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.method === "OPTIONS") {
    return;
  }

  if (isDevAuthEnabled()) {
    // ponytail: fixed DevUser; swap for ERP JWT verify when AUTH_MODE=erp
    request.user = DEV_USER;
    return;
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
