/**
 * Variable registry — HVAI EmailParams + Mahnung snapshot (params.* only).
 * Location: packages/email-variables/src/registry.ts
 * Source (read-only): HVAI email.service.ts EmailParams + useMahnungTemplate buildEmailParams
 */

export type VariableGroup = "customer" | "order" | "invoice" | "meta";

export interface VariableDef {
  key: string;
  label: string;
  group: VariableGroup;
  groupLabel: string;
}

const GROUP_LABELS: Record<VariableGroup, string> = {
  customer: "Kunde",
  order: "Auftrag",
  invoice: "Rechnung",
  meta: "Meta",
};

function def(
  group: VariableGroup,
  key: string,
  label: string,
): VariableDef {
  return { key, label, group, groupLabel: GROUP_LABELS[group] };
}

/** Full ERP send-param catalog (static snapshot). */
export const EMAIL_VARIABLES: readonly VariableDef[] = [
  def("customer", "anrede", "Anrede"),
  def("customer", "vorname", "Vorname"),
  def("customer", "name", "Name"),
  def("customer", "firma", "Firma"),
  def("customer", "email", "E-Mail"),
  def("customer", "kunden_id", "Kunden-ID"),

  def("order", "bestellnummer", "Bestellnummer"),
  def("order", "bestelldatum", "Bestelldatum"),
  def("order", "date_from", "Datum von"),
  def("order", "date_to", "Datum bis"),
  def("order", "uhrzeit_von", "Uhrzeit von"),
  def("order", "uhrzeit_bis", "Uhrzeit bis"),
  def("order", "address", "Adresse"),
  def("order", "postal_code", "PLZ"),
  def("order", "stadt", "Stadt"),
  def("order", "length", "Länge"),
  def("order", "durchgehend", "Durchgehend"),
  def("order", "both_sides", "Beide Seiten"),
  def("order", "gesamtpreis", "Gesamtpreis"),
  def("order", "stadt_name", "Stadt Name"),
  def("order", "stadt_email", "Stadt E-Mail"),
  def("order", "stadt_tel", "Stadt Telefon"),
  def("order", "aufstellfrist", "Aufstellfrist"),
  def("order", "aufstellerpreis", "Aufstellerpreis"),
  def("order", "permit_included", "Genehmigung inklusive"),

  def("invoice", "rechnungsnummer", "Rechnungsnummer"),
  def("invoice", "rechnungsdatum", "Rechnungsdatum"),
  def("invoice", "rechnungsbetrag", "Rechnungsbetrag"),
  def("invoice", "mahnung", "Mahngebühr"),
  def("invoice", "gesamtbetrag", "Gesamtbetrag"),

  def("meta", "subject", "Betreff (Param)"),
] as const;

export function listVariableKeys(): string[] {
  return EMAIL_VARIABLES.map((v) => v.key);
}

export function isKnownVariableKey(key: string): boolean {
  return EMAIL_VARIABLES.some((v) => v.key === key);
}

export function getVariable(key: string): VariableDef | undefined {
  return EMAIL_VARIABLES.find((v) => v.key === key);
}

export function groupVariables(): Record<VariableGroup, VariableDef[]> {
  const out: Record<VariableGroup, VariableDef[]> = {
    customer: [],
    order: [],
    invoice: [],
    meta: [],
  };
  for (const v of EMAIL_VARIABLES) {
    out[v.group].push(v);
  }
  return out;
}
