/**
 * Assert Brevo sender email is on the verified/active list.
 * Location: apps/api/src/brevo/senderAllowlist.ts
 */

import { ERROR_CODES } from "@email-template/email-schema";
import { BrevoTemplateGateway, type BrevoSender } from "./gateway.js";

export type SenderListFetcher = () => Promise<BrevoSender[]>;

export class SenderAllowlistError extends Error {
  constructor(
    message: string,
    public readonly code: string = ERROR_CODES.VALIDATION,
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = "SenderAllowlistError";
  }
}

let cache: { at: number; senders: BrevoSender[] } | null = null;
const CACHE_MS = 60_000;

export async function getVerifiedSenders(
  fetchList: SenderListFetcher = () => BrevoTemplateGateway.listSenders(),
): Promise<BrevoSender[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.senders;
  const senders = await fetchList();
  cache = { at: now, senders };
  return senders;
}

/** Test helper — clear TTL cache. */
export function clearSenderAllowlistCache(): void {
  cache = null;
}

export function isActiveVerifiedSender(
  email: string,
  senders: BrevoSender[],
): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  return senders.some((s) => s.active && s.email === normalized);
}

/**
 * Throws SenderAllowlistError when email is not an active verified Brevo sender.
 */
export async function assertVerifiedSenderEmail(
  email: string,
  deps: { fetchList?: SenderListFetcher } = {},
): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new SenderAllowlistError("Absender-E-Mail fehlt.");
  }
  const senders = await getVerifiedSenders(deps.fetchList);
  if (!isActiveVerifiedSender(trimmed, senders)) {
    throw new SenderAllowlistError(
      "Absender-E-Mail ist kein verifizierter aktiver Brevo-Sender.",
    );
  }
}
