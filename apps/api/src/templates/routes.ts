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
  buildSendEventsCsv,
  createTemplate,
  convertTemplate,
  deleteTemplate,
  getTemplate,
  getTemplateInsights,
  listTemplates,
  patchTemplate,
} from "./service.js";
import { syncTemplatesFromBrevo } from "./brevoSync.js";

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

  // Must be before /api/templates/:id
  app.post("/api/templates/sync-brevo", async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.edit")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.edit."));
    }
    try {
      const data = await syncTemplatesFromBrevo();
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
        const data = await createTemplate(request.body ?? { name: "" }, request.user);
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
        const data = await patchTemplate(
          request.params.id,
          request.body,
          request.user,
        );
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body?: { force?: boolean; html?: string };
  }>("/api/templates/:id/convert", async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.edit")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.edit."));
    }
    try {
      const data = await convertTemplate(request.params.id, request.user, {
        force: Boolean(request.body?.force),
        html: request.body?.html,
      });
      return ok(data);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>(
    "/api/templates/:id/insights",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.read")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
      }
      try {
        const data = await getTemplateInsights(request.params.id);
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/templates/:id/statistics.csv",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.read")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
      }
      try {
        const insights = await getTemplateInsights(request.params.id);
        const csv = buildSendEventsCsv(
          insights.templateName,
          insights.sendEvents,
        );
        const safeName = insights.templateName
          .replace(/[^\w\-]+/g, "_")
          .slice(0, 60);
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header(
          "Content-Disposition",
          `attachment; filename="template-statistik-${safeName || insights.templateId}.csv"`,
        );
        return reply.send(csv);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/templates/:id",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.delete")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.delete."));
      }
      try {
        const data = await deleteTemplate(request.params.id);
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );
}
