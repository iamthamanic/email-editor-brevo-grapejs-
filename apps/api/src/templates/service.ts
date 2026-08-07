/**
 * Template domain service — hides revision concurrency and Prisma mapping.
 * Location: apps/api/src/templates/service.ts
 */

import type { EmailTemplate, Prisma } from "@prisma/client";
import {
  EMPTY_EDITOR_DATA,
  ERROR_CODES,
  type CreateTemplateBody,
  type EditorProjectData,
  type EmailTemplateDto,
  type EmailTemplateListItem,
  type PatchTemplateBody,
  type TemplateSource,
  type TemplateStatus,
} from "@email-template/email-schema";
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

function toDto(row: EmailTemplate): EmailTemplateDto {
  return {
    id: row.id,
    brevoTemplateId: row.brevoTemplateId?.toString() ?? null,
    name: row.name,
    subject: row.subject,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    replyTo: row.replyTo,
    status: row.status as TemplateStatus,
    source: row.source as TemplateSource,
    editorData: row.editorData as EditorProjectData,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function toListItem(row: EmailTemplate): EmailTemplateListItem {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    status: row.status as TemplateStatus,
    source: row.source as TemplateSource,
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  };
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

  const row = await prisma.emailTemplate.create({
    data: {
      name,
      subject: body.subject ?? null,
      editorData: editorData as Prisma.InputJsonValue,
      status: "DRAFT",
      source: "LOCAL",
      revision: 1,
    },
  });

  return toDto(row);
}

export async function patchTemplate(
  id: string,
  body: PatchTemplateBody,
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
  if (body.subject !== undefined) {
    data.subject = body.subject;
  }
  if (body.editorData !== undefined) {
    data.editorData = body.editorData as Prisma.InputJsonValue;
  }

  const row = await prisma.emailTemplate.update({
    where: { id },
    data,
  });

  return toDto(row);
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
