/**
 * Template domain service — hides revision concurrency and Prisma mapping.
 * Location: apps/api/src/templates/service.ts
 */

import type { EmailTemplate, Prisma } from "@prisma/client";
import {
  CURRENT_CONVERSION_VERSION,
  CURRENT_EDITOR_SCHEMA_VERSION,
  EMPTY_EDITOR_DATA,
  ERROR_CODES,
  needsBrevoEditorMigration,
  type AuthUser,
  type ConversionStatus,
  type ConvertTemplateResultDto,
  type CreateTemplateBody,
  type EditorProjectData,
  type EmailTemplateDto,
  type EmailTemplateListItem,
  type PatchTemplateBody,
  type TemplateAuditAction,
  type TemplateConversionMeta,
  type TemplateInsightsDto,
  type TemplateSource,
  type TemplateStatus,
} from "@email-template/email-schema";
import {
  convertBrevoHtml,
  needsConversion,
} from "@email-template/legacy-importer";
import { coalesceBrokenParamHtmlDeep } from "@email-template/email-variables";
import { assertVerifiedSenderEmail } from "../brevo/senderAllowlist.js";
import { SenderAllowlistError } from "../brevo/senderAllowlist.js";
import { prisma } from "../db.js";
import { toImportEditorData } from "./brevoImport.js";
import { withPendingRemote } from "./syncConflict.js";

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

function parseConversionMeta(raw: unknown): TemplateConversionMeta | null {
  if (!isPlainObject(raw)) return null;
  const version = raw.editorSchemaVersion;
  const conversionVersion = raw.conversionVersion;
  if (typeof version !== "number" || typeof conversionVersion !== "number") {
    return null;
  }
  const source = raw.conversionSource;
  if (
    source !== "brevo" &&
    source !== "html" &&
    source !== "local" &&
    source !== "unknown"
  ) {
    return null;
  }
  return {
    editorSchemaVersion: version,
    conversionVersion,
    conversionSource: source,
    sourceBrevoModifiedAt:
      typeof raw.sourceBrevoModifiedAt === "string" ||
      raw.sourceBrevoModifiedAt === null
        ? (raw.sourceBrevoModifiedAt as string | null)
        : undefined,
    sourceHtmlHash:
      typeof raw.sourceHtmlHash === "string" || raw.sourceHtmlHash === null
        ? (raw.sourceHtmlHash as string | null)
        : undefined,
    migratedAt:
      typeof raw.migratedAt === "string" || raw.migratedAt === null
        ? (raw.migratedAt as string | null)
        : undefined,
    pendingRemote: parsePendingRemoteField(raw.pendingRemote),
  };
}

function parsePendingRemoteField(
  raw: unknown,
): TemplateConversionMeta["pendingRemote"] {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.html !== "string" || typeof o.htmlHash !== "string") {
    return undefined;
  }
  if (typeof o.name !== "string" || typeof o.fetchedAt !== "string") {
    return undefined;
  }
  return {
    html: o.html,
    name: o.name,
    subject:
      typeof o.subject === "string" || o.subject === null ? o.subject : null,
    senderName:
      typeof o.senderName === "string" || o.senderName === null
        ? o.senderName
        : null,
    senderEmail:
      typeof o.senderEmail === "string" || o.senderEmail === null
        ? o.senderEmail
        : null,
    replyTo:
      typeof o.replyTo === "string" || o.replyTo === null ? o.replyTo : null,
    label: typeof o.label === "string" || o.label === null ? o.label : null,
    fetchedAt: o.fetchedAt,
    htmlHash: o.htmlHash,
  };
}

