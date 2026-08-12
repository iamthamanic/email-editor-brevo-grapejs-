/**
 * BrevoTemplateGateway — sole Brevo entry for template publish/sync services.
 * Location: apps/api/src/brevo/gateway.ts
 */

import {
  createSmtpTemplate,
  getSmtpTemplate,
  listAllSmtpTemplates,
  listSenders,
  updateSmtpTemplate,
  withHtmlContent,
  type BrevoSender,
  type BrevoSmtpTemplate,
  type UpsertSmtpTemplateInput,
} from "./client.js";

export type { BrevoSender, BrevoSmtpTemplate, UpsertSmtpTemplateInput };

export const BrevoTemplateGateway = {
  listAll: listAllSmtpTemplates,
  get: getSmtpTemplate,
  withHtml: withHtmlContent,
  create: createSmtpTemplate,
  update: updateSmtpTemplate,
  listSenders,
} as const;
