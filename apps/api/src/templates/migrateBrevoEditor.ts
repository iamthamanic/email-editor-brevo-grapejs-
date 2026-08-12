/**
 * Explicit Brevo→editor recovery for outdated editorSchemaVersion.
 * Location: apps/api/src/templates/migrateBrevoEditor.ts
 *
 * Uses Brevo API GET by brevoTemplateId only — never published_html
 * (published_html is last editor/published HTML, not original Brevo).
 * Does not auto-publish / PUT to Brevo.
 */

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  CURRENT_CONVERSION_VERSION,
  CURRENT_EDITOR_SCHEMA_VERSION,
  ERROR_CODES,
  needsBrevoEditorMigration,
  type AuthUser,
  type EditorProjectData,
  type MigrateBrevoEditorResultDto,
  type TemplateConversionMeta,
} from "@email-template/email-schema";
import { convertBrevoHtml } from "@email-template/legacy-importer";
import { BrevoApiError, getSmtpTemplate } from "../brevo/client.js";
import { prisma } from "../db.js";
import { ServiceError, toDtoFromRow } from "./service.js";

const BACKUP_REASON = "pre_brevo_editor_migration";

/** Injectable Brevo GET — production uses getSmtpTemplate; tests mock this. */
export type BrevoTemplateFetcher = (brevoTemplateId: number) => Promise<{
  htmlContent?: string;
  modifiedAt?: string;
}>;

export interface MigrateBrevoEditorDeps {
  fetchBrevoTemplate?: BrevoTemplateFetcher;
}

function editorDataKeys(data: unknown): number {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return 0;
  }
  return Object.keys(data).length;
}

function htmlHash(html: string): string {
  return createHash("sha256").update(html).digest("hex").slice(0, 32);
}

function validateConverted(editorData: EditorProjectData): void {
  const components = editorData.components;
  if (!Array.isArray(components) || components.length === 0) {
    throw new ServiceError(
      ERROR_CODES.MIGRATION_FAILED,
      "Konvertierung lieferte keine Editor-Abschnitte.",
      422,
    );
  }
  const roles = components.map((c) => {
    if (!c || typeof c !== "object") return "";
    const row = c as Record<string, unknown>;
    const attrs = row.attributes as Record<string, string> | undefined;
    return (
      String(row.sectionRole ?? "") ||
      String(attrs?.["data-section-role"] ?? "") ||
      String(attrs?.["data-role"] ?? "")
    );
  });
  if (roles.some((r) => !r)) {
    throw new ServiceError(
      ERROR_CODES.MIGRATION_FAILED,
      "Konvertierung ohne vollständige Abschnittsrollen.",
      422,
    );
  }
}

export async function migrateBrevoEditor(
  id: string,
  actor: AuthUser,
  deps: MigrateBrevoEditorDeps = {},
): Promise<MigrateBrevoEditorResultDto> {
  const fetchBrevo =
    deps.fetchBrevoTemplate ??
    (async (brevoTemplateId: number) => getSmtpTemplate(brevoTemplateId));

  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError(ERROR_CODES.NOT_FOUND, "Template not found.", 404);
  }

  const brevoId = existing.brevoTemplateId;
  if (brevoId == null) {
    throw new ServiceError(
      ERROR_CODES.VALIDATION,
      "Kein Brevo-Template verknüpft — automatische Aktualisierung nicht möglich.",
      400,
    );
  }

  const hasEditorData = editorDataKeys(existing.editorData) > 0;
  const metaRaw = existing.conversionMeta;
  const conversionVersion =
    metaRaw &&
    typeof metaRaw === "object" &&
    !Array.isArray(metaRaw) &&
    typeof (metaRaw as { conversionVersion?: unknown }).conversionVersion ===
      "number"
      ? (metaRaw as { conversionVersion: number }).conversionVersion
      : null;
  const required = needsBrevoEditorMigration({
    brevoTemplateId: brevoId.toString(),
    editorSchemaVersion: existing.editorSchemaVersion,
    conversionVersion,
    hasEditorData,
  });

  if (!required) {
    return {
      template: toDtoFromRow(existing),
      migrated: false,
      backupVersionId: null,
      report: {
        coverage: 1,
        variables: { expected: 0, preserved: 0 },
        images: { expected: 0, preserved: 0 },
        links: { expected: 0, preserved: 0 },
        unknownBlocks: 0,
        warnings: ["Editor-Schema bereits aktuell — übersprungen"],
        autoApproved: true,
        textPreserved: true,
      },
    };
  }

  let remote;
  try {
    remote = await fetchBrevo(Number(brevoId));
  } catch (err) {
    if (err instanceof BrevoApiError) {
      throw new ServiceError(
        ERROR_CODES.MIGRATION_FAILED,
        `Brevo-Abruf fehlgeschlagen: ${err.message}`,
        err.httpStatus >= 400 && err.httpStatus < 600 ? err.httpStatus : 502,
      );
    }
    throw err;
  }

  const html = remote.htmlContent?.trim() ?? "";
  if (!html) {
    throw new ServiceError(
      ERROR_CODES.MIGRATION_FAILED,
      "Brevo-Template enthält keinen HTML-Inhalt.",
      422,
    );
  }

  let converted;
  try {
    converted = convertBrevoHtml(html);
  } catch (err: unknown) {
    // Keep old editorData — do not write
    throw new ServiceError(
      ERROR_CODES.MIGRATION_FAILED,
      err instanceof Error
        ? `Konvertierung fehlgeschlagen: ${err.message}`
        : "Konvertierung fehlgeschlagen.",
      422,
    );
  }

  const editorData: EditorProjectData = {
    __etsImport: 1,
    components: converted.components,
    document: converted.document,
    report: converted.report,
  };

  try {
    validateConverted(editorData);
  } catch (err) {
    // Keep old editorData
    throw err;
  }

  const meta: TemplateConversionMeta = {
    editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
    conversionVersion: CURRENT_CONVERSION_VERSION,
    conversionSource: "brevo",
    sourceBrevoModifiedAt: remote.modifiedAt ?? null,
    sourceHtmlHash: htmlHash(html),
    migratedAt: new Date().toISOString(),
  };

  const backup = await prisma.templateVersion.create({
    data: {
      templateId: existing.id,
      revision: existing.revision,
      editorData: existing.editorData as Prisma.InputJsonValue,
      reason: BACKUP_REASON,
    },
  });

  try {
    const row = await prisma.emailTemplate.update({
      where: { id: existing.id },
      data: {
        editorData: editorData as Prisma.InputJsonValue,
        // Refresh stored Brevo HTML for reference; published_html is still not SoT for recovery
        publishedHtml: html,
        editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
        conversionMeta: meta as unknown as Prisma.InputJsonValue,
        brevoModifiedAt: remote.modifiedAt
          ? new Date(remote.modifiedAt)
          : existing.brevoModifiedAt,
        lastSyncedAt: new Date(),
        status:
          existing.status === "IMPORT_FAILED" ? "DRAFT" : existing.status,
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
      template: toDtoFromRow(row),
      migrated: true,
      backupVersionId: backup.id,
      report: converted.report,
    };
  } catch (err) {
    throw new ServiceError(
      ERROR_CODES.MIGRATION_FAILED,
      err instanceof Error
        ? `Speichern der Migration fehlgeschlagen: ${err.message}`
        : "Speichern der Migration fehlgeschlagen.",
      500,
    );
  }
}
