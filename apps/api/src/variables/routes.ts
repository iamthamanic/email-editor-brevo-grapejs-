/**
 * Variable catalog + sample preview routes.
 * Location: apps/api/src/variables/routes.ts
 */

import type { FastifyInstance } from "fastify";
import {
  EMAIL_VARIABLES,
  getSampleData,
  toExpression,
} from "@email-template/email-variables";
import { ERROR_CODES, fail, ok } from "@email-template/email-schema";
import { requirePermission } from "../auth/dev-auth.js";

export async function registerVariableRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/variables", async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.read")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
    }

    const variables = EMAIL_VARIABLES.map((v) => ({
      key: v.key,
      label: v.label,
      description: v.description,
      group: v.group,
      groupLabel: v.groupLabel,
      expression: toExpression(v.key),
    }));

    return ok({ variables });
  });

  app.get("/api/preview/sample", async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.read")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
    }

    return ok({ sample: getSampleData() });
  });
}
