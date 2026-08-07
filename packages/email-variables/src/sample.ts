/**
 * Sample preview data — Musterwerte, keine echten PII.
 * Location: packages/email-variables/src/sample.ts
 */

import { listVariableKeys } from "./registry.js";

export type SampleData = Readonly<Record<string, string>>;

const SAMPLE: Record<string, string> = {
  anrede: "Herr",
  vorname: "Max",
  name: "Mustermann",
  firma: "Musterfirma GmbH",
  email: "max.mustermann@example.com",
  kunden_id: "10042",

  bestellnummer: "HV-2026-0042",
  bestelldatum: "07.08.2026",
  date_from: "10.08.2026",
  date_to: "12.08.2026",
  uhrzeit_von: "08:00",
  uhrzeit_bis: "18:00",
  address: "Musterstraße 1",
  postal_code: "10115",
  stadt: "Berlin",
  length: "20 m",
  durchgehend: "ja",
  both_sides: "nein",
  gesamtpreis: "249,00 €",
  stadt_name: "Berlin",
  stadt_email: "ordnung@example.berlin.de",
  stadt_tel: "030 123456",
  aufstellfrist: "48 Stunden",
  aufstellerpreis: "89,00 €",
  permit_included: "ja",

  rechnungsnummer: "RE-2026-1001",
  rechnungsdatum: "07.08.2026",
  rechnungsbetrag: "249,00 €",
  mahnung: "5,00 €",
  gesamtbetrag: "254,00 €",

  subject: "Ihre Bestellung HV-2026-0042",
};

export function getSampleData(): SampleData {
  const keys = listVariableKeys();
  const out: Record<string, string> = {};
  for (const key of keys) {
    out[key] = SAMPLE[key] ?? "";
  }
  return out;
}
