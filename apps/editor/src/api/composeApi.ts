/**
 * Compose send API client (raw HTML).
 * Location: apps/editor/src/api/composeApi.ts
 */

import { parseApiResponse } from "./parseApiResponse";

export interface ComposeSendRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
}

export interface ComposeSendResult {
  recipientCount: number;
  messageId?: string;
}

export async function sendComposeEmail(
  body: ComposeSendRequest,
): Promise<ComposeSendResult> {
  const response = await fetch("/api/compose/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}
