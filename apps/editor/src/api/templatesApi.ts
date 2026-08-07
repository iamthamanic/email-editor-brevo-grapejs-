/**
 * Thin API client for template CRUD.
 * Location: apps/editor/src/api/templatesApi.ts
 */

import type {
  ApiResponse,
  CreateTemplateBody,
  EmailTemplateDto,
  EmailTemplateListItem,
  PatchTemplateBody,
} from "@email-template/email-schema";

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || body.error || body.data === null) {
    const message = body.error?.message ?? `Request failed (${response.status})`;
    const code = body.error?.code ?? "REQUEST_FAILED";
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export async function fetchTemplates(): Promise<EmailTemplateListItem[]> {
  const response = await fetch("/api/templates");
  return parseResponse(response);
}

export async function fetchTemplate(id: string): Promise<EmailTemplateDto> {
  const response = await fetch(`/api/templates/${id}`);
  return parseResponse(response);
}

export async function createTemplate(
  body: CreateTemplateBody,
): Promise<EmailTemplateDto> {
  const response = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse(response);
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
  return parseResponse(response);
}
