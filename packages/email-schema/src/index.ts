/**
 * Shared API/DTO types for email template service.
 * Location: packages/email-schema — single wire-format source for editor + API.
 */

import type {
  ConversionSource,
  PendingRemoteSync,
  TemplateConversionMeta,
} from "./editorSchema.js";
export type { ConversionSource, PendingRemoteSync, TemplateConversionMeta };
export {
  CURRENT_CONVERSION_VERSION,
  CURRENT_EDITOR_SCHEMA_VERSION,
  isEditorSchemaCurrent,
  isConversionCurrent,
  needsBrevoEditorMigration,
} from "./editorSchema.js";

export type TemplateStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REMOTE_CHANGED"
  | "CONFLICT"
  | "IMPORT_FAILED";

export type TemplateSource = "LOCAL" | "BREVO";

export type ConversionStatus =
  | "NOT_IMPORTED"
  | "IMPORTING"
  | "AUTO_APPROVED"
  | "NEEDS_REVIEW"
  | "IMPORT_FAILED";

export type Permission =
  | "email_templates.read"
  | "email_templates.create"
  | "email_templates.edit"
  | "email_templates.publish"
  | "email_templates.delete"
  | "email_templates.manage_components"
  | "email_templates.manage_saved_sections"
  | "email_templates.raw_html";

export interface AuthUser {
  id: string;
  displayName: string;
  permissions: Permission[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiErrorBody | null;
}

/** GrapesJS project JSON — opaque to API beyond object shape. */
export type EditorProjectData = Record<string, unknown>;

export interface EmailTemplateDto {
  id: string;
  brevoTemplateId: string | null;
  name: string;
  label: string | null;
  subject: string | null;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  status: TemplateStatus;
  source: TemplateSource;
  editorData: EditorProjectData;
  /**
   * DB `published_html`: last editor export and/or last published HTML —
   * NOT a reliable Brevo original. Brevo recovery must GET by brevoTemplateId.
   */
  legacyHtml: string | null;
  conversionStatus: ConversionStatus | null;
  /** Persistent editor schema version (survives Grapes autosave). */
  editorSchemaVersion: number;
  conversionMeta: TemplateConversionMeta | null;
  /** True when Brevo-backed template needs explicit re-import migration. */
  migrationRequired: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface EmailTemplateListItem {
  id: string;
  brevoTemplateId: string | null;
  name: string;
  label: string | null;
  subject: string | null;
  status: TemplateStatus;
  source: TemplateSource;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateBody {
  name: string;
  label?: string | null;
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  editorData?: EditorProjectData;
  /** Store as legacy HTML for one-time conversion on open. */
  legacyHtml?: string | null;
}

export interface PatchTemplateBody {
  expectedRevision: number;
  name?: string;
  label?: string | null;
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  editorData?: EditorProjectData;
  legacyHtml?: string | null;
  conversionStatus?: ConversionStatus | null;
}

/** Verified Brevo sender for Absender dropdown. */
export interface BrevoSenderDto {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

/** Publish editor HTML to Brevo (create or update SMTP template). */
export interface PublishTemplateBody {
  expectedRevision: number;
  /** Full HTML document (merge tags intact; not sample-substituted). */
  html: string;
  /** Optional latest canvas JSON to persist atomically with publish. */
  editorData?: EditorProjectData;
  subject?: string | null;
  name?: string;
}

export interface PublishTemplateResultDto {
  template: EmailTemplateDto;
  /** Brevo SMTP template id after publish. */
  brevoTemplateId: string;
  /** True when a new Brevo template was created. */
  created: boolean;
}

export interface ConvertTemplateResultDto {
  template: EmailTemplateDto;
  report: {
    coverage: number;
    variables: { expected: number; preserved: number };
    images: { expected: number; preserved: number };
    links: { expected: number; preserved: number };
    unknownBlocks: number;
    warnings: string[];
    autoApproved: boolean;
    textPreserved?: boolean;
    sectionCount?: number;
    columnCount?: number;
    richTextCount?: number;
    imageCount?: number;
    socialGroupCount?: number;
    legacyBlockCount?: number;
  };
}

export interface MigrateBrevoEditorResultDto {
  template: EmailTemplateDto;
  /** True when conversion ran; false when already current (idempotent). */
  migrated: boolean;
  backupVersionId: string | null;
  report: ConvertTemplateResultDto["report"];
}

export interface BrevoSyncResultDto {
  fetched: number;
  created: number;
  updated: number;
  converted: number;
  skipped: number;
  /** Remote HTML changed while local draft dirty — editorData preserved. */
  conflicts: number;
  /** New Textbausteine created during sync harvest (deduped). */
  textbausteineCreated?: number;
  errors: Array<{ brevoId: number; message: string }>;
}

/** Resolve a sync conflict without last-write-wins. */
export type ResolveSyncConflictAction = "accept_remote" | "keep_local";

export interface ResolveSyncConflictBody {
  action: ResolveSyncConflictAction;
  expectedRevision: number;
}

export type TemplateAuditAction = "created" | "updated" | "published";

export interface TemplateAuditLogDto {
  id: string;
  actorUserId: string;
  actorDisplayName: string;
  action: TemplateAuditAction;
  revision: number;
  createdAt: string;
}

export interface TemplateSendEventDto {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  sentAt: string;
  status: string;
  source: string;
}

export interface TemplateInsightsDto {
  templateId: string;
  templateName: string;
  logs: TemplateAuditLogDto[];
  sendEvents: TemplateSendEventDto[];
  sendCount: number;
}

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  IMPORT_FAILED: "IMPORT_FAILED",
  MIGRATION_FAILED: "MIGRATION_FAILED",
  PUBLISH_FAILED: "PUBLISH_FAILED",
  INTERNAL: "INTERNAL",
} as const;

export function ok<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function fail(code: string, message: string): ApiResponse<null> {
  return { data: null, error: { code, message } };
}

export const EMPTY_EDITOR_DATA: EditorProjectData = {};

export type SavedSectionRole = "header" | "footer" | "content" | "social";

export interface SavedEmailSectionDto {
  id: string;
  name: string;
  role: SavedSectionRole;
  /** Full Grapes section component tree (snapshot). */
  sectionData: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedSectionBody {
  name: string;
  role: SavedSectionRole;
  sectionData: Record<string, unknown>;
}

export interface PatchSavedSectionBody {
  name?: string;
  sectionData?: Record<string, unknown>;
  /** When true, push snapshot to linked template instances. */
  syncLinked?: boolean;
}
