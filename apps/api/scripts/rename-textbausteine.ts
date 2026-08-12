/**
 * One-shot: rename Textbausteine to specific purpose titles (no vague "Info").
 * Usage: cd apps/api && npx tsx scripts/rename-textbausteine.ts
 * Location: apps/api/scripts/rename-textbausteine.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MAX_LEN = 78;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, " ");
}

function plainText(sectionData: Record<string, unknown>): string {
  return decodeEntities(String(sectionData.content ?? ""))
    .replace(/\{\{\s*params\.([a-zA-Z0-9_.]+)\s*\}\}/g, "[$1]")
    .replace(/#([A-Z0-9_]+)#/g, "[$1]")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max = MAX_LEN): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 18 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

function stripAutoPrefix(name: string): string {
  return name
    .replace(
      /^(Anrede|Gruß|Auftrag|Genehmigung|Aufstellung|Rechnung|Mahnung|Storno|Wartung|Bewertung|Hinweis|CTA|Variable|Sonstiges|Info|Danke|Anhang|Kontakt|Preis|Zusatzkosten|Angebot|Reaktivierung|AGB|Zahlung|Antrag|Behörde|Feedback|Netzwerk|Willkommen|Service|Nachfrage|Termin|Abbau|Bestandskunde|Text|Mitteilung|Bitte|Falls|Begründung|Voraussetzung)\s*[–-]\s*/i,
      "",
    )
    .replace(/\s*\(\d+\)\s*$/, "")
    .trim();
}

function stripGreeting(raw: string): string {
  return raw
    .replace(/^sehr geehrte\/?r?\s+[^\s,]+(?:\s+[^\s,]+)?\s*,?\s*/i, "")
    .replace(/^sehr geehrte damen und herren,?\s*/i, "")
    .replace(/^hallo\s+[^\s,]+,?\s*/i, "")
    .replace(/^liebe[r]?\s+[^\s,]+,?\s*/i, "")
    .replace(/^hi\s+[^\s,]+,?\s*/i, "")
    .trim();
}

function titled(prefix: string, detail: string): string {
  const d = detail.replace(/\s+/g, " ").trim().replace(/^[.,;:\s]+/, "");
  return clip(`${prefix} – ${d.charAt(0).toUpperCase()}${d.slice(1)}`);
}

type Rule = { re: RegExp; title: string };

