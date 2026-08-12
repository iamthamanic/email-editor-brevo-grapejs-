/**
 * Unit tests for email HTML allowlist sanitizer.
 * Location: packages/email-components/src/html.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sanitizeEmailHtml,
  sanitizeInlineStyle,
  sanitizePastedEmailHtml,
} from "./html.js";
import { escapeHtml, sanitizeAltText } from "./text.js";

describe("sanitizeEmailHtml", () => {
  it("strips script and event handlers", () => {
    const out = sanitizeEmailHtml(
      '<p onclick="alert(1)">Hi</p><script>alert(2)</script>',
    );
    assert.equal(out.includes("script"), false);
    assert.equal(out.includes("onclick"), false);
    assert.equal(out.includes("Hi"), true);
  });

  it("rewrites javascript href to safe fallback", () => {
    const out = sanitizeEmailHtml(
      '<a href="javascript:alert(1)">Click</a>',
    );
    assert.equal(out.includes("javascript:"), false);
    assert.match(out, /href="https:\/\/example\.com"/);
  });

  it("rewrites unsafe image src", () => {
    const out = sanitizeEmailHtml('<img src="data:text/html,x" alt="x">');
    assert.equal(out.includes("data:"), false);
    assert.equal(/src=/.test(out), false);
  });

  it("keeps https links", () => {
    const out = sanitizeEmailHtml(
      '<a href="https://ok.example/path">OK</a>',
    );
    assert.match(out, /href="https:\/\/ok\.example\/path"/);
  });

  it("strips background shorthand but keeps intentional background-color", () => {
    const out = sanitizeEmailHtml(
      '<span style="background:#000 url(x);background-color:#ffe066;color:#171717;font-weight:700">Hi</span>',
    );
    assert.equal(/background\s*:/i.test(out), false);
    assert.equal(out.includes("url("), false);
    assert.match(out, /background-color:\s*#ffe066/i);
    assert.match(out, /color:\s*#171717/i);
    assert.match(out, /Hi/);
  });

  it("strips bgcolor attribute", () => {
    const out = sanitizeEmailHtml('<td bgcolor="#111" style="color:#fff">X</td>');
    assert.equal(out.includes("bgcolor"), false);
  });

  it("drops unknown style props", () => {
    const out = sanitizeEmailHtml(
      '<p style="position:absolute;z-index:9;color:#171717">X</p>',
    );
    assert.equal(out.includes("position"), false);
    assert.equal(out.includes("z-index"), false);
    assert.match(out, /color:\s*#171717/i);
  });

  it("keeps canvas round-trip markers (data-email-type / roles / layout)", () => {
    const src =
      `<table data-email-type="email-section" data-role="content" ` +
      `data-section-role="content" width="100%">` +
      `<tr data-email-type="email-row">` +
      `<td data-email-type="email-column">` +
      `<table data-email-type="email-layout-row" data-layout="columns" data-layout-cols="2">` +
      `<tr><td data-email-type="email-column">` +
      `<div data-email-type="email-text" data-role="main-content" ` +
      `onclick="evil()"><p>Hi</p></div>` +
      `</td></tr></table></td></tr></table>`;
    const out = sanitizeEmailHtml(src);
    assert.match(out, /data-email-type="email-section"/);
    assert.match(out, /data-section-role="content"/);
    assert.match(out, /data-role="content"/);
    assert.match(out, /data-email-type="email-layout-row"/);
    assert.match(out, /data-layout="columns"/);
    assert.match(out, /data-layout-cols="2"/);
    assert.match(out, /data-email-type="email-text"/);
    assert.match(out, /data-role="main-content"/);
    assert.equal(out.includes("onclick"), false);
    assert.match(out, /Hi/);
  });
});

describe("sanitizePastedEmailHtml", () => {
  it("strips chat theme colors and backgrounds", () => {
    const out = sanitizePastedEmailHtml(
      '<div style="background:#1e1e1e;background-color:#1e1e1e;color:#f5f5f5;font-size:14px">Chat</div>',
    );
    assert.equal(out.includes("background"), false);
    assert.equal(/color\s*:/i.test(out), false);
    assert.match(out, /font-size:\s*14px/i);
    assert.match(out, /Chat/);
  });

  it("strips white-space:nowrap and fixed widths that blow layout", () => {
    const out = sanitizePastedEmailHtml(
      '<span style="white-space: nowrap; width: 2400px; min-width: 1800px; font-size: 16px">Lang</span>',
    );
    assert.equal(/white-space/i.test(out), false);
    assert.equal(/width\s*:/i.test(out), false);
    assert.match(out, /font-size:\s*16px/i);
    assert.match(out, /Lang/);
  });

  it("strips foreign font-family so host Tahoma stack applies", () => {
    const out = sanitizePastedEmailHtml(
      '<p style="font-family: Georgia, serif; font-size: 16px">Hallo</p>',
    );
    assert.equal(/font-family/i.test(out), false);
    assert.match(out, /font-size:\s*16px/i);
    assert.match(out, /Hallo/);
  });
});

describe("sanitizeInlineStyle", () => {
  it("allowlists email-safe props only", () => {
    const out = sanitizeInlineStyle(
      "color: red; background: black; font-size: 16px; cursor: pointer",
    );
    assert.equal(out.includes("background"), false);
    assert.equal(out.includes("cursor"), false);
    assert.match(out, /color:\s*red/i);
    assert.match(out, /font-size:\s*16px/i);
  });

  it("can strip background-color for paste mode", () => {
    const out = sanitizeInlineStyle("background-color: #000; font-size: 14px", {
      stripBackgrounds: true,
    });
    assert.equal(out.includes("background"), false);
    assert.match(out, /font-size:\s*14px/i);
  });
});

describe("sanitizeAltText", () => {
  it("strips tags and quotes", () => {
    assert.equal(sanitizeAltText('<b>Hi</b> "x"', "Bild"), "Hi x");
    assert.equal(sanitizeAltText("   ", "Bild"), "Bild");
  });
});

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    assert.equal(escapeHtml('<a "b">'), "&lt;a &quot;b&quot;&gt;");
  });
});
