/**
 * Template HTTP routes.
 * Location: apps/api/src/templates/routes.ts
 */

import type { FastifyInstance } from "fastify";
import {
  ERROR_CODES,
  fail,
  ok,
  type CreateTemplateBody,
  type PatchTemplateBody,
} from "@email-template/email-schema";
import { requirePermission } from "../auth/dev-auth.js";
import {
  ServiceError,
  createTemplate,
  getTemplate,
  listTemplates,
  patchTemplate,
} from "./service.js";

function handleError(
  error: unknown,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
): unknown {
  if (error instanceof ServiceError) {
    return reply.code(error.httpStatus).send(fail(error.code, error.message));
  }
  console.error("[templates]", error);
  return reply
    .code(500)
    .send(fail(ERROR_CODES.INTERNAL, "Unexpected server error."));
}

export async function registerTemplateRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/templates", async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.read")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
    }
    try {
      const data = await listTemplates();
      return ok(data);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/templates/:id",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.read")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
      }
      try {
        const data = await getTemplate(request.params.id);
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.post<{ Body: CreateTemplateBody }>(
    "/api/templates",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.create")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.create."));
      }
      try {
        const data = await createTemplate(request.body ?? { name: "" });
        return reply.code(201).send(ok(data));
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: PatchTemplateBody }>(
    "/api/templates/:id",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.edit")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.edit."));
      }
      try {
        const data = await patchTemplate(request.params.id, request.body);
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );
}