/** First match wins — order = specificity. */
const RULES: Rule[] = [
  // --- Soft leftovers: very specific phrases first ---
  { re: /kurzfristigkeitspauschale|stadt essen erhebt/i, title: "Behörde – Kurzfristigkeitspauschale Essen" },
  { re: /letzte mahnung|trotz mehrmaliger erinnerung.*unbezahlt/i, title: "Mahnung – Letzte Mahnung" },
  { re: /ausstehenden betrag zuzüglich der mahngebühren|fordern sie auf, den ausstehenden/i, title: "Mahnung – Frist 3 Tage + Mahngebühr" },
  { re: /offene rechnungen\s*\[/i, title: "Rechnung – Offene Rechnungen Liste" },
  { re: /rechnungsdetails\s*rechnungsnummer/i, title: "Rechnung – Details Betrag/Mahnung" },
  { re: /begleichen sie den rechnungsbetrag innerhalb von 14/i, title: "Rechnung – Zahlungsziel 14 Tage" },
  { re: /zahlungsnachweis/i, title: "Zahlung – Nachweis erbeten" },
  { re: /bereits bezahlt haben, erstatten|rückzahlung noch angaben/i, title: "Zahlung – Erstattung / Rückzahlung" },
  { re: /ausbleibender zahlung.*aufstellung gefährdet/i, title: "Zahlung – Aufstellung sonst gefährdet" },
  // Angebot / AGB: distinguish near-duplicates BEFORE generic rules
  // plainText maps {{ params.x }} → [x]
  {
    re: /gesamtpreis brutto:.*\[angebotssumme\]|\[angebotssumme\].*inkl/i,
    title: "Angebot – Gesamtpreis brutto (Angebotssumme)",
  },
  {
    re: /gesamtpreis brutto:.*\[gesamtpreis_brutto\]|inkl\.\s*19.*genehmigungsgebühr/i,
    title: "Angebot – Gesamtpreis brutto inkl. Genehmigung",
  },
  {
    re: /damit wir ihnen ein passendes angebot erstellen können, benötigen wir vorab/i,
    title: "Angebot – Vorab Angaben für Angebot erbeten",
  },
  {
    re: /sobald uns ihre angaben vorliegen, erstellen wir ihnen kurzfristig ein angebot/i,
    title: "Angebot – Angebot folgt nach Ihren Angaben",
  },
  {
    re: /kalkulieren sie uns den nettopreis inklusive genehmigungsgebühr/i,
    title: "Angebot – Partner: Nettopreis inkl. Genehmigung kalkulieren",
  },
  {
    re: /senden sie uns ihr angebot an folgende e-mail-adresse:\s*angebot@|angebot@halteverbot/i,
    title: "Angebot – Partner: Angebot an angebot@ senden",
  },
  {
    re: /nach der ordnungsgemäßen aufstellung der schilder.*keine haftung|für nach der ordnungsgemäßen aufstellung/i,
    title: "AGB – Keine Haftung nach Aufstellung (Punkt D)",
  },
  {
    re: /etwaige spätere veränderung|etwaiige spätere veränderung|spätere veränderung von ordnungsgemäß aufgestellten schilder/i,
    title: "AGB – Keine Haftung bei Schildänderung (Punkt D)",
  },
  {
    re: /verbindlichen beauftragung.*geschäftsbedingungen zugestimmt|auszug aus unseren allgemeinen geschäftsbedingungen absatz d/i,
    title: "AGB – Zustimmung + Auszug Abs. D Pkt. 3",
  },
  {
    re: /^\(?\s*siehe dazu bitte unsere agb punkt d/i,
    title: "AGB – Kurzverweis Punkt D (Link)",
  },
  { re: /gesamtpreis brutto:/i, title: "Angebot – Gesamtpreis brutto" },
  { re: /preise für einzelne städte|gestiegene kosten für material/i, title: "Preis – Städteanpassung ab Datum" },
  { re: /zuletzt für \[stadt\] angebotener preis|aufstellerpreis/i, title: "Preis – Stadt-Angebot Aufsteller" },
  { re: /pauschale\] berechnet|zusätzlich \[pauschale\]/i, title: "Preis – Zusatzpauschale weitergeben" },
  { re: /schriftliche bestätigung der kostenübernahme/i, title: "Auftrag – Kostenübernahme bestätigen" },
  { re: /noch keine auftragsbestätigung darstellt/i, title: "Auftrag – Noch keine Bestätigung" },
  { re: /verbindliche auftragsbestätigung per e-mail|angaben werden nun von uns geprüft/i, title: "Auftrag – Prüfung vor Bestätigung" },
  { re: /auftrag wurde kürzlich erfolgreich abgeschlossen/i, title: "Auftrag – Erfolgreich abgeschlossen" },
  { re: /entschuldigen|nicht alles so (gelaufen|verlaufen)|kosten werden komplett zurück/i, title: "Auftrag – Entschuldigung / Erstattung" },
  { re: /herzlich willkommen bei halteverbot/i, title: "Willkommen – Neukunde begrüßen" },
  { re: /langjährige zusammenarbeit mit halteverbot|schätzen ihre langjährige/i, title: "Danke – Langjährige Zusammenarbeit" },
  { re: /nächsten vorhaben erneut unterstützen|freuen uns auf ihre empfehlung/i, title: "Reaktivierung – Nächstes Vorhaben / Empfehlung" },
  { re: /lag es an uns, oder besteht aktuell kein bedarf/i, title: "Reaktivierung – Nachfrage ob Bedarf" },
  { re: /viel erfolg und einen reibungslosen/i, title: "Gruß – Erfolgswunsch zum Vorhaben" },
  { re: /danken vielmals für die bearbeitung/i, title: "Danke – Für Behörden-Bearbeitung" },
  { re: /bedanken uns für (ihre )?beauftragung/i, title: "Auftrag – Danke Beauftragung + Hinweis" },
  { re: /genehmigung rechtzeitig erteilt wird, hängt|ob und wann die anordnung erteilt/i, title: "Genehmigung – Timing liegt bei Behörde" },
  { re: /genehmigung wurde erteilt, allerdings mit/i, title: "Genehmigung – Erteilt mit Abweichung" },
  { re: /bis wann die genehmigung verlängert/i, title: "Genehmigung – Bis-wann Verlängerung?" },
  { re: /auch für die verlängerung die bearbeitungszeit/i, title: "Genehmigung – Verlängerung Vorlauf einplanen" },
  { re: /rückmeldung der zuständigen behörde.*abgelehnt|beantragung.*abgelehnt/i, title: "Genehmigung – Behörde hat abgelehnt" },
  { re: /rückmeldung der zuständigen behörde zu ihrem antrag/i, title: "Genehmigung – Behörden-Rückmeldung" },
  { re: /verlängerung der bald ablaufenden genehmigungen.*beantragt/i, title: "Genehmigung – Verlängerung beantragt" },
  { re: /geänderte zone für ihr vorhaben/i, title: "Genehmigung – Geänderte Zone prüfen" },
  { re: /schilder erst nach vorliegen der behördlichen anordnung/i, title: "Aufstellung – Erst nach Anordnung" },
  { re: /genehmigung umgehend als antwort/i, title: "Genehmigung – Bitte umgehend zusenden" },
  { re: /jahresgenehmigung eines containerdienstes/i, title: "Genehmigung – Einzelanordnung nötig" },
  { re: /sobald uns die erlaubnis vorliegt/i, title: "Auftrag – Weiter nach Erlaubnis" },
  { re: /anordnung nicht rechtzeitig.*abschleppen/i, title: "Hinweis – Ohne Anordnung kein Abschleppen" },
  { re: /ortsbesichtigung/i, title: "Service – Ortsbesichtigung gegen Aufpreis" },
  { re: /kartenmaterial|fotos als antwort auf diese e-mail/i, title: "Antrag – Fotos / Karten für Einreichung" },
  { re: /wie sie verfahren möchten/i, title: "Nachfrage – Wie möchten Sie verfahren?" },
  { re: /partnerfirmen durchgeführt|beschilderung bzw\.? sicherung haben von uns/i, title: "Aufstellung – Durch Partnerfirmen" },
  { re: /detaillierte aufstellung der einzelnen positionen/i, title: "Rechnung – Positionsaufstellung Anlage" },
  { re: /änderungswünsche können zu mehrkosten/i, title: "Hinweis – Änderungen können Mehrkosten" },
  { re: /material.*frei zugänglich|abholung wegen fehlender zugänglichkeit/i, title: "Abbau – Material zugänglich halten" },
  { re: /abholungsbestätigung per e-mail/i, title: "Abbau – Abholbestätigung folgt" },
  { re: /gefahrenstelle wurde soeben geräumt|maßnahme dennoch zurückgebaut/i, title: "Wartung – Gefahrenstelle geräumt" },
  { re: /maßnahme wurde soeben aufgestellt|auftragsprotokoll finden sie im anhang/i, title: "Aufstellung – Soeben aufgestellt + Protokoll" },
  { re: /anträge wurden bei den zuständigen stellen eingereicht/i, title: "Antrag – Eingereicht, Anordnung folgt" },
  { re: /übersicht zu prüfen und uns bei rückfragen/i, title: "Hinweis – Übersicht prüfen" },
  { re: /bestellung zu diesem auftrag per e-mail.*abrechnen/i, title: "Auftrag – Bestellung für Abrechnung fehlt" },
  { re: /skizze dann entsprechend an/i, title: "Antrag – Skizze bei Bedarf anpassen" },
  { re: /angaben je container/i, title: "Antrag – Angaben je Container" },
  { re: /angabe eines kennzeichens|kennzeichen ihres privatfahrzeugs|ohne diese angabe können wir keine genehmigung/i, title: "Antrag – Kennzeichen erforderlich" },
  { re: /angepassten antrag zeitnah erneut ein/i, title: "Antrag – Alternative → Neu einreichen" },
  { re: /termin für sie nicht passen/i, title: "Termin – Umbuchen falls unpassend" },

  // Kontakt
  { re: /\+49\s*\(?0\)?30\s*627|telefonisch unter|rufnummer \+49/i, title: "Kontakt – Telefon-Hotline Berlin" },
  { re: /zurückzurufen|bitte.*anrufen|rufen sie uns/i, title: "Kontakt – Rückruf erbeten" },

  // Bewertung / Feedback
  { re: /g\.page\/r\/|https:\/\/g\.page/i, title: "Bewertung – Google-Bewertungslink" },
  { re: /jetzt bei google bewerten|bewertung bei google|kurze bewertung bei google/i, title: "Bewertung – Bitte um Google-Review" },
  { re: /ehrliches feedback|ihre meinung ist uns|ihre zufriedenheit ist uns/i, title: "Bewertung – Feedback erbeten" },
  { re: /abläufe zu verbessern|freuen wir uns auf ihr feedback/i, title: "Feedback – Abläufe verbessern" },

  // Mahnung / Zahlung
  { re: /inkasso/i, title: "Mahnung – Androhung Inkasso" },
  { re: /zusatzrechnung/i, title: "Mahnung – Zusatzrechnung offen" },
  { re: /(nochmals|erneut|wiederholt).{0,50}(betrag|rechnung|zahlung)/i, title: "Mahnung – Zweite Zahlungserinnerung" },
  { re: /keinen zahlungseingang|zahlungseingang.*nicht|zahlungserinner|offen(en)? betrag|erinnern.*rechnung/i, title: "Mahnung – Zahlungserinnerung" },
  { re: /überweisungen kann es.{0,40}7 werktage|bis zu 7 werktage.*zahlung/i, title: "Zahlung – Buchung bis 7 Werktage" },
  { re: /differenz.*(überweisen|zahlen|bank)/i, title: "Zahlung – Differenzbetrag überweisen" },
  { re: /restbetrag.*nach abschluss|restbetrag stellen wir/i, title: "Rechnung – Restbetrag nach Abschluss" },
  { re: /anzahlung bereits überwiesen/i, title: "Rechnung – Anzahlung Nachweis erbeten" },
  { re: /anzahlung/i, title: "Rechnung – Anzahlung vereinbart" },
  { re: /gutschrift/i, title: "Rechnung – Gutschrift im Anhang" },
  { re: /sammelrechnung/i, title: "Rechnung – Sammelrechnung Anhang" },
  { re: /sammelgebührenbescheid|sammelgebuehrenbescheid/i, title: "Rechnung – Sammelgebührenbescheid" },
  { re: /preisliste/i, title: "Rechnung – Preisliste Anhang" },
  { re: /anbei.{0,50}rechnung|übersenden wir ihnen ihre rechnung|ihre rechnung \[|rechnung zu (ihrer|dem|unserem)/i, title: "Rechnung – Rechnung im Anhang" },
  { re: /angebot ist 14 tage/i, title: "Angebot – 14 Tage gültig" },
  { re: /bisherigen konditionen|vor dem stichtag/i, title: "Preis – Alt-Konditionen bis Stichtag" },

  // Storno
  { re: /zone nicht mehr benötigen/i, title: "Storno – Zone nicht mehr benötigt" },
  { re: /verkehrssicherung nicht mehr benötigen/i, title: "Storno – Sicherung nicht mehr benötigt" },
  { re: /stornierungswunsch|auftrag stornieren|storniert haben/i, title: "Storno – Stornierungswunsch bestätigt" },

  // Genehmigung / Behörde
  { re: /ablehnungsbescheid/i, title: "Genehmigung – Ablehnungsbescheid Anhang" },
  { re: /verkehrszeichenplan.{0,40}(prüfung|freigabe)/i, title: "Genehmigung – VZP zur Freigabe" },
  { re: /verkehrszeichenplan/i, title: "Genehmigung – Verkehrszeichenplan Anhang" },
  { re: /verkehrsrechtliche anordnung/i, title: "Genehmigung – Verkehrsrechtliche Anordnung" },
  { re: /sondernutzungserlaubnis/i, title: "Genehmigung – Sondernutzungserlaubnis" },
  { re: /amtliche genehmigung|genehmigung für ihre unterlagen|anbei.{0,40}genehmigung/i, title: "Genehmigung – Amtliche Freigabe Anhang" },
  { re: /genehmigung.{0,30}nicht.{0,20}eingegangen|nicht bei uns eingegangen/i, title: "Genehmigung – Noch nicht eingegangen" },
  { re: /kurzfristigkeit.{0,40}(bestellung|vorlauf)|vorlaufzeit.{0,40}(unterschritten|nicht garantiert)|rechtzeitige? (erhalt|genehmigung).{0,20}nicht garantiert/i, title: "Genehmigung – Kurzfristig ohne Garantie" },
  { re: /verlängerung bei der zuständigen behörde|ob wir eine verlängerung/i, title: "Genehmigung – Verlängerung Rückmeldung nötig" },
  { re: /genehmigung für ihre maßnahme läuft/i, title: "Genehmigung – Läuft ab, Verlängerung?" },
  { re: /auch wenn.{0,40}nicht zur erteilung einer genehmigung/i, title: "Genehmigung – Aufwand trotz Ablehnung" },
  { re: /amt ist berechtigt, änderungen|darauf haben wir keinerlei einfluss/i, title: "Behörde – Änderungen ohne unseren Einfluss" },
  { re: /anfertigung des verkehrszeichenplans|beantragung der verkehrsrechtlichen/i, title: "Genehmigung – Leistungen im Antrag" },
  { re: /nach erhalt der genehmigung die einrichtung/i, title: "Genehmigung – Nächster Schritt nach Freigabe" },
  { re: /straßensperrung|verkehrssicherung gemäß genehmigungs/i, title: "Genehmigung – Sperrung laut Auflage" },
  { re: /was sie selbst beantragen|pflichtangaben.*antragsformular/i, title: "Genehmigung – Ihre Pflichtangaben" },
  { re: /was wir für sie übernehmen/i, title: "Genehmigung – Unsere Leistungen" },
  { re: /den antrag haben wir gestellt/i, title: "Antrag – Gestellt, Schilder folgen" },
  { re: /konkrete skizze von ihnen|skizze.{0,30}behörde/i, title: "Antrag – Skizze für Behörde nötig" },
  { re: /gewünschte datum unterschreitet|aufstellfrist für die halteverbot/i, title: "Genehmigung – Vorlaufzeit zu kurz" },

  // Aufstellung / Schilder
  { re: /negativliste.{0,30}aufstell|aufstell.{0,30}negativliste/i, title: "Aufstellung – Negativliste + Protokoll" },
  { re: /negativliste/i, title: "Aufstellung – Negativliste Anhang" },
  { re: /aufstellprotokoll/i, title: "Aufstellung – Protokoll Anhang" },
  { re: /fotos des gewünschten bereichs|gut erkennbare fotos/i, title: "Aufstellung – Fotos vom Bereich reichen" },
  { re: /schilder fristgerecht einrichten/i, title: "Aufstellung – Schilder fristgerecht" },
  { re: /halteverbotszone|halteverbotsschild/i, title: "Aufstellung – Halteverbotszone" },
  { re: /baustellensicherung erst mit beginn/i, title: "Aufstellung – Erst ab Anordnung" },

  // Wartung / Havarie / Polizei
  { re: /nicht um eine havarie|havarie-maßnahme/i, title: "Wartung – Kein Havarie-Einsatz" },
  { re: /havarie/i, title: "Wartung – Havarie-Hinweis" },
  { re: /wartungsprotokoll|(wöchentliche|monatliche) protokoll/i, title: "Wartung – Protokoll Anhang" },
  { re: /wartung.*kontrollfahrt|kontrollfahrt.*problem|problem festgestellt/i, title: "Wartung – Problem bei Kontrolle" },
  { re: /bwb-notdienst/i, title: "Wartung – BWB-Notdienst" },
  { re: /gefahrenstellen/i, title: "Wartung – Offene Gefahrenstellen" },
  { re: /fehlendem material|fehlendes material/i, title: "Wartung – Fehlendes Material melden" },
  { re: /bislang keine freigabe zur beräumung|noch gesichert sind/i, title: "Wartung – Noch gesichert, keine Beräumung" },
  { re: /polizeilichen einsatz hinaus|angebot für die weitere verkehrssicherung/i, title: "Angebot – Weiterführung nach Polizei-Einsatz" },
  { re: /im auftrag der polizei/i, title: "Auftrag – Sicherung für Polizei" },

  // Zusatzkosten
  { re: /keine zusätzlichen kosten|nicht länger als 5 minuten dauerte.*keine/i, title: "Zusatzkosten – Keine (unter 5 Min.)" },
  { re: /länger als 5 minuten|zusatzkosten|zusätzlichen? kosten|zusätzliche kosten/i, title: "Zusatzkosten – Erhöhter Aufwand" },
  { re: /behebung einen erhöhten aufwand/i, title: "Zusatzkosten – Erhöhter Aufwand" },

  // Auftrag / Partner
  { re: /^auftragsdetails|auftragsdetails\b/i, title: "Auftrag – Details Bestellnr./Ort/Datum" },
  { re: /datum:.*uhrzeit:.*ausdehnung:|datum_von.*uhrzeit_von/i, title: "Auftrag – Datum/Uhrzeit/Länge-Block" },
  { re: /änderung bzw|problemfall/i, title: "Auftrag – Änderung oder Problemfall" },
  { re: /vielen dank für die freigabe/i, title: "Auftrag – Danke für Freigabe" },
  { re: /übernahme des materials/i, title: "Auftrag – Materialübernahme bestätigt" },
  { re: /hiermit bestätigen wir den auftrag|auftrag befindet sich bereits in bearbeitung/i, title: "Auftrag – Bestätigung / in Bearbeitung" },
  { re: /partner vor ort weitergegeben|leistungen bereits erbracht/i, title: "Auftrag – Partner vor Ort prüft Stand" },
  { re: /fotos der aktuellen situation|zur dokumentation.*fotos/i, title: "Auftrag – Fotodokumentation Anhang" },
  { re: /team war vor ort/i, title: "Auftrag – Einsatz vor Ort erledigt" },
  { re: /vielen dank für den auftrag/i, title: "Auftrag – Danke für den Auftrag" },
  { re: /vielen dank für ihre anfrage/i, title: "Auftrag – Danke für Anfrage" },
  { re: /vielen dank für ihre bestellung/i, title: "Auftrag – Bestelleingang bestätigt" },
  { re: /anbei.{0,30}angebot|finden sie unser angebot/i, title: "Angebot – Angebot im Anhang" },
  { re: /passendes angebot erstellen|angaben vorliegen.*angebot/i, title: "Angebot – Noch Angaben nötig" },

  // Reaktivierung / Bestandskunde
  { re: /in der vergangenheit genutzt|schon lange nichts mehr von ihnen|früher regelmäßig/i, title: "Reaktivierung – Wiedervorlage Bestandskunde" },
  { re: /premium-report.*angekommen|telefonisch zu erreichen.*premium/i, title: "Reaktivierung – Premium-Report prüfen" },
  { re: /als bestandskunde profitieren/i, title: "Bestandskunde – Leistungsvorteile" },
  { re: /netzwerk kontinuierlich erweitern/i, title: "Netzwerk – Später erneut anfragen" },

  // Gruß / Danke (specific)
  { re: /^mit freundlichen grüßen|mit freundlichen grüßen\s*$/im, title: "Gruß – Mit freundlichen Grüßen" },
  { re: /browo gmbh\s*\/\s*halteverbot/i, title: "Gruß – Signatur Browo / halteverbot123" },
  { re: /für rückfragen stehen wir/i, title: "Gruß – Rückfragen + Abschluss" },
  { re: /freuen uns auf ihre rückmeldung/i, title: "Gruß – Rückmeldung erbeten" },
  { re: /vielen dank für die zusammenarbeit/i, title: "Danke – Für die Zusammenarbeit" },
  { re: /vielen dank für ihr verständnis/i, title: "Danke – Für Ihr Verständnis" },
  { re: /vielen dank für ihr vertrauen/i, title: "Danke – Für Ihr Vertrauen" },
  { re: /vielen dank für ihre unterstützung/i, title: "Danke – Für Ihre Unterstützung" },
  { re: /vielen dank für ihre mühe|vielen dank für die mühe/i, title: "Danke – Für Ihre Mühe" },
  { re: /vielen dank für ihre zeitnahe/i, title: "Danke – Für zeitnahe Rückmeldung" },
  { re: /vielen dank für ihre aufmerksamkeit/i, title: "Danke – Für Aufmerksamkeit" },
  { re: /vielen dank im voraus/i, title: "Danke – Im Voraus" },
  { re: /vielen dank, dass sie sich dafür/i, title: "Danke – Für Ihre Zeit (Bewertung)" },
  { re: /vielen dank für die bisherige zusammenarbeit/i, title: "Danke – Bisherige Zusammenarbeit" },
  { re: /vielen dank für ihren auftrag/i, title: "Danke – Für Ihren Auftrag" },
  { re: /^vielen dank\.?$/i, title: "Danke – Kurz" },

  // Hinweis / AGB / Fristen (generic AGB last — specifics above)
  { re: /agb punkt|\/agb\.html|allgemeinen geschäftsbedingungen absatz/i, title: "AGB – Verweis / Auszug" },
  { re: /mindestens.{0,20}werktage|werktage\s*\/\s*mo/i, title: "Hinweis – Mindestvorlauf Werktage" },
  { re: /2× täglich|2x täglich|werktagen.*wochenenden/i, title: "Hinweis – Kontrollfrequenz" },
  { re: /willkommensgeschenk|als dankeschön.*rabatt|rabatt von \[/i, title: "Hinweis – Rabattaktion" },
  { re: /bitte beachten sie die amtlichen/i, title: "Hinweis – Amtliche Hinweise beachten" },
  { re: /screenshot aus google maps|google maps.*screenshot/i, title: "Hinweis – Skizze via Google Maps" },
  { re: /genaue adresse sowie/i, title: "Hinweis – Adresse & Maße für Antrag" },
  { re: /namen der spedition|kennzeichen des fahrzeugs/i, title: "Hinweis – Spedition & Kennzeichen" },
  { re: /~?\d+[.,]?\d*\s*t\b.*(?:transporter|lkw|sprinter)/i, title: "Hinweis – Fahrzeugklasse / Gewicht" },
  { re: /kubikmeter|m³.*container/i, title: "Hinweis – Container-Kubikmeter" },
  { re: /persönliche ansprechpartner/i, title: "Hinweis – Feste Ansprechpartner" },
  { re: /bitte prüfen sie den vorgang/i, title: "Hinweis – Vorgang prüfen" },
  { re: /unterlagen zu prüfen/i, title: "Hinweis – Unterlagen prüfen lassen" },
  { re: /gehwegbreite/i, title: "Hinweis – Gehwegbreite beachten" },
  { re: /vollmachten/i, title: "Hinweis – Vollmachten nachreichen" },
  { re: /wussten sie schon/i, title: "Hinweis – Wussten Sie schon?" },
  { re: /baustelle künftig.*zustand/i, title: "Hinweis – Baustelle sauber hinterlassen" },

  // Anhang generic patterns (after more specific)
  { re: /anbei erhalten sie die skizze|skizze zu ihrem angefragten/i, title: "Anhang – Skizze zum Vorhaben" },
  { re: /vordruck, den sie bitte ausfüllen/i, title: "Anhang – Vordruck ausfüllen & zurück" },

  // Variable
  { re: /kundennachricht/i, title: "Variable – Kundennachricht" },
  { re: /weitere_infos|weitere infos/i, title: "Variable – Weitere Infos" },

  // CTA
  { re: /^https?:\/\//i, title: "CTA – Externer Link" },
  { re: /hier klicken/i, title: "CTA – Hier-klicken-Aufruf" },
];

function purposeFromText(text: string): string | null {
  const t = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.re.test(text) || rule.re.test(t)) return rule.title;
  }
  return null;
}

/** Last resort: topic from keywords + short hook — never Text/Info/Bitte. */
function fallbackTitle(raw: string): string {
  let s = stripGreeting(raw).replace(/^[\s•·\-–—→]+/, "").trim();
  if (!s) return "Sonstiges – Leerer Baustein";
  if (/^test$/i.test(s) || /^sonstiges – test$/i.test(s)) return "Sonstiges – Testbaustein";

  const t = s.toLowerCase();
  const topic =
    (/genehmig|anordnung|behörde|amt\b/.test(t) && "Genehmigung") ||
    (/schild|aufstell|halteverbot|zone|beschilder/.test(t) && "Aufstellung") ||
    (/rechnung|zahl|betrag|mahn/.test(t) && "Rechnung") ||
    (/angebot|preis|kondition|pauschale/.test(t) && "Preis") ||
    (/auftrag|bestell/.test(t) && "Auftrag") ||
    (/foto|skizze|karte|kennzeichen/.test(t) && "Antrag") ||
    (/abbau|abhol/.test(t) && "Abbau") ||
    (/wartung|havarie|gefahren/.test(t) && "Wartung") ||
    (/dank|freuen|willkommen/.test(t) && "Danke") ||
    "Hinweis";

  return titled(topic, firstWords(s, 7));
}

function firstWords(s: string, n: number): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  let out = words.slice(0, n).join(" ");
  if (words.length > n) out += "…";
  // strip trailing partial punctuation clutter
  return out.replace(/[,:;]+$/, "");
}

function proposeBaseName(text: string, currentName: string): string {
  const seed = stripAutoPrefix(decodeEntities(currentName));
  const raw = text || seed;
  if (!raw || /^[\s·•\-–—]+$/.test(raw)) return "Sonstiges – Leerer Baustein";

  if (/^(\[[\w.]+\]\s*)+$/.test(raw)) {
    const keys = [...raw.matchAll(/\[([\w.]+)\]/g)].map((m) => m[1]);
    return titled("Variable", keys.slice(0, 4).join(", ") || "Param");
  }

  const hit = purposeFromText(raw);
  if (hit) return clip(hit);

  return clip(fallbackTitle(raw));
}

/** Prefer a short content hook over opaque (1)/(2) suffixes. */
function uniquify(
  entries: Array<{ base: string; text: string }>,
): string[] {
  const counts = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const e of entries) counts.set(e.base, (counts.get(e.base) ?? 0) + 1);

  return entries.map(({ base, text }) => {
    const total = counts.get(base) ?? 1;
    if (total === 1) return base;

    const i = (seen.get(base) ?? 0) + 1;
    seen.set(base, i);

    const hook = firstWords(stripGreeting(text) || text, 6)
      .replace(/^[\[\]{},.\s]+/, "")
      .trim();
    if (hook && hook.toLowerCase() !== base.toLowerCase()) {
      const withHook = clip(`${base}: ${hook.charAt(0).toUpperCase()}${hook.slice(1)}`);
      // Only use hook if it actually differentiates
      if (withHook !== base) return withHook;
    }

    const suffix = ` (${i})`;
    const clipped =
      base.length + suffix.length <= MAX_LEN
        ? base
        : clip(base, MAX_LEN - suffix.length);
    return `${clipped}${suffix}`;
  });
}

