/**
 * Shared API/DTO types for email template service.
 * Location: packages/email-schema — single wire-format source for editor + API.
 */

export type TemplateStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REMOTE_CHANGED"
  | "CONFLICT"
  | "IMPORT_FAILED";

export type TemplateSource = "LOCAL" | "BREVO";

export type Permission =
  | "email_templates.read"
  | "email_templates.create"
  | "email_templates.edit"
  | "email_templates.publish"
  | "email_templates.delete"
  | "email_templates.manage_components"
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
  subject: string | null;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  status: TemplateStatus;
  source: TemplateSource;
  editorData: EditorProjectData;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface EmailTemplateListItem {
  id: string;
  name: string;
  subject: string | null;
  status: TemplateStatus;
  source: TemplateSource;
  revision: number;
  updatedAt: string;
}

export interface CreateTemplateBody {
  name: string;
  subject?: string | null;
  editorData?: EditorProjectData;
}

export interface PatchTemplateBody {
  expectedRevision: number;
  name?: string;
  subject?: string | null;
  editorData?: EditorProjectData;
}

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  REVISION_CONFLICT: "REVISION_CONFLICT",
  INTERNAL: "INTERNAL",
} as const;

export function ok<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function fail(code: string, message: string): ApiResponse<null> {
  return { data: null, error: { code, message } };
}

export const EMPTY_EDITOR_DATA: EditorProjectData = {};
