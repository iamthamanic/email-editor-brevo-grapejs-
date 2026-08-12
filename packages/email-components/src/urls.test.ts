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

  it("allows local /api/assets paths", () => {
    const path =
      "/api/assets/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png";
    assert.equal(isAllowedImageUrl(path), true);
    assert.equal(sanitizeImageUrl(path, "https://fallback"), path);
    assert.equal(isAllowedImageUrl("/api/assets/../etc/passwd"), false);
  });

  it("allows only the trusted email-image placeholder data-URI", async () => {
    const { EMAIL_IMAGE_PLACEHOLDER_SRC } = await import(
      "./imagePlaceholder.js"
    );
    assert.equal(isAllowedImageUrl(EMAIL_IMAGE_PLACEHOLDER_SRC), true);
    assert.equal(
      isAllowedImageUrl("data:image/svg+xml;charset=utf-8,%3Csvg%3E"),
      false,
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