async function main() {
  const rows = await prisma.emailSavedSection.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true, sectionData: true },
  });
  console.log(`Loaded ${rows.length}`);

  const entries = rows.map((row) => {
    const text = plainText((row.sectionData ?? {}) as Record<string, unknown>);
    return {
      base: proposeBaseName(text, row.name),
      text,
    };
  });
  const unique = uniquify(entries);

  let changed = 0;
  const samples: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const next = unique[i]!;
    if (row.name === next) continue;
    await prisma.emailSavedSection.update({ where: { id: row.id }, data: { name: next } });
    changed += 1;
    if (samples.length < 40) samples.push({ from: row.name.slice(0, 80), to: next });
  }

  console.log(`Updated: ${changed}`);
  console.log("\nSamples:");
  for (const s of samples) console.log(`  "${s.from}"\n  → "${s.to}"\n`);

  const dist = new Map<string, number>();
  for (const n of unique) {
    const p = n.split(" – ")[0] ?? n;
    dist.set(p, (dist.get(p) ?? 0) + 1);
  }
  console.log("Prefix counts:");
  [...dist.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  const numbered = unique.filter((n) => /\(\d+\)\s*$/.test(n));
  console.log(`\nStill numbered suffixes: ${numbered.length}`);
  numbered.slice(0, 25).forEach((n) => console.log(" ", n));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
