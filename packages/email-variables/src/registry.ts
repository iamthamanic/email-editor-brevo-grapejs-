/**
 * Variable registry — Brevo params catalog (label + Angezeigte Informationen).
 * Location: packages/email-variables/src/registry.ts
 */

export type VariableGroup = "customer" | "order" | "invoice" | "meta";

export interface VariableDef {
  key: string;
  /** Short pill / picker label */
  label: string;
  /** Long “Angezeigte Informationen” for Eigenschaften */
  description: string;
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
  description: string,
): VariableDef {
  return { key, label, description, group, groupLabel: GROUP_LABELS[group] };
}

/** Full param catalog (ERP + Brevo production keys). */
export const EMAIL_VARIABLES: readonly VariableDef[] = [
  // Customer
  def(
    "customer",
    "anrede",
    "Anrede",
    "Anredeform des Empfängers, z. B. Herr oder Frau. Steht hinter „Sehr geehrte/r“, ergibt bei Firmen ohne Ansprechpartner einen schiefen Satz",
  ),
  def(
    "customer",
    "vorname",
    "Vorname",
    "Vorname des Empfängers. Nur in den Marketing- und Reaktivierungsmails, die mit „Hallo“ beginnen",
  ),
  def(
    "customer",
    "name",
    "Name",
    "Nachname bzw. Firmenname des Empfängers",
  ),
  def("customer", "firma", "Firma", "Firmenname des Empfängers"),
  def("customer", "email", "E-Mail", "E-Mail-Adresse des Empfängers"),
  def("customer", "kunden_id", "Kunden-ID", "Interne Kundennummer im ERP"),
  def(
    "customer",
    "Kundennachricht",
    "Kundennachricht",
    "Der vom Kunden bei der Bestellung eingegebene Freitext. In #200 zweckentfremdet für die Änderung der Behörde – das gehört in ein eigenes Feld",
  ),
  def(
    "customer",
    "Weitere_Infos",
    "Weitere Infos",
    "Interne Notiz des Sachbearbeiters zum Auftrag. Kommt nie zusammen mit detaillierte.angaben vor, könnte dasselbe ERP-Feld sein",
  ),

  // Order / deployment
  def(
    "order",
    "bestellnummer",
    "Bestellnummer",
    "Interne Bestellnummer des Auftrags. Ein Feld für alle Auftragsarten – Halteverbot, Verkehrssicherung und alle Ausschreibungen. Beispiel: HV123-172845",
  ),
  def(
    "order",
    "auftragsnummer",
    "Auftragsnummer",
    "Auftragsnummer im Betreff. Gleiches ERP-Feld wie bestellnummer – #91 und #92 nutzen im Body bereits bestellnummer für denselben Wert",
  ),
  def(
    "order",
    "bestelldatum",
    "Bestelldatum",
    "ACHTUNG zwei Bedeutungen: in #43 das Datum der Bestellung, in den Ausschreibungs-Betreffs (BWB, Polizei) das Einsatzdatum. Vor der ERP-Anbindung klären und ggf. trennen",
  ),
  def(
    "order",
    "adresse",
    "Adresse",
    "Straße und Hausnummer des Einsatzorts. PLZ und Stadt kommen aus eigenen Feldern und dürfen hier nicht mit drinstehen",
  ),
  def("order", "address", "Adresse (ERP)", "Straße und Hausnummer (ERP-Alias zu adresse)"),
  def("order", "plz", "PLZ", "Postleitzahl des Einsatzorts"),
  def("order", "postal_code", "PLZ (ERP)", "Postleitzahl (ERP-Alias zu plz)"),
  def(
    "order",
    "stadt",
    "Stadt",
    "Stadt des Einsatzorts. Wird auch in Sätzen verwendet, z. B. „Für Berlin fordert die Behörde …“",
  ),
  def(
    "order",
    "datum_von",
    "Datum von",
    "Erster Gültigkeitstag der Maßnahme, Format TT.MM.JJJJ",
  ),
  def("order", "date_from", "Datum von (ERP)", "Erster Gültigkeitstag (ERP-Alias zu datum_von)"),
  def(
    "order",
    "datum_bis",
    "Datum bis",
    "Letzter Gültigkeitstag der Maßnahme, Format TT.MM.JJJJ. In den Akquise-Mails stattdessen das Ablaufdatum des Rabatts",
  ),
  def("order", "date_to", "Datum bis (ERP)", "Letzter Gültigkeitstag (ERP-Alias zu datum_bis)"),
  def(
    "order",
    "uhrzeit_von",
    "Uhrzeit von",
    "Beginn der täglichen Gültigkeit, z. B. 07:00. Das Template setzt kein „Uhr“ dahinter",
  ),
  def(
    "order",
    "uhrzeit_bis",
    "Uhrzeit bis",
    "Ende der täglichen Gültigkeit, z. B. 18:00. Das Template setzt kein „Uhr“ dahinter",
  ),
  def(
    "order",
    "lange",
    "Länge",
    "Ausdehnung der Zone einschließlich Einheit, z. B. 20 m. Das Template ergänzt kein „m“",
  ),
  def("order", "length", "Länge (ERP)", "Ausdehnung der Zone (ERP-Alias zu lange)"),
  def(
    "order",
    "wofur",
    "Wofür",
    "Grund bzw. Zweck der Maßnahme, z. B. Umzug oder Ladetätigkeiten",
  ),
  def(
    "order",
    "detaillierte.angaben",
    "Detaillierte Angaben",
    "Beschreibung der Maßnahme als Freitext. Steht im Verkehrssicherungs-Layout an der Stelle, an der im Halteverbots-Layout Ausdehnung und Grund stehen",
  ),
  def(
    "order",
    "genehmigung_prozess_kunde",
    "Genehmigung (Kunde)",
    "Satzbaustein in Kundensprache, wer die Genehmigung beantragt. Erwartet Fließtext, keinen Statuscode, z. B. „wird von uns beantragt“",
  ),
  def(
    "order",
    "genehmigung_prozess_aufsteller",
    "Genehmigung (Aufsteller)",
    "Satzbaustein mit der Genehmigungsvorgabe an den Aufsteller, z. B. „liegt bei, bitte nicht erneut beantragen“",
  ),
  def(
    "order",
    "datum.vier.tage.vor.ablauf",
    "Datum vier Tage vor Ablauf",
    "Rückmeldefrist des Kunden, berechnet als vier Tage vor Ablauf der Genehmigung. Ableitbar aus datum_bis, muss nicht separat gepflegt werden",
  ),
  def(
    "order",
    "problem",
    "Problem",
    "Bei der Kontrollfahrt festgestellter Mangel. Ohne Schlusspunkt liefern, den setzt das Template",
  ),
  def(
    "order",
    "minuten.dauer",
    "Minuten Dauer",
    "Dauer der Mangelbehebung, sobald sie über fünf Minuten liegt, z. B. 25 Minuten. Löst die Zusatzkosten aus",
  ),
  def(
    "order",
    "label",
    "Label",
    "Bezeichnung der zuletzt genutzten Dienstleistung, z. B. Halteverbotszone oder Baustellensicherung",
  ),
  def(
    "order",
    "amt_telefon",
    "Amt Telefon",
    "Telefonnummer der für den Auftrag zuständigen Behörde. Generisch – hängt an der Stadt, nicht am Kunden",
  ),
  def(
    "order",
    "vorlaufzeit_stadt",
    "Vorlaufzeit Stadt",
    "Von der Stadt geforderte Vorlaufzeit, im Dativ, z. B. 14 Werktagen. Generisch – hängt an der Stadt",
  ),
  def("order", "durchgehend", "Durchgehend", "Angabe, ob die Zone durchgehend gilt"),
  def("order", "both_sides", "Beide Seiten", "Angabe, ob beide Straßenseiten betroffen sind"),
  def("order", "gesamtpreis", "Gesamtpreis", "Gesamtpreis des Auftrags einschließlich Währungszeichen"),
  def("order", "stadt_name", "Stadt Name", "Name der Stadt (ERP)"),
  def("order", "stadt_email", "Stadt E-Mail", "E-Mail der zuständigen Behörde"),
  def("order", "stadt_tel", "Stadt Telefon", "Telefon der zuständigen Behörde"),
  def("order", "aufstellfrist", "Aufstellfrist", "Geforderte Aufstellfrist"),
  def(
    "order",
    "aufstellerpreis",
    "Aufstellerpreis",
    "Zuletzt vom Aufsteller für diese Stadt angebotener Nettopreis. Kommt aus der Aufsteller-Preisliste, nicht aus dem Auftrag",
  ),
  def("order", "permit_included", "Genehmigung inklusive", "Ob die Genehmigung im Preis enthalten ist"),
  def(
    "order",
    "bwb.id",
    "BWB-ID",
    "Auftrags-ID der Berliner Wasserbetriebe. Bewusst kundenspezifisch benannt, gilt nur für BWB-Havarie-Aufträge",
  ),
  def(
    "order",
    "polizei.vorgangsnummer",
    "Polizei Vorgangsnummer",
    "Polizeiliche Vorgangsnummer der Gefahrenstelle. Bewusst kundenspezifisch benannt, gilt nur für Polizeiaufträge",
  ),
  def(
    "order",
    "gefahrenstellen.stand.datum",
    "Gefahrenstellen Stand Datum",
    "Stichtag der Gefahrenstellen-Übersicht. Generisch – gilt für jeden Auftraggeber mit Gefahrenstellen-Reporting, nicht nur BA Pankow",
  ),
  def(
    "order",
    "KW",
    "KW",
    "Kalenderwoche als reine Zahl, z. B. 33. Das Template schreibt „KW“ davor. Generisch für Anlieferung, Protokollstand und Unterlagenversand",
  ),
  def(
    "order",
    "kw.gg",
    "KW GG",
    "Kalenderwoche für Grün und Gruga. Inhaltlich identisch mit KW, sollte zusammengelegt werden",
  ),
  def(
    "order",
    "KW_von",
    "KW von",
    "Erste Kalenderwoche einer Spanne, z. B. KW 27. Nur für Zeitraum-Angaben, für Einzelwochen gilt KW",
  ),
  def(
    "order",
    "KW_bis",
    "KW bis",
    "Letzte Kalenderwoche einer Spanne, z. B. KW 31",
  ),
  def(
    "order",
    "Datum",
    "Datum",
    "Termindatum für An- oder Abtransport – ein eigener Termin, nicht der Gültigkeitszeitraum aus datum_von. In #195 zweckentfremdet für den Sammelrechnungszeitraum",
  ),
  def(
    "order",
    "Uhrzeit",
    "Uhrzeit",
    "Zeitfenster des An- oder Abtransports als Spanne, z. B. 08:00 und 12:00 Uhr. Nicht identisch mit uhrzeit_von und uhrzeit_bis",
  ),
  def(
    "order",
    "sammelrechnung.monat",
    "Sammelrechnung Monat",
    "Abrechnungsmonat der Sammelrechnung. Generisch – gilt für alle Sammelrechnungskunden, nicht nur Grün und Gruga",
  ),
  def(
    "order",
    "sammelrechnung.jahr",
    "Sammelrechnung Jahr",
    "Abrechnungsjahr der Sammelrechnung. Generisch – gilt für alle Sammelrechnungskunden",
  ),
  def(
    "order",
    "code.wiedergutmachung",
    "Code Wiedergutmachung",
    "Gutscheincode, der nach einer fehlerhaften Ausführung vergeben wird. Generisch – nicht an einen bestimmten Rabattbetrag gebunden",
  ),
  def(
    "order",
    "rabatt",
    "Rabatt",
    "Rabatthöhe in den Akquise- und Reaktivierungsmails, z. B. 10 %. Das Ablaufdatum steht in datum_bis",
  ),
  def(
    "order",
    "preisliste",
    "Preisliste",
    "Fertig gerenderter Block mit den geänderten Preisen je Stadt. Kein Einzelwert",
  ),
  def(
    "order",
    "pauschale",
    "Pauschale",
    "Zusätzliche Gebühr, die eine Stadt auf den Auftrag aufschlägt, mit Währungszeichen. Generisch – gilt für jede Stadt mit Zusatzgebühr",
  ),
  def(
    "order",
    "ortsbesichtigung_preis",
    "Ortsbesichtigung Preis",
    "Preis für eine Ortsbesichtigung, z. B. 50,00 € zzgl. 19 % MwSt.",
  ),
  def(
    "order",
    "anzahlung",
    "Anzahlung",
    "Fälliger Anzahlungsbetrag mit Währungszeichen",
  ),
  def(
    "order",
    "zusatzkosten",
    "Zusatzkosten",
    "Mehrkosten für eine aufwendige Mangelbehebung bei der Wartung, mit Währungszeichen",
  ),
  def(
    "order",
    "gesamtpreis_brutto",
    "Gesamtpreis brutto",
    "Angebotssumme brutto einschließlich MwSt. und Genehmigungsgebühr, mit Währungszeichen",
  ),
  def(
    "order",
    "angebotssumme",
    "Angebotssumme",
    "Angebotssumme brutto. Gleiches ERP-Feld wie gesamtpreis_brutto, sollte zusammengelegt werden",
  ),

  // Invoice
  def(
    "invoice",
    "rechnungsnummer",
    "Rechnungsnummer",
    "Rechnungsnummer der Einzelrechnung. Steht auch im Betreff der Mahnungen",
  ),
  def(
    "invoice",
    "rechnung",
    "Rechnung",
    "Rechnungsnummer der Anzahlungsrechnung. Gleiches ERP-Feld wie rechnungsnummer, sollte zusammengelegt werden",
  ),
  def(
    "invoice",
    "rechnungsdatum",
    "Rechnungsdatum",
    "Ausstellungsdatum der Rechnung, Format TT.MM.JJJJ",
  ),
  def(
    "invoice",
    "rechnungsbetrag",
    "Rechnungsbetrag",
    "Offener Rechnungsbetrag brutto einschließlich Währungszeichen, z. B. 148,75 €",
  ),
  def(
    "invoice",
    "mahngebuehr",
    "Mahngebühr",
    "Aufgeschlagene Mahngebühr einschließlich Währungszeichen, z. B. 5,00 €",
  ),
  def(
    "invoice",
    "mahnung",
    "Mahngebühr (ERP)",
    "Aufgeschlagene Mahngebühr (ERP-Alias zu mahngebuehr)",
  ),
  def(
    "invoice",
    "gesamtbetrag",
    "Gesamtbetrag",
    "Rechnungsbetrag plus Mahngebühr. Rechnerisch abgeleitet, muss im ERP nicht separat gepflegt werden",
  ),
  def(
    "invoice",
    "rechnungsliste",
    "Rechnungsliste",
    "Fertig gerenderter Block mit allen offenen Rechnungen und Download-Links. Kein Einzelwert, sondern HTML",
  ),

  // Meta
  def("meta", "subject", "Betreff (Param)", "Betreffzeile als Param (selten)"),
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
