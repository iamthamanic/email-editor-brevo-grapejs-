/**
 * One-shot / batch migration: legacy #TOKEN# → {{ params.* }}.
 * Location: apps/api/src/templates/migrateLegacyHashes.ts
 *
 * Updates subject, publishedHtml, editorData. Pages-format editor projects
 * with hashes are re-converted from publishedHtml so canvas gets param badges.
 * Does not publish to Brevo.
 */

import type { Prisma } from "@prisma/client";
import {
  CURRENT_CONVERSION_VERSION,
  CURRENT_EDITOR_SCHEMA_VERSION,
  ERROR_CODES,
  type AuthUser,
  type EditorProjectData,
  type TemplateConversionMeta,
} from "@email-template/email-schema";
import {
  hasLegacyHashTokens,
  replaceLegacyHashTokens,
  replaceLegacyHashTokensDeep,
} from "@email-template/email-variables";
import { convertBrevoHtml } from "@email-template/legacy-importer";
import { prisma } from "../db.js";
import { ServiceError } from "./service.js";

const BACKUP_REASON = "pre_legacy_hash_migration";

export interface MigrateLegacyHashesItem {
  id: string;
  brevoTemplateId: number | null;
  name: string;
  fields: string[];
  reconverted: boolean;
}

export interface MigrateLegacyHashesResult {
  scanned: number;
  migrated: number;
  skipped: number;
  items: MigrateLegacyHashesItem[];
}

function blobHasLegacyHashes(
  subject: string | null,
  publishedHtml: string | null,
  editorData: unknown,
): boolean {
  if (subject && hasLegacyHashTokens(subject)) return true;
  if (publishedHtml && hasLegacyHashTokens(publishedHtml)) return true;
  if (editorData != null) {
    return hasLegacyHashTokens(JSON.stringify(editorData));
  }
  return false;
}

function isPagesFormat(editorData: unknown): boolean {
  return (
    typeof editorData === "object" &&
    editorData !== null &&
    !Array.isArray(editorData) &&
    Array.isArray((editorData as { pages?: unknown }).pages)
  );
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function migrateOne(
  id: string,
  actor: AuthUser,
): Promise<MigrateLegacyHashesItem | null> {
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }

  if (
    !blobHasLegacyHashes(
      existing.subject,
      existing.publishedHtml,
      existing.editorData,
    )
  ) {
    return null;
  }

  const fields: string[] = [];
  const nextSubject = existing.subject
    ? replaceLegacyHashTokens(existing.subject)
    : existing.subject;
  const nextHtml = existing.publishedHtml
    ? replaceLegacyHashTokens(existing.publishedHtml)
    : existing.publishedHtml;

  if (nextSubject !== existing.subject) fields.push("subject");
  if (nextHtml !== existing.publishedHtml) fields.push("publishedHtml");

  let nextEditor: EditorProjectData = replaceLegacyHashTokensDeep(
    (existing.editorData ?? {}) as EditorProjectData,
  );
  const editorChanged = !jsonEqual(nextEditor, existing.editorData);
  if (editorChanged) fields.push("editorData");

  const hadPagesHashes =
    isPagesFormat(existing.editorData) &&
    hasLegacyHashTokens(JSON.stringify(existing.editorData));

  let reconverted = false;
  if (hadPagesHashes && nextHtml?.trim()) {
    try {
      const converted = convertBrevoHtml(nextHtml);
      nextEditor = {
        __etsImport: 1,
        components: converted.components,
        document: converted.document,
        report: converted.report,
      };
      reconverted = true;
      if (!fields.includes("editorData")) fields.push("editorData");
    } catch (err: unknown) {
      // Keep deep-replaced editorData — do not fail the whole batch
      console.warn(
        "[migrate-legacy-hashes] reconvert failed for",
        id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (fields.length === 0) return null;

  await prisma.templateVersion.create({
    data: {
      templateId: existing.id,
      revision: existing.revision,
      editorData: existing.editorData as Prisma.InputJsonValue,
      reason: BACKUP_REASON,
    },
  });

  const meta: TemplateConversionMeta | null = reconverted
    ? {
        editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
        conversionVersion: CURRENT_CONVERSION_VERSION,
        conversionSource: "html",
        migratedAt: new Date().toISOString(),
      }
    : null;

  const row = await prisma.emailTemplate.update({
    where: { id: existing.id },
    data: {
      subject: nextSubject,
      publishedHtml: nextHtml,
      editorData: nextEditor as Prisma.InputJsonValue,
      ...(reconverted
        ? {
            editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
            conversionMeta: meta as unknown as Prisma.InputJsonValue,
          }
        : {}),
      revision: existing.revision + 1,
    },
  });

  await prisma.templateAuditLog.create({
    data: {
      templateId: row.id,
      actorUserId: actor.id,
      actorDisplayName: actor.displayName,
      action: "updated",
      revision: row.revision,
    },
  });

  return {
    id: row.id,
    brevoTemplateId:
      row.brevoTemplateId == null ? null : Number(row.brevoTemplateId),
    name: row.name,
    fields,
    reconverted,
  };
}

/**
 * Migrate templates that still contain known legacy hash tokens.
 * Idempotent: second run reports migrated: 0.
 * Pass `ids` to limit scope (tests / single-template ops).
 */
export async function migrateLegacyHashes(
  actor: AuthUser,
  options: { ids?: string[] } = {},
): Promise<MigrateLegacyHashesResult> {
  const rows = await prisma.emailTemplate.findMany({
    where: options.ids?.length ? { id: { in: options.ids } } : undefined,
    select: {
      id: true,
      subject: true,
      publishedHtml: true,
      editorData: true,
    },
  });

  const candidates = rows.filter((r) =>
    blobHasLegacyHashes(r.subject, r.publishedHtml, r.editorData),
  );

  const items: MigrateLegacyHashesItem[] = [];
  for (const row of candidates) {
    const item = await migrateOne(row.id, actor);
    if (item) items.push(item);
  }

  return {
    scanned: rows.length,
    migrated: items.length,
    skipped: rows.length - items.length,
    items,
  };
}
