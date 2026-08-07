/**
 * Thin API client for template CRUD.
 * Location: apps/editor/src/api/templatesApi.ts
 */

import type {
  BrevoSyncResultDto,
  ConvertTemplateResultDto,
  CreateTemplateBody,
  EmailTemplateDto,
  EmailTemplateListItem,
  PatchTemplateBody,
  TemplateInsightsDto,
} from "@email-template/email-schema";
import { parseApiResponse } from "./parseApiResponse";

export async function fetchTemplates(): Promise<EmailTemplateListItem[]> {
  const response = await fetch("/api/templates");
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

export async function deleteTemplate(id: string): Promise<{ id: string }> {
  const response = await fetch(`/api/templates/${id}`, {
    method: "DELETE",
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
