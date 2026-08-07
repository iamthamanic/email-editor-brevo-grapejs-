/**
 * API client for variable catalog + sample preview.
 * Location: apps/editor/src/api/variablesApi.ts
 */

import type { ApiResponse } from "@email-template/email-schema";
import type { SampleData, VariableGroup } from "@email-template/email-variables";

export interface VariableDto {
  key: string;
  label: string;
  group: VariableGroup;
  groupLabel: string;
  expression: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || body.error || body.data === null) {
    const message = body.error?.message ?? `Request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export async function fetchVariables(): Promise<VariableDto[]> {
  const response = await fetch("/api/variables");
  const data = await parseResponse<{ variables: VariableDto[] }>(response);
  return data.variables;
}

export async function fetchSampleData(): Promise<SampleData> {
  const response = await fetch("/api/preview/sample");
  const data = await parseResponse<{ sample: SampleData }>(response);
  return data.sample;
}
