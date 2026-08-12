/**
 * Param DOM tokenization + roundtrip expectations.
 * Location: packages/legacy-importer/src/tokenize-richtext.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertBrevoHtml } from "./convert.js";
import {
  paramDisplayLabel,
  richTextToGrapesComponents,
} from "./mapper/tokenizeRichText.js";

describe("richTextToGrapesComponents", () => {
  it("tokenizes params inside text nodes, keeps p structure as HTML string", () => {
    const html =
      "<p>Sehr geehrte/r {{ params.anrede }} {{ params.name }},</p>";
    const comps = richTextToGrapesComponents(html);
    assert.equal(typeof comps, "string");
    const out = String(comps);
    assert.match(out, /<p>/);
    assert.match(out, /data-param-key="anrede"/);
    assert.match(out, /data-param-key="name"/);
    assert.match(out, /email-param/);
    assert.match(out, /Sehr geehrte\/r /);
    // Mustache only inside badge spans, not as raw text outside
    assert.doesNotMatch(
      out.replace(/<span[^>]*>\{\{ params\.[^}]+\}\}<\/span>/g, ""),
      /\{\{\s*params\.anrede\s*\}\}/,
    );
  });

  it("preserves nested param paths", () => {
    const comps = richTextToGrapesComponents(
      "<p>Bis {{ params.datum.vier.tage.vor.ablauf }}</p>",
    );
    assert.match(String(comps), /datum\.vier\.tage\.vor\.ablauf/);
  });

  it("does not tokenize params inside href attributes", () => {
    const html =
      '<p><a href="https://x.test/?id={{ params.bestellnummer }}">Link</a></p>';
    const comps = richTextToGrapesComponents(html);
    const out = String(comps);
    assert.match(
      out,
      /href="https:\/\/x\.test\/\?id=\{\{ params\.bestellnummer \}\}"/,
    );
    assert.doesNotMatch(out, /data-param-key="bestellnummer"/);
  });

  it("uses registry labels when known", () => {
    assert.equal(paramDisplayLabel("anrede"), "Anrede");
    assert.equal(paramDisplayLabel("bestellnummer"), "Bestellnummer");
    assert.match(paramDisplayLabel("datum.vier.tage.vor.ablauf"), /Datum/i);
  });
});

describe("convert param pills", () => {
  it("emits email-param badges for production-like rich text", () => {
    const html = `<table width="600"><tr><td class="nl2go-default-textstyle">
      <p>Sehr geehrte/r {{ params.anrede }} {{ params.name }},</p>
      <p>Nr {{ params.bestellnummer }} / {{ params.datum.vier.tage.vor.ablauf }}</p>
    </td></tr></table>`;
    const { components, report } = convertBrevoHtml(html);
    const json = JSON.stringify(components);
    assert.match(json, /data-param-key=\\"anrede\\"|data-param-key":"anrede"/);
    assert.match(json, /datum\.vier\.tage\.vor\.ablauf/);
    assert.equal(report.variables.preserved, report.variables.expected);
  });

  it("coalesces bis</p><div>param splits in rich text", () => {
    const html =
      `<p>Datum: {{ params.datum_von }} bis&#160;</p>` +
      `<div><span data-email-type="email-param" data-param-key="datum_bis">{{ params.datum_bis }}</span>` +
      `<br>Uhrzeit: {{ params.uhrzeit_von }}</div>`;
    const out = String(richTextToGrapesComponents(html));
    assert.doesNotMatch(out, /bis&#160;<\/p>\s*<div/);
    assert.match(out, /datum_bis/);
  });
});
