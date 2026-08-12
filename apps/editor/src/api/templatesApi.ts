/**
 * Thin API client for template CRUD.
 * Location: apps/editor/src/api/templatesApi.ts
 */

import type {
  BrevoSenderDto,
  BrevoSyncResultDto,
  ConvertTemplateResultDto,
  CreateTemplateBody,
  EmailTemplateDto,
  EmailTemplateListItem,
  MigrateBrevoEditorResultDto,
  PatchTemplateBody,
  PublishTemplateBody,
  PublishTemplateResultDto,
  TemplateInsightsDto,
} from "@email-template/email-schema";
import { parseApiResponse } from "./parseApiResponse";

export async function fetchTemplates(): Promise<EmailTemplateListItem[]> {
  const response = await fetch("/api/templates");
  return parseApiResponse(response);
}

export async function fetchBrevoSenders(): Promise<BrevoSenderDto[]> {
  const response = await fetch("/api/brevo/senders");
  return parseApiResponse(response);
}

export async function syncBrevoTemplates(): Promise<BrevoSyncResultDto> {
  const response = await fetch("/api/templates/sync-brevo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiResponse(response);
}

export async function resolveSyncConflict(
  id: string,
  body: { action: "accept_remote" | "keep_local"; expectedRevision: number },
): Promise<EmailTemplateDto> {
  const response = await fetch(`/api/templates/${id}/resolve-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

export async function fetchTemplate(id: string): Promise<EmailTemplateDto> {
  const response = await fetch(`/api/templates/${id}`);
  return parseApiResponse(response);
}

export async function createTemplate(
  body: CreateTemplateBody,
): Promise<EmailTemplateDto> {
  const response = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

export async function patchTemplate(
  id: string,
  body: PatchTemplateBody,
): Promise<EmailTemplateDto> {
  const response = await fetch(`/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

export async function publishTemplate(
  id: string,
  body: PublishTemplateBody,
): Promise<PublishTemplateResultDto> {
  const response = await fetch(`/api/templates/${id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

export async function convertTemplate(
  id: string,
  body?: { force?: boolean; html?: string },
): Promise<ConvertTemplateResultDto> {
  const response = await fetch(`/api/templates/${id}/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return parseApiResponse(response);
}

export async function migrateBrevoEditor(
  id: string,
): Promise<MigrateBrevoEditorResultDto> {
  const response = await fetch(`/api/templates/${id}/migrate-brevo-editor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiResponse(response);
}

export interface SendTestEmailResult {
  mode: "html" | "brevo-template";
  recipientCount: number;
  messageId?: string;
}

export async function sendTemplateTestEmail(
  id: string,
  body: {
    emails: string[];
    html?: string;
    subject?: string;
    usePublishedTemplate?: boolean;
  },
): Promise<SendTestEmailResult> {
  const response = await fetch(`/api/templates/${id}/send-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

export async function deleteTemplate(id: string): Promise<{ id: string }> {
  const response = await fetch(`/api/templates/${id}`, {
    method: "DELETE",
  });
  return parseApiResponse(response);
}

export async function duplicateTemplate(id: string): Promise<EmailTemplateDto> {
  const response = await fetch(`/api/templates/${id}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return parseApiResponse(response);
}

export async function fetchTemplateInsights(
  id: string,
): Promise<TemplateInsightsDto> {
  const response = await fetch(`/api/templates/${id}/insights`);
  return parseApiResponse(response);
}

export function templateStatisticsCsvUrl(id: string): string {
  return `/api/templates/${id}/statistics.csv`;
}
