/**
 * Compose send — raw HTML transactional email (no Brevo template id).
 * Location: apps/api/src/compose/sendCompose.ts
 */

import { ERROR_CODES } from "@email-template/email-schema";
import { BrevoApiError, sendTransacEmail } from "../brevo/client.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 20;
const MAX_HTML_BYTES = 900_000;
const MAX_SUBJECT = 200;

export class ComposeSendError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ComposeSendError";
  }
}

export interface ComposeSendBody {
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

function normalizeEmails(
  raw: unknown,
  field: string,
  allowEmpty: boolean,
): string[] {
  if (raw === undefined || raw === null) {
    if (allowEmpty) return [];
    throw new ComposeSendError(
      `${field} muss ein Array sein.`,
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  if (!Array.isArray(raw)) {
    throw new ComposeSendError(
      `${field} muss ein Array sein.`,
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  const emails = [
    ...new Set(
      raw
        .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
        .filter(Boolean),
    ),
  ];
  if (!allowEmpty && emails.length === 0) {
    throw new ComposeSendError(
      "Mindestens eine Empfänger-E-Mail angeben.",
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  for (const email of emails) {
    if (!EMAIL_RE.test(email)) {
      throw new ComposeSendError(
        `Ungültige E-Mail: ${email}`,
        ERROR_CODES.VALIDATION,
        400,
      );
    }
  }
  return emails;
}

/**
 * Send composed email HTML via Brevo transactional API.
 * Response: { recipientCount, messageId? }
 */
export async function sendComposeEmail(
  body: ComposeSendBody,
): Promise<ComposeSendResult> {
  const to = normalizeEmails(body.to, "to", false);
  const cc = normalizeEmails(body.cc, "cc", true);
  const bcc = normalizeEmails(body.bcc, "bcc", true);
  const total = to.length + cc.length + bcc.length;
  if (total > MAX_RECIPIENTS) {
    throw new ComposeSendError(
      `Maximal ${MAX_RECIPIENTS} Empfänger (An+CC+BCC).`,
      ERROR_CODES.VALIDATION,
      400,
    );
  }

  const subject =
    typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    throw new ComposeSendError(
      "Betreff fehlt.",
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  if (subject.length > MAX_SUBJECT) {
    throw new ComposeSendError(
      `Betreff max. ${MAX_SUBJECT} Zeichen.`,
      ERROR_CODES.VALIDATION,
      400,
    );
  }

  const html = typeof body.html === "string" ? body.html : "";
  if (!html.trim()) {
    throw new ComposeSendError(
      "HTML-Inhalt fehlt.",
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new ComposeSendError(
      "HTML zu groß für Versand.",
      ERROR_CODES.VALIDATION,
      400,
    );
  }

  const senderEmail = process.env.BREVO_DEFAULT_SENDER_EMAIL?.trim() || "";
  if (!senderEmail) {
    throw new ComposeSendError(
      "Kein Absender gesetzt (BREVO_DEFAULT_SENDER_EMAIL).",
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  const senderName = process.env.BREVO_DEFAULT_SENDER_NAME?.trim() || undefined;

  try {
    const result = await sendTransacEmail({
      sender: { email: senderEmail, name: senderName },
      to: to.map((email) => ({ email })),
      cc: cc.length ? cc.map((email) => ({ email })) : undefined,
      bcc: bcc.length ? bcc.map((email) => ({ email })) : undefined,
      subject,
      htmlContent: html,
    });

    console.info("[compose-send]", {
      recipientCount: total,
      messageId: result.messageId ?? null,
    });

    return {
      recipientCount: total,
      messageId: result.messageId,
    };
  } catch (err: unknown) {
    if (err instanceof ComposeSendError) throw err;
    if (err instanceof BrevoApiError) {
      throw new ComposeSendError(
        err.message,
        ERROR_CODES.INTERNAL,
        err.httpStatus,
      );
    }
    throw err;
  }
}
