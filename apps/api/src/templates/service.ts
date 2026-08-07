/**
 * Template domain service — hides revision concurrency and Prisma mapping.
 * Location: apps/api/src/templates/service.ts
 */

import type { EmailTemplate, Prisma } from "@prisma/client";
import {
  EMPTY_EDITOR_DATA,
  ERROR_CODES,
  type AuthUser,
  type ConversionStatus,
  type ConvertTemplateResultDto,
  type CreateTemplateBody,
  type EditorProjectData,
  type EmailTemplateDto,
  type EmailTemplateListItem,
  type PatchTemplateBody,
  type TemplateAuditAction,
  type TemplateInsightsDto,
  type TemplateSource,
  type TemplateStatus,
} from "@email-template/email-schema";
import {
  convertBrevoHtml,
  needsConversion,
} from "@email-template/legacy-importer";
import { prisma } from "../db.js";

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function isPlainObject(value: unknown): value is EditorProjectData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function editorDataKeys(data: unknown): number {
  if (!isPlainObject(data)) return 0;
  return Object.keys(data).length;
}

function deriveConversionStatus(row: EmailTemplate): ConversionStatus | null {
  const html = row.publishedHtml?.trim();
  if (!html) return null;
  if (row.status === "IMPORT_FAILED") return "IMPORT_FAILED";
  if (editorDataKeys(row.editorData) === 0) return "NOT_IMPORTED";
  const data = row.editorData as Record<string, unknown>;
  const report = data.report as { autoApproved?: boolean } | undefined;
  if (report && report.autoApproved === false) return "NEEDS_REVIEW";
  return "AUTO_APPROVED";
}

function toDto(row: EmailTemplate): EmailTemplateDto {
  return {
    id: row.id,
    brevoTemplateId: row.brevoTemplateId?.toString() ?? null,
    name: row.name,
    label: row.label,
    subject: row.subject,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    replyTo: row.replyTo,
    status: row.status as TemplateStatus,
    source: row.source as TemplateSource,
    editorData: row.editorData as EditorProjectData,
    legacyHtml: row.publishedHtml ?? null,
    conversionStatus: deriveConversionStatus(row),
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function toListItem(row: EmailTemplate): EmailTemplateListItem {
  return {
    id: row.id,
    brevoTemplateId: row.brevoTemplateId?.toString() ?? null,
    name: row.name,
    label: row.label,
    subject: row.subject,
    status: row.status as TemplateStatus,
    source: row.source as TemplateSource,
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function writeAuditLog(input: {
  templateId: string;
  actor: AuthUser;
  action: TemplateAuditAction;
  revision: number;
}): Promise<void> {
  await prisma.templateAuditLog.create({
    data: {
      templateId: input.templateId,
      actorUserId: input.actor.id,
      actorDisplayName: input.actor.displayName,
      action: input.action,
      revision: input.revision,
    },
  });
}

export async function listTemplates(): Promise<EmailTemplateListItem[]> {
  const rows = await prisma.emailTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toListItem);
}

export async function getTemplate(id: string): Promise<EmailTemplateDto> {
  const row = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!row) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }
  return toDto(row);
}

export async function createTemplate(
  body: CreateTemplateBody,
  actor: AuthUser,
): Promise<EmailTemplateDto> {
  const name = body.name?.trim();
  if (!name) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Name is required.",
      400,
    );
  }

  let editorData: EditorProjectData = EMPTY_EDITOR_DATA;
  if (body.editorData !== undefined) {
    if (!isPlainObject(body.editorData)) {
      throw new ServiceError(
        ERROR_CODES.VALIDATION,
        "editorData must be a JSON object.",
        400,
      );
    }
    editorData = body.editorData;
  }

  const label =
    body.label === undefined || body.label === null
      ? null
      : body.label.trim() || null;

  const row = await prisma.emailTemplate.create({
    data: {
      name,
      label,
      subject: body.subject ?? null,
      editorData: editorData as Prisma.InputJsonValue,
      publishedHtml: body.legacyHtml?.trim() || null,
      status: "DRAFT",
      source: body.legacyHtml?.trim() ? "BREVO" : "LOCAL",
      revision: 1,
    },
  });

  await writeAuditLog({
    templateId: row.id,
    actor,
    action: "created",
    revision: row.revision,
  });

  return toDto(row);
}

export async function patchTemplate(
  id: string,
  body: PatchTemplateBody,
  actor: AuthUser,
): Promise<EmailTemplateDto> {
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

  if (body.name !== undefined && !body.name.trim()) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Name cannot be empty.",
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

  const data: Prisma.EmailTemplateUpdateInput = {
    revision: existing.revision + 1,
  };

  if (body.name !== undefined) {
    data.name = body.name.trim();
  }
  if (body.label !== undefined) {
    data.label =
      body.label === null ? null : body.label.trim() || null;
  }
  if (body.subject !== undefined) {
    data.subject = body.subject;
  }
  if (body.editorData !== undefined) {
    data.editorData = body.editorData as Prisma.InputJsonValue;
  }
  if (body.legacyHtml !== undefined) {
    data.publishedHtml =
      body.legacyHtml === null ? null : body.legacyHtml.trim() || null;
  }

  const row = await prisma.emailTemplate.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    templateId: row.id,
    actor,
    action: "updated",
    revision: row.revision,
  });

  return toDto(row);
}

