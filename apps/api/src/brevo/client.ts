/**
 * Minimal Brevo SMTP Templates HTTP client (api-key header).
 * Location: apps/api/src/brevo/client.ts
 */

export class BrevoApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "BrevoApiError";
  }
}

export interface BrevoSmtpTemplate {
  id: number;
  name: string;
  subject?: string;
  isActive?: boolean;
  htmlContent?: string;
  sender?: { name?: string; email?: string };
  replyTo?: string;
  modifiedAt?: string;
  createdAt?: string;
  tag?: string;
}

interface ListResponse {
  count?: number;
  templates?: BrevoSmtpTemplate[];
}

function getApiKey(): string {
  const key = process.env.BREVO_API_KEY?.trim();
  if (!key) {
    throw new BrevoApiError(
      "BREVO_API_KEY fehlt in apps/api/.env (Backend neu starten).",
      400,
    );
  }
  return key;
}

async function brevoFetch<T>(path: string): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    headers: {
      accept: "application/json",
      "api-key": apiKey,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      // ignore
    }
    throw new BrevoApiError(`Brevo API: ${detail}`, res.status);
  }
  return (await res.json()) as T;
}

/** Paginate all transactional SMTP templates (metadata; HTML may be missing). */
export async function listAllSmtpTemplates(): Promise<BrevoSmtpTemplate[]> {
  const pageSize = 50;
  let offset = 0;
  const all: BrevoSmtpTemplate[] = [];
  for (;;) {
    const q = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
      sort: "desc",
    });
    const page = await brevoFetch<ListResponse>(`/smtp/templates?${q}`);
    const batch = page.templates ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset > 5000) break; // safety
  }
  return all;
}

export async function getSmtpTemplate(
  templateId: number,
): Promise<BrevoSmtpTemplate> {
  return brevoFetch<BrevoSmtpTemplate>(`/smtp/templates/${templateId}`);
}

/** Ensure htmlContent is present (list responses sometimes omit it). */
export async function withHtmlContent(
  t: BrevoSmtpTemplate,
): Promise<BrevoSmtpTemplate> {
  if (t.htmlContent?.trim()) return t;
  return getSmtpTemplate(t.id);
}
