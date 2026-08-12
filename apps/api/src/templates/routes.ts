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
  type PublishTemplateBody,
  type ResolveSyncConflictBody,
} from "@email-template/email-schema";
import { requirePermission } from "../auth/dev-auth.js";
import { rateLimit } from "../security/rateLimit.js";
import {
  ServiceError,
  buildSendEventsCsv,
  createTemplate,
  convertTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  getTemplateInsights,
  listTemplates,
  patchTemplate,
  resolveSyncConflict,
} from "./service.js";
import { migrateBrevoEditor } from "./migrateBrevoEditor.js";
import { migrateLegacyHashes } from "./migrateLegacyHashes.js";
import { syncTemplatesFromBrevo } from "./brevoSync.js";
import { publishTemplate } from "./publish.js";
import { SendTestError, sendTemplateTest } from "./sendTest.js";
import { BrevoApiError } from "../brevo/client.js";
import { BrevoTemplateGateway } from "../brevo/gateway.js";

function handleError(
  error: unknown,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
): unknown {
  if (error instanceof ServiceError) {
    return reply.code(error.httpStatus).send(fail(error.code, error.message));
  }
  if (error instanceof SendTestError) {
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
  app.post(
    "/api/templates/sync-brevo",
    {
      preHandler: [
        rateLimit({ name: "sync-brevo", max: 5, windowMs: 60_000 }),
      ],
    },
    async (request, reply) => {
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

  /**
   * Batch: replace legacy #TOKEN# with {{ params.* }} in subject/HTML/editorData.
   * Does not publish to Brevo.
   */
  app.post(
    "/api/templates/migrate-legacy-hashes",
    {
      preHandler: [
        rateLimit({ name: "migrate-hashes", max: 3, windowMs: 60_000 }),
      ],
    },
    async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.edit")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.edit."));
    }
    try {
      const data = await migrateLegacyHashes(request.user);
      return ok(data);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /** Verified Brevo Absender for template sender dropdown. */
  app.get("/api/brevo/senders", async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.read")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
    }
    try {
      const data = await BrevoTemplateGateway.listSenders();
      return ok(data);
    } catch (error) {
      if (error instanceof BrevoApiError) {
        return reply
          .code(error.httpStatus >= 400 && error.httpStatus < 600 ? error.httpStatus : 502)
          .send(fail(ERROR_CODES.VALIDATION, error.message));
      }
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

  /**
   * Publish current editor HTML to Brevo (create or update SMTP template).
   * Permission: email_templates.publish. Autosave stays local-only.
   */
  app.post<{ Params: { id: string }; Body: PublishTemplateBody }>(
    "/api/templates/:id/publish",
    {
      preHandler: [
        rateLimit({ name: "publish", max: 30, windowMs: 60_000 }),
      ],
    },
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.publish")) {
        return reply
          .code(403)
          .send(
            fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.publish."),
          );
      }
      try {
        const data = await publishTemplate(
          request.params.id,
          request.body ?? { expectedRevision: -1, html: "" },
          request.user,
        );
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  /**
   * Resolve CONFLICT / REMOTE_CHANGED: accept_remote | keep_local (no LWW).
   * Permission: email_templates.edit
   */
  app.post<{ Params: { id: string }; Body: ResolveSyncConflictBody }>(
    "/api/templates/:id/resolve-sync",
    {
      preHandler: [
        rateLimit({ name: "resolve-sync", max: 30, windowMs: 60_000 }),
      ],
    },
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.edit")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.edit."));
      }
      try {
        const body = request.body ?? {
          action: "keep_local" as const,
          expectedRevision: -1,
        };
        const data = await resolveSyncConflict(request.params.id, body);
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  /**
   * Explicit Brevo re-import when editorSchemaVersion is outdated.
   * Separate from /convert (which uses published_html / pasted HTML).
   */
  app.post<{ Params: { id: string } }>(
    "/api/templates/:id/migrate-brevo-editor",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.edit")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.edit."));
      }
      try {
        const data = await migrateBrevoEditor(
          request.params.id,
          request.user,
        );
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  /**
   * Test send: current editor HTML (preferred) or Brevo published template test.
   * Brevo API key stays on the server.
   */
  app.post<{
    Params: { id: string };
    Body: {
      emails?: string[];
      html?: string;
      subject?: string;
      usePublishedTemplate?: boolean;
    };
  }>(
    "/api/templates/:id/send-test",
    {
      preHandler: [
        rateLimit({ name: "send-test", max: 20, windowMs: 60_000 }),
      ],
    },
    async (request, reply) => {
    if (!requirePermission(request.user, "email_templates.publish")) {
      return reply
        .code(403)
        .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.publish."));
    }
    try {
      const data = await sendTemplateTest(
        request.params.id,
        {
          emails: request.body?.emails ?? [],
          html: request.body?.html,
          subject: request.body?.subject,
          usePublishedTemplate: Boolean(request.body?.usePublishedTemplate),
        },
        request.user,
      );
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

  app.post<{ Params: { id: string } }>(
    "/api/templates/:id/duplicate",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.create")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.create."));
      }
      try {
        const data = await duplicateTemplate(request.params.id, request.user);
        return reply.code(201).send(ok(data));
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
