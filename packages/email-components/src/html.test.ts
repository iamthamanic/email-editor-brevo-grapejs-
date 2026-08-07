/**
 * Unit tests for email HTML allowlist sanitizer.
 * Location: packages/email-components/src/html.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeEmailHtml } from "./html.js";
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
