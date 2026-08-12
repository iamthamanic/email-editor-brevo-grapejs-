/**
 * Publish template HTML to Brevo (create or update SMTP template).
 * Location: apps/api/src/templates/publish.ts
 */

import type { Prisma } from "@prisma/client";
import { sanitizeEmailHtml } from "@email-template/email-components/html";
import {
  ERROR_CODES,
  type AuthUser,
  type EditorProjectData,
  type PublishTemplateBody,
  type PublishTemplateResultDto,
} from "@email-template/email-schema";
import { BrevoApiError } from "../brevo/client.js";
import { BrevoTemplateGateway } from "../brevo/gateway.js";
import { assertVerifiedSenderEmail } from "../brevo/senderAllowlist.js";
import { SenderAllowlistError } from "../brevo/senderAllowlist.js";
import { prisma } from "../db.js";
import { ServiceError, toDtoFromRow } from "./service.js";

const MAX_HTML_BYTES = 900_000;
const MIN_HTML_CHARS = 10;
const PUBLISH_VERSION_REASON = "publish";

export interface PublishDeps {
  create?: typeof BrevoTemplateGateway.create;
  update?: typeof BrevoTemplateGateway.update;
}

function isPlainObject(value: unknown): value is EditorProjectData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveSender(row: {
  senderEmail: string | null;
  senderName: string | null;
}): { email: string; name?: string } {
  const email =
    row.senderEmail?.trim() ||
    process.env.BREVO_DEFAULT_SENDER_EMAIL?.trim() ||
    "";
  if (!email) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Kein Absender gesetzt (Template Absender-E-Mail oder BREVO_DEFAULT_SENDER_EMAIL).",
      400,
    );
  }
  const name =
    row.senderName?.trim() ||
    process.env.BREVO_DEFAULT_SENDER_NAME?.trim() ||
    undefined;
  return name ? { email, name } : { email };
}

async function resolveAndAssertSender(row: {
  senderEmail: string | null;
  senderName: string | null;
}): Promise<{ email: string; name?: string }> {
  const sender = resolveSender(row);
  try {
    await assertVerifiedSenderEmail(sender.email);
  } catch (err) {
    if (err instanceof SenderAllowlistError) {
      throw new ServiceError(err.code, err.message, err.httpStatus);
    }
    throw err;
  }
  return sender;
}

/**
 * Validate → sanitize → Brevo create/update → persist published snapshot.
 */
export async function publishTemplate(
  id: string,
  body: PublishTemplateBody,
  actor: AuthUser,
  deps: PublishDeps = {},
): Promise<PublishTemplateResultDto> {
  const createRemote = deps.create ?? BrevoTemplateGateway.create;
  const updateRemote = deps.update ?? BrevoTemplateGateway.update;

  if (
    typeof body.expectedRevision !== "number" ||
    !Number.isInteger(body.expectedRevision)
  ) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "expectedRevision must be an integer.",
      400,
    );
  }

  if (typeof body.html !== "string") {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "html muss ein String sein.",
      400,
    );
  }

  const htmlRaw = body.html.trim();
  if (htmlRaw.length < MIN_HTML_CHARS) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "HTML-Inhalt fehlt oder ist zu kurz für Brevo.",
      400,
    );
  }
  if (Buffer.byteLength(htmlRaw, "utf8") > MAX_HTML_BYTES) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "HTML ist zu groß für den Publish.",
      400,
    );
  }

  if (body.editorData !== undefined && !isPlainObject(body.editorData)) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "editorData must be a JSON object.",
      400,
    );
  }

  if (body.name !== undefined && !body.name.trim()) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Name cannot be empty.",
      400,
    );
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }

  if (existing.revision !== body.expectedRevision) {
    throw new ServiceError(
      ERROR_CODES.REVISION_CONFLICT,
      "Template was changed elsewhere. Reload and try again.",
      409,
    );
  }

  const name = (body.name?.trim() || existing.name).trim();
  const subject =
    body.subject !== undefined
      ? body.subject?.trim() || null
      : existing.subject;
  if (!subject) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Betreff ist zum Veröffentlichen erforderlich.",
      400,
    );
  }

  const editorData =
    body.editorData !== undefined
      ? body.editorData
      : (existing.editorData as EditorProjectData);

  const html = sanitizeEmailHtml(htmlRaw);
  if (html.trim().length < MIN_HTML_CHARS) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "HTML wurde nach Sanitizing ungültig. Bitte Inhalt prüfen.",
      400,
    );
  }

  const sender = await resolveAndAssertSender(existing);
  const replyTo = existing.replyTo?.trim() || undefined;

  let brevoId = existing.brevoTemplateId
    ? Number(existing.brevoTemplateId)
    : null;
  let created = false;

  try {
    if (brevoId && Number.isFinite(brevoId) && brevoId > 0) {
      await updateRemote(brevoId, {
        templateName: name,
        subject,
        htmlContent: html,
        sender,
        replyTo,
        isActive: true,
      });
    } else {
      const createdRemote = await createRemote({
        templateName: name,
        subject,
        htmlContent: html,
        sender,
        replyTo,
        isActive: true,
        tag: "email-template-service",
      });
      brevoId = createdRemote.id;
      created = true;
    }
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    if (err instanceof BrevoApiError) {
      throw new ServiceError(
        ERROR_CODES.PUBLISH_FAILED,
        err.message,
        err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502,
      );
    }
    throw new ServiceError(
      ERROR_CODES.PUBLISH_FAILED,
      err instanceof Error ? err.message : "Publish nach Brevo fehlgeschlagen.",
      502,
    );
  }

  if (!brevoId || !Number.isFinite(brevoId)) {
    throw new ServiceError(
      ERROR_CODES.PUBLISH_FAILED,
      "Brevo lieferte keine gültige Template-ID.",
      502,
    );
  }

  await prisma.templateVersion.create({
    data: {
      templateId: existing.id,
      revision: existing.revision,
      editorData: existing.editorData as Prisma.InputJsonValue,
      reason: PUBLISH_VERSION_REASON,
    },
  });

  const now = new Date();
  const row = await prisma.emailTemplate.update({
    where: { id: existing.id },
    data: {
      name,
      subject,
      editorData: editorData as Prisma.InputJsonValue,
      publishedHtml: html,
      publishedEditorData: editorData as Prisma.InputJsonValue,
      brevoTemplateId: BigInt(brevoId),
      status: "PUBLISHED",
      publishedAt: now,
      lastSyncedAt: now,
      senderEmail: existing.senderEmail?.trim() || sender.email,
      senderName:
        existing.senderName?.trim() || sender.name || existing.senderName,
      revision: existing.revision + 1,
    },
  });

  await prisma.templateAuditLog.create({
    data: {
      templateId: row.id,
      actorUserId: actor.id,
      actorDisplayName: actor.displayName,
      action: "published",
      revision: row.revision,
    },
  });

  return {
    template: toDtoFromRow(row),
    brevoTemplateId: String(brevoId),
    created,
  };
}
