/**
 * Saved section HTTP routes.
 * Location: apps/api/src/saved-sections/routes.ts
 */

import type { FastifyInstance } from "fastify";
import {
  ERROR_CODES,
  fail,
  ok,
  type CreateSavedSectionBody,
  type PatchSavedSectionBody,
} from "@email-template/email-schema";
import { requirePermission } from "../auth/dev-auth.js";
import { ServiceError } from "../templates/service.js";
import {
  createSavedSection,
  deleteSavedSection,
  getSavedSection,
  harvestFromAllTemplates,
  listSavedSections,
  patchSavedSection,
} from "./service.js";

function handleError(
  error: unknown,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
): unknown {
  if (error instanceof ServiceError) {
    return reply.code(error.httpStatus).send(fail(error.code, error.message));
  }
  console.error("[saved-sections]", error);
  return reply
    .code(500)
    .send(fail(ERROR_CODES.INTERNAL, "Unexpected server error."));
}

export async function registerSavedSectionRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get<{ Querystring: { role?: string } }>(
    "/api/saved-sections",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.read")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
      }
      try {
        return ok(await listSavedSections(request.query.role));
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/saved-sections/:id",
    async (request, reply) => {
      if (!requirePermission(request.user, "email_templates.read")) {
        return reply
          .code(403)
          .send(fail(ERROR_CODES.FORBIDDEN, "Missing email_templates.read."));
      }
      try {
        return ok(await getSavedSection(request.params.id));
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.post<{ Body: CreateSavedSectionBody }>(
    "/api/saved-sections",
    async (request, reply) => {
      if (
        !requirePermission(request.user, "email_templates.manage_saved_sections")
      ) {
        return reply
          .code(403)
          .send(
            fail(
              ERROR_CODES.FORBIDDEN,
              "Missing email_templates.manage_saved_sections.",
            ),
          );
      }
      try {
        const data = await createSavedSection(request.body ?? ({} as CreateSavedSectionBody));
        return reply.code(201).send(ok(data));
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  /** One-shot / manual: harvest Textbausteine from all local templates. */
  app.post("/api/saved-sections/harvest", async (request, reply) => {
    if (
      !requirePermission(request.user, "email_templates.manage_saved_sections")
    ) {
      return reply
        .code(403)
        .send(
          fail(
            ERROR_CODES.FORBIDDEN,
            "Missing email_templates.manage_saved_sections.",
          ),
        );
    }
    try {
      const data = await harvestFromAllTemplates();
      return ok(data);
    } catch (error) {
      return handleError(error, reply);
    }
  });

  app.patch<{ Params: { id: string }; Body: PatchSavedSectionBody }>(
    "/api/saved-sections/:id",
    async (request, reply) => {
      if (
        !requirePermission(request.user, "email_templates.manage_saved_sections")
      ) {
        return reply
          .code(403)
          .send(
            fail(
              ERROR_CODES.FORBIDDEN,
              "Missing email_templates.manage_saved_sections.",
            ),
          );
      }
      try {
        const data = await patchSavedSection(
          request.params.id,
          request.body ?? {},
        );
        return ok(data);
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/saved-sections/:id",
    async (request, reply) => {
      if (
        !requirePermission(request.user, "email_templates.manage_saved_sections")
      ) {
        return reply
          .code(403)
          .send(
            fail(
              ERROR_CODES.FORBIDDEN,
              "Missing email_templates.manage_saved_sections.",
            ),
          );
      }
      try {
        await deleteSavedSection(request.params.id);
        return ok({ ok: true });
      } catch (error) {
        return handleError(error, reply);
      }
    },
  );
}