/**
 * One-time Brevo/legacy HTML → GrapesJS import components (stored as editorData).
 * Skips when editorData already present unless force=true.
 */
export async function convertTemplate(
  id: string,
  actor: AuthUser,
  opts: { force?: boolean; html?: string } = {},
): Promise<ConvertTemplateResultDto> {
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }

  const html = (opts.html ?? existing.publishedHtml ?? "").trim();
  if (!html) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Kein Legacy-HTML zum Konvertieren vorhanden.",
      400,
    );
  }

  if (
    !opts.force &&
    !needsConversion(existing.editorData as EditorProjectData, html)
  ) {
    return {
      template: toDto(existing),
      report: {
        coverage: 1,
        variables: { expected: 0, preserved: 0 },
        images: { expected: 0, preserved: 0 },
        links: { expected: 0, preserved: 0 },
        unknownBlocks: 0,
        warnings: ["Already converted — skipped"],
        autoApproved: true,
        textPreserved: true,
      },
    };
  }

  let result;
  try {
    result = convertBrevoHtml(html);
  } catch (err: unknown) {
    await prisma.emailTemplate.update({
      where: { id },
      data: {
        status: "IMPORT_FAILED",
        publishedHtml: html,
        revision: existing.revision + 1,
      },
    });
    throw new ServiceError(
      ERROR_CODES.IMPORT_FAILED,
      err instanceof Error ? err.message : "Konvertierung fehlgeschlagen.",
      422,
    );
  }

  const editorData: EditorProjectData = {
    __etsImport: 1,
    components: result.components,
    document: result.document,
    report: result.report,
  };

  const status = result.report.autoApproved ? existing.status : existing.status;
  // Keep DRAFT unless previously IMPORT_FAILED — clear failure on success
  const nextStatus =
    existing.status === "IMPORT_FAILED" ? "DRAFT" : status;

  const row = await prisma.emailTemplate.update({
    where: { id },
    data: {
      editorData: editorData as Prisma.InputJsonValue,
      publishedHtml: html,
      status: nextStatus,
      revision: existing.revision + 1,
    },
  });

  await writeAuditLog({
    templateId: row.id,
    actor,
    action: "updated",
    revision: row.revision,
  });

  return {
    template: toDto(row),
    report: result.report,
  };
}

export async function deleteTemplate(id: string): Promise<{ id: string }> {
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }

  await prisma.emailTemplate.delete({ where: { id } });
  return { id };
}

export async function getTemplateInsights(
  id: string,
): Promise<TemplateInsightsDto> {
  const row = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!row) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }

  const [logs, sendEvents] = await Promise.all([
    prisma.templateAuditLog.findMany({
      where: { templateId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.templateSendEvent.findMany({
      where: { templateId: id },
      orderBy: { sentAt: "desc" },
      take: 500,
    }),
  ]);

  return {
    templateId: row.id,
    templateName: row.name,
    logs: logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId,
      actorDisplayName: log.actorDisplayName,
      action: log.action as TemplateAuditAction,
      revision: log.revision,
      createdAt: log.createdAt.toISOString(),
    })),
    sendEvents: sendEvents.map((ev) => ({
      id: ev.id,
      recipientEmail: ev.recipientEmail,
      recipientName: ev.recipientName,
      sentAt: ev.sentAt.toISOString(),
      status: ev.status,
      source: ev.source,
    })),
    sendCount: sendEvents.length,
  };
}

export function buildSendEventsCsv(
  templateName: string,
  events: TemplateInsightsDto["sendEvents"],
): string {
  const header = [
    "template_name",
    "recipient_email",
    "recipient_name",
    "sent_at",
    "status",
    "source",
  ];
  const escape = (value: string): string => `"${value.replaceAll('"', '""')}"`;
  const lines = [
    header.join(","),
    ...events.map((ev) =>
      [
        escape(templateName),
        escape(ev.recipientEmail),
        escape(ev.recipientName ?? ""),
        escape(ev.sentAt),
        escape(ev.status),
        escape(ev.source),
      ].join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** Pure helper for unit tests without DB. */
export function assertRevisionMatch(
  current: number,
  expected: number,
): void {
  if (current !== expected) {
    throw new ServiceError(
      ERROR_CODES.REVISION_CONFLICT,
      "Template was changed elsewhere. Reload and try again.",
      409,
    );
  }
}
