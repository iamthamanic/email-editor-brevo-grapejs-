/**
 * Pull Brevo transactional templates into local Postgres (upsert by brevoTemplateId).
 * Preserves dirty local editorData (CONFLICT + pendingRemote) — no last-write-wins.
 * Location: apps/api/src/templates/brevoSync.ts
 */

import { Prisma } from "@prisma/client";
import {
  CURRENT_CONVERSION_VERSION,
  CURRENT_EDITOR_SCHEMA_VERSION,
  EMPTY_EDITOR_DATA,
  ERROR_CODES,
  type EditorProjectData,
  type TemplateConversionMeta,
} from "@email-template/email-schema";
import {
  BrevoApiError,
  listAllSmtpTemplates,
  withHtmlContent,
} from "../brevo/client.js";
import { harvestFromEditorData } from "../saved-sections/service.js";
import { prisma } from "../db.js";
import { toImportEditorData } from "./brevoImport.js";
import { ServiceError } from "./service.js";
import {
  buildPendingRemote,
  hashHtml,
  mustStashRemoteOnDiff,
  withPendingRemote,
} from "./syncConflict.js";

export interface BrevoSyncResult {
  fetched: number;
  created: number;
  updated: number;
  converted: number;
  skipped: number;
  conflicts: number;
  textbausteineCreated: number;
  errors: Array<{ brevoId: number; message: string }>;
}

function syncMeta(htmlHash?: string): TemplateConversionMeta {
  return {
    editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
    conversionVersion: CURRENT_CONVERSION_VERSION,
    conversionSource: "brevo",
    migratedAt: new Date().toISOString(),
    sourceHtmlHash: htmlHash ?? null,
    pendingRemote: null,
  };
}

async function harvestSafe(
  editorData: EditorProjectData,
  result: BrevoSyncResult,
  brevoId: number,
): Promise<void> {
  try {
    const harvested = await harvestFromEditorData(editorData);
    result.textbausteineCreated += harvested.created;
  } catch (harvestErr) {
    result.errors.push({
      brevoId,
      message:
        harvestErr instanceof Error
          ? `Textbausteine: ${harvestErr.message}`
          : "Textbausteine-Harvest fehlgeschlagen",
    });
  }
}

