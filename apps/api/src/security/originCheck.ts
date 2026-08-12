/**
 * CSRF mitigation for cookie-less CORS API: allowlisted Origin.
 * Location: apps/api/src/security/originCheck.ts
 *
 * Browser mutating requests send Origin; reject if not in allowlist.
 * Non-browser clients (no Origin) allowed — Bearer/DevAuth still required.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { ERROR_CODES, fail } from "@email-template/email-schema";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function parseAllowlist(): string[] {
  const raw =
    process.env.EDITOR_ORIGIN?.trim() || "http://localhost:5173";
  const extra = process.env.CORS_ADDITIONAL_ORIGINS?.trim() || "";
  const list = [raw, ...extra.split(",").map((s) => s.trim())].filter(
    Boolean,
  );
  return [...new Set(list)];
}

export async function originCheckHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!MUTATING.has(request.method)) return;
  if (request.method === "OPTIONS") return;

  const origin = request.headers.origin;
  if (!origin) return; // curl / server-to-server

  const allow = parseAllowlist();
  if (!allow.includes(origin)) {
    return reply
      .code(403)
      .send(fail(ERROR_CODES.FORBIDDEN, "Origin not allowed."));
  }
}
