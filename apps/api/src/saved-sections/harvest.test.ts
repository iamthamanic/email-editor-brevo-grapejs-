/**
 * Unit tests for Textbausteine harvest split/coalesce.
 * Location: apps/api/src/saved-sections/harvest.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coalesceParagraphs,
  extractHarvestCandidates,
  hashPlain,
  splitParagraphHtml,
  titleFromPlain,
} from "./harvest.js";

describe("harvest split/coalesce", () => {
  it("splits <p> and merges anrede + gruß + auftragsdetails fields", () => {
    const html = `
      <p>Sehr geehrte/r #KUNDE_NAME#,</p>
      <p>wir möchten Sie nochmals freundlich an den offenen Betrag erinnern. Leider kein Zahlungseingang.</p>
      <p>Sollten Sie den Betrag bereits überwiesen haben, senden Sie uns bitte einen Nachweis.</p>
      <p>Falls wir innerhalb der nächsten Tage keinen Zahlungseingang feststellen können, melden wir uns.</p>
      <p>Vielen Dank für Ihre Aufmerksamkeit und Ihr Vertrauen.</p>
      <p>Mit freundlichen Grüßen</p>
      <p>Ihre Browo GmbH</p>
      <p>Auftragsdetails</p>
      <p>Bestellnummer: HV123-#BESTELLNR#</p>
      <p>Ort der Einrichtung: #ADRESSE#</p>
      <p>Datum: #DATUM_VON# bis #DATUM_BIS#</p>
      <p>Wusstest du schon?</p>
      <p>In unserem Kundenportal kannst du jederzeit den Status deiner Bestellung verfolgen. Außerdem findest du dort alle deine Rechnungen.</p>
    `;
    const editorData = {
      __etsImport: 1,
      components: [
        {
          type: "email-section",
          sectionRole: "header",
          attributes: { "data-role": "header" },
          components: [],
        },
        {
          type: "email-section",
          sectionRole: "content",
          attributes: { "data-role": "content" },
          components: [
            {
              type: "email-row",
              components: [
                {
                  type: "email-column",
                  components: [
                    { type: "email-text", content: html },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "email-section",
          sectionRole: "footer",
          attributes: { "data-role": "footer" },
          components: [
            {
              type: "email-text",
              content: "<p>Browo GmbH</p><p>Späthstraße 144</p>",
            },
          ],
        },
      ],
    };

    const found = extractHarvestCandidates(editorData);
    assert.ok(found.length >= 5, `expected >=5 snippets, got ${found.length}`);
    // Footer must not appear
    assert.ok(!found.some((c) => /Späthstraße/i.test(c.plain)));

    const titles = found.map((c) => c.name);
    assert.ok(
      titles.some((t) => /wir möchten Sie nochmals/i.test(t) || /Sehr geehrte/i.test(t)),
      `titles=${titles.join(" | ")}`,
    );
    assert.ok(titles.some((t) => /Auftragsdetails/i.test(t)));
    assert.ok(titles.some((t) => /Wusstest du schon/i.test(t)));

    // Dedup within extract
    const hashes = found.map((c) => c.hash);
    assert.equal(new Set(hashes).size, hashes.length);
  });

  it("titleFromPlain uses first line truncated", () => {
    const t = titleFromPlain(
      "Auftragsdetails\nBestellnummer: HV123\nOrt: Berlin",
    );
    assert.equal(t, "Auftragsdetails");
  });

  it("hashPlain is stable for whitespace", () => {
    assert.equal(hashPlain("Hallo  Welt"), hashPlain("hallo welt"));
  });

  it("coalesce merges gruss into previous", () => {
    const paras = splitParagraphHtml(
      "<p>Vielen Dank für Ihre Aufmerksamkeit und Ihr Vertrauen.</p><p>Mit freundlichen Grüßen</p><p>Ihre Browo GmbH</p>",
    );
    const merged = coalesceParagraphs(paras);
    assert.equal(merged.length, 1);
    assert.match(merged[0]!.plain, /Mit freundlichen Grüßen/);
    assert.match(merged[0]!.plain, /Browo/);
  });
});
