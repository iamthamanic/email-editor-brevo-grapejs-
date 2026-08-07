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
  Kundennachricht: "Bitte früh morgens aufstellen.",
  Weitere_Infos: "Kunde telefonisch informiert.",

  bestellnummer: "HV-2026-0042",
  auftragsnummer: "HV-2026-0042",
  bestelldatum: "07.08.2026",
  adresse: "Musterstraße 1",
  address: "Musterstraße 1",
  plz: "10115",
  postal_code: "10115",
  stadt: "Berlin",
  datum_von: "10.08.2026",
  date_from: "10.08.2026",
  datum_bis: "12.08.2026",
  date_to: "12.08.2026",
  uhrzeit_von: "08:00",
  uhrzeit_bis: "18:00",
  lange: "20 m",
  length: "20 m",
  wofur: "Umzug",
  "detaillierte.angaben": "Sperrung der rechten Fahrspur vor Hausnr. 1–5",
  genehmigung_prozess_kunde: "wird von uns beantragt",
  genehmigung_prozess_aufsteller: "liegt bei, bitte nicht erneut beantragen",
  "datum.vier.tage.vor.ablauf": "08.08.2026",
  problem: "Schild verkippt",
  "minuten.dauer": "25 Minuten",
  label: "Halteverbotszone",
  amt_telefon: "030 123456",
  vorlaufzeit_stadt: "14 Werktagen",
  durchgehend: "ja",
  both_sides: "nein",
  gesamtpreis: "249,00 €",
  stadt_name: "Berlin",
  stadt_email: "ordnung@example.berlin.de",
  stadt_tel: "030 123456",
  aufstellfrist: "48 Stunden",
  aufstellerpreis: "89,00 €",
  permit_included: "ja",
  "bwb.id": "BWB-99881",
  "polizei.vorgangsnummer": "POL-2026-441",
  "gefahrenstellen.stand.datum": "01.08.2026",
  KW: "33",
  "kw.gg": "33",
  KW_von: "27",
  KW_bis: "31",
  Datum: "15.08.2026",
  Uhrzeit: "08:00 und 12:00 Uhr",
  "sammelrechnung.monat": "Juli",
  "sammelrechnung.jahr": "2026",
  "code.wiedergutmachung": "GUT-10",
  rabatt: "10 %",
  preisliste: "(Preisliste)",
  pauschale: "25,00 €",
  ortsbesichtigung_preis: "50,00 € zzgl. 19 % MwSt.",
  anzahlung: "100,00 €",
  zusatzkosten: "75,00 €",
  gesamtpreis_brutto: "249,00 €",
  angebotssumme: "249,00 €",

  rechnungsnummer: "RE-2026-1001",
  rechnung: "RE-2026-1001",
  rechnungsdatum: "07.08.2026",
  rechnungsbetrag: "249,00 €",
  mahngebuehr: "5,00 €",
  mahnung: "5,00 €",
  gesamtbetrag: "254,00 €",
  rechnungsliste: "(Rechnungsliste)",

  subject: "Ihre Bestellung HV-2026-0042",
};

export function getSampleData(): SampleData {
  const keys = listVariableKeys();
  const out: Record<string, string> = {};
  for (const key of keys) {
    out[key] = SAMPLE[key] ?? `Muster-${key}`;
  }
  return out;
}
