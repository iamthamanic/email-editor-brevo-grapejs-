/**
 * In-memory IP rate limiter for expensive API routes.
 * Location: apps/api/src/security/rateLimit.ts
 *
 * ponytail: process-local Map; Redis/edge limiter when multi-instance.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { ERROR_CODES, fail } from "@email-template/email-schema";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Max requests in window. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
  /** Key prefix (route group). */
  name: string;
}

function clientKey(request: FastifyRequest, name: string): string {
  const ip = request.ip || "unknown";
  return `${name}:${ip}`;
}

/** Fastify preHandler factory. */
export function rateLimit(opts: RateLimitOptions) {
  return async function rateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const key = clientKey(request, opts.name);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      reply.header("Retry-After", String(retrySec));
      return reply
        .code(429)
        .send(
          fail(
            ERROR_CODES.VALIDATION,
            `Rate limit exceeded (${opts.name}). Retry in ${retrySec}s.`,
          ),
        );
    }
  };
}

/** Test helper. */
export function clearRateLimitBuckets(): void {
  buckets.clear();
}
