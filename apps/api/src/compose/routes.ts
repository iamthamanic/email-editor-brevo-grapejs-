/**
 * Compose HTTP routes (one-off email send).
 * Location: apps/api/src/compose/routes.ts
 */

import type { FastifyInstance } from "fastify";
import { ERROR_CODES, fail, ok } from "@email-template/email-schema";
import { requirePermission } from "../auth/dev-auth.js";
import { rateLimit } from "../security/rateLimit.js";
import { ComposeSendError, sendComposeEmail } from "./sendCompose.js";

export async function registerComposeRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{
    Body: {
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      html?: string;
    };
  }>(
    "/api/compose/send",
    {
      preHandler: [
        rateLimit({ name: "compose-send", max: 20, windowMs: 60_000 }),
      ],
    },
    async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.publish")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.publish."));
    }
    try {
      const data = await sendComposeEmail({
        to: request.body?.to ?? [],
        cc: request.body?.cc,
        bcc: request.body?.bcc,
        subject: request.body?.subject ?? "",
        html: request.body?.html ?? "",
      });
      return ok(data);
    } catch (error) {
      if (error instanceof ComposeSendError) {
        return reply
          .code(error.httpStatus)
          .send(fail(error.code, error.message));
      }
      console.error("[compose]", error);
      return reply
        .code(500)
        .send(fail(ERROR_CODES.INTERNAL, "Unexpected server error."));
    }
  },
  );
}
