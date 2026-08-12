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

async function brevoFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const apiKey = getApiKey();
  const method = init?.method ?? "GET";
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    method,
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      ...(init?.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
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
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
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

export interface SendTransacEmailInput {
  sender: { name?: string; email: string };
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  params?: Record<string, string>;
}

/**
 * Send one transactional email with inline HTML (editor preview / test send).
 * API key stays server-side only.
 */
export async function sendTransacEmail(
  input: SendTransacEmailInput,
): Promise<{ messageId?: string }> {
  return brevoFetch<{ messageId?: string }>("/smtp/email", {
    method: "POST",
    body: {
      sender: input.sender,
      to: input.to,
      ...(input.cc?.length ? { cc: input.cc } : {}),
      ...(input.bcc?.length ? { bcc: input.bcc } : {}),
      subject: input.subject,
      htmlContent: input.htmlContent,
      ...(input.params ? { params: input.params } : {}),
    },
  });
}

/**
 * Send Brevo official template test send (published template on Brevo).
 * Recipients must typically exist in Brevo contacts / test list.
 */
export async function sendSmtpTemplateTest(
  templateId: number,
  emailTo: string[],
): Promise<void> {
  await brevoFetch<unknown>(`/smtp/templates/${templateId}/sendTest`, {
    method: "POST",
    body: { emailTo },
  });
}

export interface UpsertSmtpTemplateInput {
  templateName: string;
  subject: string;
  htmlContent: string;
  sender: { email: string; name?: string };
  replyTo?: string;
  isActive?: boolean;
  tag?: string;
}

/** Create transactional SMTP template; returns Brevo numeric id. */
export async function createSmtpTemplate(
  input: UpsertSmtpTemplateInput,
): Promise<{ id: number }> {
  const res = await brevoFetch<{ id: number }>("/smtp/templates", {
    method: "POST",
    body: {
      templateName: input.templateName,
      subject: input.subject,
      htmlContent: input.htmlContent,
      sender: input.sender,
      isActive: input.isActive ?? true,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.tag ? { tag: input.tag } : {}),
    },
  });
  if (!res?.id || !Number.isFinite(res.id)) {
    throw new BrevoApiError("Brevo Create: keine Template-ID zurückgegeben.", 502);
  }
  return { id: res.id };
}

/** Update existing transactional SMTP template by numeric id. */
export async function updateSmtpTemplate(
  templateId: number,
  input: Partial<UpsertSmtpTemplateInput>,
): Promise<void> {
  await brevoFetch<unknown>(`/smtp/templates/${templateId}`, {
    method: "PUT",
    body: {
      ...(input.templateName !== undefined
        ? { templateName: input.templateName }
        : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.htmlContent !== undefined
        ? { htmlContent: input.htmlContent }
        : {}),
      ...(input.sender !== undefined ? { sender: input.sender } : {}),
      ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.tag !== undefined ? { tag: input.tag } : {}),
    },
  });
}

export interface BrevoSender {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

interface SendersResponse {
  senders?: Array<{
    id?: number;
    name?: string;
    email?: string;
    active?: boolean;
  }>;
}

/** List verified Brevo senders (for Absender dropdown). */
export async function listSenders(): Promise<BrevoSender[]> {
  const res = await brevoFetch<SendersResponse>("/senders");
  const rows = res.senders ?? [];
  return rows
    .map((s) => ({
      id: Number(s.id),
      name: String(s.name ?? "").trim(),
      email: String(s.email ?? "").trim().toLowerCase(),
      active: s.active !== false,
    }))
    .filter((s) => Number.isFinite(s.id) && s.id > 0 && s.email.includes("@"));
}