export async function syncTemplatesFromBrevo(): Promise<BrevoSyncResult> {
  let remote;
  try {
    remote = await listAllSmtpTemplates();
  } catch (err) {
    if (err instanceof BrevoApiError) {
      throw new ServiceError(ERROR_CODES.VALIDATION, err.message, err.httpStatus);
    }
    throw err;
  }

  const result: BrevoSyncResult = {
    fetched: remote.length,
    created: 0,
    updated: 0,
    converted: 0,
    skipped: 0,
    conflicts: 0,
    textbausteineCreated: 0,
    errors: [],
  };

  for (const item of remote) {
    try {
      const full = await withHtmlContent(item);
      const html = full.htmlContent?.trim() ?? "";
      if (!html) {
        result.skipped += 1;
        result.errors.push({
          brevoId: full.id,
          message: "Kein HTML-Inhalt",
        });
        continue;
      }

      const brevoId = BigInt(full.id);
      const existing = await prisma.emailTemplate.findUnique({
        where: { brevoTemplateId: brevoId },
      });

      const senderName = full.sender?.name?.trim() || null;
      const senderEmail = full.sender?.email?.trim() || null;
      const replyTo = full.replyTo?.trim() || null;
      const name = full.name?.trim() || `Brevo #${full.id}`;
      const subject = full.subject?.trim() || null;
      const label = full.tag?.trim() || null;
      const now = new Date();
      const remoteHash = hashHtml(html);

      if (!existing) {
        const converted = toImportEditorData(html);
        if (!converted.ok) {
          result.errors.push({
            brevoId: full.id,
            message: `Convert: ${converted.message}`,
          });
        }
        const editorData = converted.ok
          ? converted.editorData
          : (EMPTY_EDITOR_DATA as EditorProjectData);
        await prisma.emailTemplate.create({
          data: {
            brevoTemplateId: brevoId,
            name,
            label,
            subject,
            senderName,
            senderEmail,
            replyTo,
            status: converted.ok ? "DRAFT" : "IMPORT_FAILED",
            source: "BREVO",
            editorData: editorData as Prisma.InputJsonValue,
            publishedHtml: html,
            editorSchemaVersion: converted.ok
              ? CURRENT_EDITOR_SCHEMA_VERSION
              : 0,
            conversionMeta: converted.ok
              ? (syncMeta(remoteHash) as unknown as Prisma.InputJsonValue)
              : undefined,
            lastSyncedAt: now,
            revision: 1,
          },
        });
        result.created += 1;
        if (converted.ok) {
          result.converted += 1;
          await harvestSafe(editorData, result, full.id);
        } else {
          result.skipped += 1;
        }
        continue;
      }

      const localHtml = existing.publishedHtml?.trim() ?? "";
      const remoteUnchanged = localHtml.length > 0 && hashHtml(localHtml) === remoteHash;

      if (remoteUnchanged) {
        // Metadata-only refresh; keep editor + clear stale conflict if HTML matches
        const clearConflict =
          existing.status === "CONFLICT" || existing.status === "REMOTE_CHANGED";
        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: {
            name,
            label: label ?? existing.label,
            subject,
            senderName,
            senderEmail,
            replyTo,
            lastSyncedAt: now,
            ...(clearConflict
              ? {
                  status:
                    existing.publishedAt != null ? "PUBLISHED" : "DRAFT",
                  conversionMeta: withPendingRemote(
                    syncMeta(remoteHash),
                    null,
                  ) as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
        result.updated += 1;
        continue;
      }

      // Remote HTML differs from last known publishedHtml
      if (mustStashRemoteOnDiff(existing)) {
        const pending = buildPendingRemote({
          html,
          name,
          subject,
          senderName,
          senderEmail,
          replyTo,
          label: label ?? existing.label,
        });
        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: {
            // Keep editorData / publishedHtml — stash remote for resolve
            lastSyncedAt: now,
            status: "CONFLICT",
            conversionMeta: withPendingRemote(
              syncMeta(remoteHash),
              pending,
            ) as unknown as Prisma.InputJsonValue,
            revision: existing.revision + 1,
          },
        });
        result.conflicts += 1;
        result.updated += 1;
        continue;
      }

      const converted = toImportEditorData(html);
      if (!converted.ok) {
        result.errors.push({
          brevoId: full.id,
          message: `Convert: ${converted.message}`,
        });
        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: {
            name,
            label: label ?? existing.label,
            subject,
            senderName,
            senderEmail,
            replyTo,
            publishedHtml: html,
            lastSyncedAt: now,
            status: "IMPORT_FAILED",
            revision: existing.revision + 1,
          },
        });
        result.updated += 1;
        result.skipped += 1;
        continue;
      }

      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          name,
          label: label ?? existing.label,
          subject,
          senderName,
          senderEmail,
          replyTo,
          publishedHtml: html,
          editorData: converted.editorData as Prisma.InputJsonValue,
          editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
          conversionMeta: syncMeta(remoteHash) as unknown as Prisma.InputJsonValue,
          source: "BREVO",
          lastSyncedAt: now,
          status:
            existing.status === "IMPORT_FAILED" ||
            existing.status === "CONFLICT" ||
            existing.status === "REMOTE_CHANGED"
              ? "DRAFT"
              : existing.status,
          revision: existing.revision + 1,
        },
      });
      result.updated += 1;
      result.converted += 1;
      await harvestSafe(converted.editorData, result, full.id);
    } catch (err) {
      result.errors.push({
        brevoId: item.id,
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
      result.skipped += 1;
    }
  }

  return result;
}
