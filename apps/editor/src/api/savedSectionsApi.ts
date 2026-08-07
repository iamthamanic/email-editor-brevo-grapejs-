/**
 * API client for saved email sections.
 * Location: apps/editor/src/api/savedSectionsApi.ts
 */

import type {
  CreateSavedSectionBody,
  PatchSavedSectionBody,
  SavedEmailSectionDto,
} from "@email-template/email-schema";
import { parseApiResponse } from "./parseApiResponse";

export async function fetchSavedSections(
  role?: string,
): Promise<SavedEmailSectionDto[]> {
  const q = role ? `?role=${encodeURIComponent(role)}` : "";
  const response = await fetch(`/api/saved-sections${q}`);
  return parseApiResponse(response);
}

export async function createSavedSection(
  body: CreateSavedSectionBody,
): Promise<SavedEmailSectionDto> {
  const response = await fetch("/api/saved-sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

export async function patchSavedSection(
  id: string,
  body: PatchSavedSectionBody,
): Promise<{ section: SavedEmailSectionDto; syncedTemplates: number }> {
  const response = await fetch(`/api/saved-sections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

export async function deleteSavedSection(id: string): Promise<{ ok: boolean }> {
  const response = await fetch(`/api/saved-sections/${id}`, {
    method: "DELETE",
  });
  return parseApiResponse(response);
}
