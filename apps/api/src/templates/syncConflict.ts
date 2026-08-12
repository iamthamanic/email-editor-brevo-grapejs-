/**
 * Sync conflict helpers — dirty detection + pending remote stash.
 * Location: apps/api/src/templates/syncConflict.ts
 */

import { createHash } from "node:crypto";
import type { EmailTemplate } from "@prisma/client";
import type {
  PendingRemoteSync,
  TemplateConversionMeta,
} from "@email-template/email-schema";

const DIRTY_SLACK_MS = 1500;

export function hashHtml(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

function editorDataKeys(data: unknown): number {
  if (!data || typeof data !== "object" || Array.isArray(data)) return 0;
  return Object.keys(data).length;
}

/**
 * Local draft diverged from last publish/sync snapshot.
 * // ponytail: timestamp heuristic; content-hash vs published snapshot if false positives appear
 */
export function isLocallyDirty(row: EmailTemplate): boolean {
  const updated = row.updatedAt.getTime();
  if (row.publishedAt) {
    return updated > row.publishedAt.getTime() + DIRTY_SLACK_MS;
  }
  if (row.lastSyncedAt) {
    return updated > row.lastSyncedAt.getTime() + DIRTY_SLACK_MS;
  }
  return editorDataKeys(row.editorData) > 0;
}

/**
 * Keep local editorData and stash remote when HTML differs.
 * CONFLICT/REMOTE_CHANGED must never fall through to auto-accept remote
 * (lastSyncedAt update can make isLocallyDirty false after first conflict).
 */
export function mustStashRemoteOnDiff(row: EmailTemplate): boolean {
  return (
    isLocallyDirty(row) ||
    row.status === "CONFLICT" ||
    row.status === "REMOTE_CHANGED"
  );
}

export function parsePendingRemote(raw: unknown): PendingRemoteSync | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.html !== "string" || !o.html.trim()) return null;
  if (typeof o.name !== "string" || typeof o.fetchedAt !== "string") return null;
  if (typeof o.htmlHash !== "string") return null;
  return {
    html: o.html,
    name: o.name,
    subject: typeof o.subject === "string" || o.subject === null ? o.subject : null,
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

export function withPendingRemote(
  meta: TemplateConversionMeta | null,
  pending: PendingRemoteSync | null,
): TemplateConversionMeta {
  const base: TemplateConversionMeta = meta ?? {
    editorSchemaVersion: 0,
    conversionVersion: 0,
    conversionSource: "brevo",
  };
  return { ...base, pendingRemote: pending };
}

export function buildPendingRemote(input: {
  html: string;
  name: string;
  subject: string | null;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  label: string | null;
}): PendingRemoteSync {
  return {
    html: input.html,
    name: input.name,
    subject: input.subject,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    replyTo: input.replyTo,
    label: input.label,
    fetchedAt: new Date().toISOString(),
    htmlHash: hashHtml(input.html),
  };
}
