/**
 * Unit tests for Textbaustein HTML helpers.
 * Location: apps/editor/src/templates/textbausteinHtml.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  escapeHtml,
  htmlToPlainText,
  plainTextFromSectionData,
  textToEmailHtml,
} from "./textbausteinHtml.js";

describe("textToEmailHtml", () => {
  it("escapes raw HTML", () => {
    const html = textToEmailHtml('<script>alert(1)</script>');
    assert.equal(html.includes("<script>"), false);
    assert.match(html, /&lt;script&gt;/);
  });

  it("keeps Brevo-style variables", () => {
    const html = textToEmailHtml("Hallo {{ params.vorname }}");
    assert.match(html, /\{\{ params\.vorname \}\}/);
  });

  it("auto-links https URLs only", () => {
    const html = textToEmailHtml("Siehe https://example.com/path bitte");
    assert.match(html, /<a href="https:\/\/example\.com\/path">/);
    assert.equal(html.includes("javascript:"), false);
  });

  it("rejects javascript URLs as plain text", () => {
    const html = textToEmailHtml("x javascript:alert(1) y");
    assert.equal(html.includes("<a "), false);
    assert.match(html, /javascript:alert\(1\)/);
  });
});

describe("plainTextFromSectionData", () => {
  it("reads content HTML as plain text", () => {
    const text = plainTextFromSectionData({
      type: "email-text",
      content: "<p>Hallo<br/>Welt</p>",
    });
    assert.match(text, /Hallo/);
    assert.match(text, /Welt/);
  });
});

describe("escapeHtml / htmlToPlainText", () => {
  it("round-trips basic entities", () => {
    const escaped = escapeHtml('a <b> & "c"');
    assert.equal(escaped, "a &lt;b&gt; &amp; &quot;c&quot;");
    assert.equal(htmlToPlainText("<p>Hi&amp;Ho</p>"), "Hi&Ho");
  });
});
