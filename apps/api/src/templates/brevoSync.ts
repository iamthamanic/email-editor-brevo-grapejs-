/**
 * Pull Brevo transactional templates into local Postgres (upsert by brevoTemplateId).
 * Always force-converts HTML → Grapes editorData so Visual tree matches current importer.
 * Location: apps/api/src/templates/brevoSync.ts
 */

import { Prisma } from "@prisma/client";
import {
  EMPTY_EDITOR_DATA,
  ERROR_CODES,
  type EditorProjectData,
} from "@email-template/email-schema";
import { convertBrevoHtml } from "@email-template/legacy-importer";
import {
  BrevoApiError,
  listAllSmtpTemplates,
  withHtmlContent,
} from "../brevo/client.js";
import { prisma } from "../db.js";
import { ServiceError } from "./service.js";

export interface BrevoSyncResult {
  fetched: number;
  created: number;
  updated: number;
  converted: number;
  skipped: number;
  errors: Array<{ brevoId: number; message: string }>;
}

function toImportEditorData(html: string): {
  editorData: EditorProjectData;
  ok: true;
} | { ok: false; message: string } {
  try {
    const result = convertBrevoHtml(html);
    return {
      ok: true,
      editorData: {
        __etsImport: 1,
        components: result.components,
        document: result.document,
        report: result.report,
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Konvertierung fehlgeschlagen",
    };
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
      const status = converted.ok ? "DRAFT" : "IMPORT_FAILED";

      if (existing) {
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
            editorData: editorData as Prisma.InputJsonValue,
            source: "BREVO",
            lastSyncedAt: now,
            status: converted.ok
              ? existing.status === "IMPORT_FAILED"
                ? "DRAFT"
                : existing.status
              : "IMPORT_FAILED",
            revision: existing.revision + 1,
          },
        });
        result.updated += 1;
      } else {
        await prisma.emailTemplate.create({
          data: {
            brevoTemplateId: brevoId,
            name,
            label,
            subject,
            senderName,
            senderEmail,
            replyTo,
            status,
            source: "BREVO",
            editorData: editorData as Prisma.InputJsonValue,
            publishedHtml: html,
            lastSyncedAt: now,
            revision: 1,
          },
        });
        result.created += 1;
      }

      if (converted.ok) {
        result.converted += 1;
      } else {
        result.skipped += 1;
      }
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
