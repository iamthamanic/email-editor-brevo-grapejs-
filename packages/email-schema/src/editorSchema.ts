/**
 * Editor / conversion schema versions — single source of truth.
 * Location: packages/email-schema/src/editorSchema.ts
 *
 * Bump CURRENT_EDITOR_SCHEMA_VERSION when Grapes project shape or
 * Brevo→editor conversion semantics change in a way that requires
 * re-import of existing Brevo-backed templates.
 */

/** Grapes project + section/role model expected by the current editor.
 * v3: exactly one content canvas; multi-col layouts nest as email-layout-row.
 */
export const CURRENT_EDITOR_SCHEMA_VERSION = 3;

/**
 * Importer pipeline generation (footer unwrap, sibling sections, …).
 * Independent of editor schema so importer fixes can bump this alone.
 * v4: footer logo keeps Brevo px width; 50/50 column align left|center.
 */
export const CURRENT_CONVERSION_VERSION = 4;

export type ConversionSource = "brevo" | "html" | "local" | "unknown";

/** Stashed Brevo HTML when sync finds remote changes but local edits exist. */
export interface PendingRemoteSync {
  html: string;
  name: string;
  subject: string | null;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  label: string | null;
  fetchedAt: string;
  htmlHash: string;
}

export interface TemplateConversionMeta {
  editorSchemaVersion: number;
  conversionVersion: number;
  conversionSource: ConversionSource;
  sourceBrevoModifiedAt?: string | null;
  sourceHtmlHash?: string | null;
  migratedAt?: string | null;
  /** Present while status is CONFLICT / REMOTE_CHANGED awaiting resolve. */
  pendingRemote?: PendingRemoteSync | null;
}

export function isEditorSchemaCurrent(version: number | null | undefined): boolean {
  return (version ?? 0) >= CURRENT_EDITOR_SCHEMA_VERSION;
}

export function isConversionCurrent(version: number | null | undefined): boolean {
  return (version ?? 0) >= CURRENT_CONVERSION_VERSION;
}

export function needsBrevoEditorMigration(input: {
  brevoTemplateId: string | null | undefined;
  editorSchemaVersion: number | null | undefined;
  conversionVersion?: number | null | undefined;
  hasEditorData: boolean;
}): boolean {
  if (!input.brevoTemplateId) return false;
  if (!input.hasEditorData) return false;
  if (!isEditorSchemaCurrent(input.editorSchemaVersion)) return true;
  // Stale / missing importer generation (footer layout etc.) → re-import from Brevo
  if (!isConversionCurrent(input.conversionVersion)) return true;
  return false;
}
