/**
 * Send a test email for a template (current editor HTML or Brevo template test).
 * Location: apps/api/src/templates/sendTest.ts
 */

import type { AuthUser } from "@email-template/email-schema";
import { ERROR_CODES } from "@email-template/email-schema";
import {
  BrevoApiError,
  sendSmtpTemplateTest,
  sendTransacEmail,
} from "../brevo/client.js";
import { assertVerifiedSenderEmail, SenderAllowlistError } from "../brevo/senderAllowlist.js";
import { prisma } from "../db.js";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 10;
const MAX_HTML_BYTES = 900_000;

export class SendTestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "SendTestError";
  }
}

export interface SendTestBody {
  emails: string[];
  /** Substituted HTML from the editor preview (preferred for WYSIWYG test). */
  html?: string;
  subject?: string;
  /** When true and brevoTemplateId set, use Brevo sendTest on published template. */
  usePublishedTemplate?: boolean;
}

export interface SendTestResult {
  mode: "html" | "brevo-template";
  recipientCount: number;
  messageId?: string;
}

function normalizeEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new SendTestError(
      "emails muss ein Array sein.",
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
  if (emails.length === 0) {
    throw new SendTestError(
      "Mindestens eine Empfänger-E-Mail angeben.",
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  if (emails.length > MAX_RECIPIENTS) {
    throw new SendTestError(
      `Maximal ${MAX_RECIPIENTS} Empfänger.`,
      ERROR_CODES.VALIDATION,
      400,
    );
  }
  for (const email of emails) {
    if (!EMAIL_RE.test(email)) {
      throw new SendTestError(
        `Ungültige E-Mail: ${email}`,
        ERROR_CODES.VALIDATION,
        400,
      );
    }
  }
  return emails;
}

export async function sendTemplateTest(
  templateId: string,
  body: SendTestBody,
  _user: AuthUser,
): Promise<SendTestResult> {
  const emails = normalizeEmails(body.emails);
  const row = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
  });
  if (!row) {
    throw new SendTestError("Template nicht gefunden.", ERROR_CODES.NOT_FOUND, 404);
  }

  const usePublished =
    Boolean(body.usePublishedTemplate) && row.brevoTemplateId != null;

  try {
    if (usePublished) {
      await sendSmtpTemplateTest(Number(row.brevoTemplateId), emails);
      console.info("[send-test]", {
        templateId,
        brevoTemplateId: row.brevoTemplateId,
        mode: "brevo-template",
        recipientCount: emails.length,
      });
      return {
        mode: "brevo-template",
        recipientCount: emails.length,
      };
    }

    const html = typeof body.html === "string" ? body.html : "";
    if (!html.trim()) {
      throw new SendTestError(
        "HTML für Testversand fehlt.",
        ERROR_CODES.VALIDATION,
        400,
      );
    }
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new SendTestError(
        "HTML zu groß für Testversand.",
        ERROR_CODES.VALIDATION,
        400,
      );
    }

    const senderEmail =
      row.senderEmail?.trim() ||
      process.env.BREVO_DEFAULT_SENDER_EMAIL?.trim() ||
      "";
    if (!senderEmail) {
      throw new SendTestError(
        "Kein Absender gesetzt (Template Absender-E-Mail oder BREVO_DEFAULT_SENDER_EMAIL).",
        ERROR_CODES.VALIDATION,
        400,
      );
    }

    try {
      await assertVerifiedSenderEmail(senderEmail);
    } catch (err) {
      if (err instanceof SenderAllowlistError) {
        throw new SendTestError(err.message, err.code, err.httpStatus);
      }
      throw err;
    }

    const subject =
      (typeof body.subject === "string" && body.subject.trim()) ||
      row.subject?.trim() ||
      "(kein Betreff)";

    const result = await sendTransacEmail({
      sender: {
        email: senderEmail,
        name: row.senderName?.trim() || undefined,
      },
      to: emails.map((email) => ({ email })),
      subject,
      htmlContent: html,
    });

    console.info("[send-test]", {
      templateId,
      mode: "html",
      recipientCount: emails.length,
      messageId: result.messageId ?? null,
    });

    return {
      mode: "html",
      recipientCount: emails.length,
      messageId: result.messageId,
    };
  } catch (err: unknown) {
    if (err instanceof SendTestError) throw err;
    if (err instanceof BrevoApiError) {
      throw new SendTestError(err.message, ERROR_CODES.INTERNAL, err.httpStatus);
    }
    throw err;
  }
}
