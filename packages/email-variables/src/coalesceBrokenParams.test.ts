/**
 * Unit tests for bis/param block coalesce.
 * Location: packages/email-variables/src/coalesceBrokenParams.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coalesceBrokenParamHtml,
  coalesceBrokenParamHtmlDeep,
} from "./coalesceBrokenParams.js";

const badge = (key: string) =>
  `<span data-gjs-type="email-param" data-email-type="email-param" data-param-key="${key}" class="email-param-badge">{{ params.${key} }}</span>`;

describe("coalesceBrokenParamHtml", () => {
  it("pulls leading datum_bis into the bis paragraph (production #6 shape)", () => {
    const html =
      `<p>Datum: ${badge("datum_von")} bis&#160;</p>` +
      `<div style="font-weight: 400"><span>${badge("datum_bis")}</span>` +
      `<br>Uhrzeit: ${badge("uhrzeit_von")} bis ${badge("uhrzeit_bis")}</div>`;

    const out = coalesceBrokenParamHtml(html);
    assert.match(out, /bis&#160;<span>[\s\S]*datum_bis[\s\S]*<\/span><\/p>/);
    assert.doesNotMatch(out, /bis&#160;<\/p>\s*<div/);
    assert.match(out, /<div[^>]*><br>Uhrzeit:/);
    assert.match(out, /uhrzeit_bis/);
  });

  it("merges fully param-only sibling after bis", () => {
    const html =
      `<p>von ${badge("datum_von")} bis </p><div>${badge("datum_bis")}</div>`;
    const out = coalesceBrokenParamHtml(html);
    assert.match(out, /bis\s+[\s\S]*datum_bis[\s\S]*<\/p>/);
    assert.doesNotMatch(out, /<\/p>\s*<div/);
  });

  it("pulls plain mustache spans from document.html without badge attrs", () => {
    const html =
      `<p>Datum: <span>{{ params.datum_von }}</span> bis&#160;</p>` +
      `<div style="font-weight: 400"><span>{{ params.datum_bis }}</span>` +
      `<br>Uhrzeit: <span>{{ params.uhrzeit_von }}</span></div>`;
    const out = coalesceBrokenParamHtml(html);
    assert.doesNotMatch(out, /bis&#160;<\/p>\s*<div/);
    assert.match(
      out,
      /bis&#160;<span>\{\{ params\.datum_bis \}\}<\/span><\/p>/,
    );
  });

  it("leaves intact inline bis lines alone", () => {
    const html =
      `<p>Uhrzeit: ${badge("uhrzeit_von")} bis ${badge("uhrzeit_bis")}</p>`;
    assert.equal(coalesceBrokenParamHtml(html), html);
  });
});

describe("coalesceBrokenParamHtmlDeep", () => {
  it("repairs nested editorData content strings", () => {
    const broken =
      `<p>Datum: ${badge("datum_von")} bis&#160;</p>` +
      `<div><span>${badge("datum_bis")}</span><br>x</div>`;
    const data = {
      components: [{ type: "email-text", content: broken }],
    };
    const fixed = coalesceBrokenParamHtmlDeep(data) as typeof data;
    assert.doesNotMatch(fixed.components[0]!.content, /bis&#160;<\/p>\s*<div/);
  });
});
