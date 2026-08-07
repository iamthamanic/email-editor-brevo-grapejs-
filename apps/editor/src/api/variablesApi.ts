/**
 * API client for variable catalog + sample preview.
 * Location: apps/editor/src/api/variablesApi.ts
 */

import type { SampleData, VariableGroup } from "@email-template/email-variables";
import { parseApiResponse } from "./parseApiResponse";

export interface VariableDto {
  key: string;
  label: string;
  description?: string;
  group: VariableGroup;
  groupLabel: string;
  expression: string;
}

export async function fetchVariables(): Promise<VariableDto[]> {
  const response = await fetch("/api/variables");
  const data = await parseApiResponse<{ variables: VariableDto[] }>(response);
  return data.variables;
}

export async function fetchSampleData(): Promise<SampleData> {
  const response = await fetch("/api/preview/sample");
  const data = await parseApiResponse<{ sample: SampleData }>(response);
  return data.sample;
}
