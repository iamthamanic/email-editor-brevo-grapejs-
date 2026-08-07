/**
 * Unit tests for URL allowlist + plain text (F-02).
 * Location: packages/email-components/src/urls.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPlainText } from "./text.js";
import {
  isAllowedImageUrl,
  isAllowedLinkUrl,
  sanitizeImageUrl,
  sanitizeLinkUrl,
} from "./urls.js";

describe("sanitizeLinkUrl", () => {
  it("allows http https mailto tel", () => {
    assert.equal(isAllowedLinkUrl("https://example.com/x"), true);
    assert.equal(isAllowedLinkUrl("http://example.com"), true);
    assert.equal(isAllowedLinkUrl("mailto:a@b.c"), true);
    assert.equal(isAllowedLinkUrl("tel:+491234"), true);
  });

  it("rejects javascript and data", () => {
    assert.equal(isAllowedLinkUrl("javascript:alert(1)"), false);
    assert.equal(isAllowedLinkUrl("data:text/html,<script>"), false);
    assert.equal(sanitizeLinkUrl("javascript:alert(1)"), "https://example.com");
  });
});

describe("sanitizeImageUrl", () => {
  it("allows http(s) only", () => {
    assert.equal(isAllowedImageUrl("https://cdn.example/x.png"), true);
    assert.equal(isAllowedImageUrl("http://cdn.example/x.png"), true);
    assert.equal(isAllowedImageUrl("javascript:alert(1)"), false);
    assert.equal(
      sanitizeImageUrl("javascript:x", "https://fallback"),
      "https://fallback",
    );
  });
});

describe("toPlainText", () => {
  it("strips html tags", () => {
    assert.equal(toPlainText('<img src=x onerror=alert(1)>Hi', "Button"), "Hi");
    assert.equal(toPlainText("<b>Click</b>", "Button"), "Click");
    assert.equal(toPlainText("   ", "Button"), "Button");
  });
});