function currentConversionMeta(
  source: TemplateConversionMeta["conversionSource"],
): TemplateConversionMeta {
  return {
    editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
    conversionVersion: CURRENT_CONVERSION_VERSION,
    conversionSource: source,
    migratedAt: new Date().toISOString(),
  };
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

/** Shared DTO mapper (also used by Brevo migration). */
export function toDtoFromRow(row: EmailTemplate): EmailTemplateDto {
  const brevoTemplateId = row.brevoTemplateId?.toString() ?? null;
  const hasEditorData = editorDataKeys(row.editorData) > 0;
  return {
    id: row.id,
    brevoTemplateId,
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
    editorSchemaVersion: row.editorSchemaVersion ?? 0,
    conversionMeta: parseConversionMeta(row.conversionMeta),
    migrationRequired: needsBrevoEditorMigration({
      brevoTemplateId,
      editorSchemaVersion: row.editorSchemaVersion,
      conversionVersion: parseConversionMeta(row.conversionMeta)?.conversionVersion,
      hasEditorData,
    }),
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function toDto(row: EmailTemplate): EmailTemplateDto {
  return toDtoFromRow(row);
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
    createdAt: row.createdAt.toISOString(),
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

/** Leading `(Kopie…)` prefix — used for list pin + re-duplicate base name. */
const COPY_NAME_PREFIX_RE = /^\(Kopie(?:\s+[^)]*)?\)\s*/i;

export function isDuplicateTemplateName(name: string): boolean {
  const trimmed = name.trim();
  return /^\(Kopie\b/i.test(trimmed) || /\(Kopie\)\s*$/i.test(trimmed);
}

/** German stamp for copy name, e.g. `09.08.2026, 20:52:33`. */
export function formatDuplicateStamp(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(at);
}

/** Copy local editor project; no Brevo link. Name: `(Kopie …) Original`. */
export function duplicateTemplateName(
  name: string,
  at: Date = new Date(),
): string {
  const base = name.replace(COPY_NAME_PREFIX_RE, "").trim() || "Template";
  return `(Kopie ${formatDuplicateStamp(at)}) ${base}`;
}

function compareTemplateListItems(
  a: EmailTemplateListItem,
  b: EmailTemplateListItem,
): number {
  const aCopy = isDuplicateTemplateName(a.name);
  const bCopy = isDuplicateTemplateName(b.name);
  if (aCopy !== bCopy) return aCopy ? -1 : 1;
  if (aCopy && bCopy) {
    return b.createdAt.localeCompare(a.createdAt);
  }
  return b.updatedAt.localeCompare(a.updatedAt);
}

export async function listTemplates(): Promise<EmailTemplateListItem[]> {
  const rows = await prisma.emailTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toListItem).sort(compareTemplateListItems);
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
    editorData = coalesceBrokenParamHtmlDeep(
      body.editorData,
    ) as EditorProjectData;
  }

  const label =
    body.label === undefined || body.label === null
      ? null
      : body.label.trim() || null;

  const senderEmail =
    body.senderEmail === undefined || body.senderEmail === null
      ? null
      : body.senderEmail.trim().toLowerCase() || null;
  if (senderEmail) {
    try {
      await assertVerifiedSenderEmail(senderEmail);
    } catch (err) {
      if (err instanceof SenderAllowlistError) {
        throw new ServiceError(err.code, err.message, err.httpStatus);
      }
      throw err;
    }
  }
  const senderName =
    body.senderName === undefined || body.senderName === null
      ? null
      : body.senderName.trim() || null;

  const row = await prisma.emailTemplate.create({
    data: {
      name,
      label,
      subject: body.subject ?? null,
      senderEmail,
      senderName,
      editorData: editorData as Prisma.InputJsonValue,
      publishedHtml: body.legacyHtml?.trim() || null,
      status: "DRAFT",
      source: body.legacyHtml?.trim() ? "BREVO" : "LOCAL",
      editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
      conversionMeta: currentConversionMeta(
        body.legacyHtml?.trim() ? "html" : "local",
      ) as unknown as Prisma.InputJsonValue,
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
  if (body.senderEmail !== undefined) {
    const next =
      body.senderEmail === null
        ? null
        : body.senderEmail.trim().toLowerCase() || null;
    if (next) {
      try {
        await assertVerifiedSenderEmail(next);
      } catch (err) {
        if (err instanceof SenderAllowlistError) {
          throw new ServiceError(err.code, err.message, err.httpStatus);
        }
        throw err;
      }
    }
    data.senderEmail = next;
  }
  if (body.senderName !== undefined) {
    data.senderName =
      body.senderName === null ? null : body.senderName.trim() || null;
  }
  if (body.editorData !== undefined) {
    data.editorData = coalesceBrokenParamHtmlDeep(
      body.editorData,
    ) as Prisma.InputJsonValue;
  }
  if (body.legacyHtml !== undefined) {
    data.publishedHtml =
      body.legacyHtml === null ? null : body.legacyHtml.trim() || null;
  }

  // Canvas schema bump: snapshot pre-migration editorData once.
  const SCHEMA_MIGRATION_REASON = "schema-migration";
  if (
    body.editorData !== undefined &&
    (existing.editorSchemaVersion ?? 0) < CURRENT_EDITOR_SCHEMA_VERSION
  ) {
    await prisma.templateVersion.create({
      data: {
        templateId: existing.id,
        revision: existing.revision,
        editorData: existing.editorData as Prisma.InputJsonValue,
        reason: SCHEMA_MIGRATION_REASON,
      },
    });
    data.editorSchemaVersion = CURRENT_EDITOR_SCHEMA_VERSION;
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
    components: coalesceBrokenParamHtmlDeep(
      result.components,
    ) as EditorProjectData["components"],
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
      editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
      conversionMeta: currentConversionMeta(
        existing.brevoTemplateId ? "brevo" : "html",
      ) as unknown as Prisma.InputJsonValue,
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

export async function duplicateTemplate(
  id: string,
  actor: AuthUser,
): Promise<EmailTemplateDto> {
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }

  if (existing.senderEmail) {
    try {
      await assertVerifiedSenderEmail(existing.senderEmail);
    } catch (err) {
      if (err instanceof SenderAllowlistError) {
        throw new ServiceError(err.code, err.message, err.httpStatus);
      }
      throw err;
    }
  }

  const editorData = coalesceBrokenParamHtmlDeep(
    existing.editorData,
  ) as Prisma.InputJsonValue;

  const copiedAt = new Date();
  const row = await prisma.emailTemplate.create({
    data: {
      name: duplicateTemplateName(existing.name, copiedAt),
      label: existing.label,
      subject: existing.subject,
      senderEmail: existing.senderEmail,
      senderName: existing.senderName,
      replyTo: existing.replyTo,
      editorData,
      publishedHtml: existing.publishedHtml,
      status: "DRAFT",
      source: "LOCAL",
      editorSchemaVersion: existing.editorSchemaVersion,
      conversionMeta:
        existing.conversionMeta === null
          ? undefined
          : (existing.conversionMeta as Prisma.InputJsonValue),
      revision: 1,
      createdAt: copiedAt,
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

/**
 * Resolve CONFLICT / REMOTE_CHANGED: accept Brevo pending HTML or keep local draft.
 */
export async function resolveSyncConflict(
  id: string,
  body: { action: "accept_remote" | "keep_local"; expectedRevision: number },
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
  if (body.action !== "accept_remote" && body.action !== "keep_local") {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "action must be accept_remote or keep_local.",
      400,
    );
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }
  assertRevisionMatch(existing.revision, body.expectedRevision);

  if (
    existing.status !== "CONFLICT" &&
    existing.status !== "REMOTE_CHANGED"
  ) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Template hat keinen Sync-Konflikt.",
      400,
    );
  }

  const meta = parseConversionMeta(existing.conversionMeta);
  const pending = meta?.pendingRemote ?? null;

  if (body.action === "keep_local") {
    const row = await prisma.emailTemplate.update({
      where: { id },
      data: {
        status: "DRAFT",
        conversionMeta: withPendingRemote(
          meta ?? currentConversionMeta("brevo"),
          null,
        ) as unknown as Prisma.InputJsonValue,
        revision: existing.revision + 1,
      },
    });
    return toDto(row);
  }

  // accept_remote
  if (!pending?.html?.trim()) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Kein ausstehendes Remote-HTML. Bitte erneut von Brevo laden.",
      400,
    );
  }

  const converted = toImportEditorData(pending.html);
  if (!converted.ok) {
    throw new ServiceError(
      ERROR_CODES.IMPORT_FAILED,
      converted.message,
      422,
    );
  }

  const row = await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: pending.name || existing.name,
      label: pending.label ?? existing.label,
      subject: pending.subject,
      senderName: pending.senderName,
      senderEmail: pending.senderEmail,
      replyTo: pending.replyTo,
      publishedHtml: pending.html,
      editorData: converted.editorData as Prisma.InputJsonValue,
      editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
      conversionMeta: withPendingRemote(
        currentConversionMeta("brevo"),
        null,
      ) as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
      source: "BREVO",
      lastSyncedAt: new Date(),
      revision: existing.revision + 1,
    },
  });
  return toDto(row);
}

