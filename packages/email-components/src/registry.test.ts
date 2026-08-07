/**
 * Registry unit tests.
 * Location: packages/email-components/src/registry.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_DEFAULTS } from "./brandDefaults.js";
import { EMAIL_COMPONENTS, listComponentTypes } from "./registry.js";

describe("EMAIL_COMPONENTS registry", () => {
  it("includes required Phase 2 types", () => {
    const types = listComponentTypes();
    for (const required of [
      "email-text",
      "email-heading",
      "email-image",
      "email-button",
      "email-divider",
      "email-spacer",
      "email-section",
      "email-columns-1",
      "email-columns-2",
      "email-columns-3",
    ]) {
      assert.ok(types.includes(required), `missing ${required}`);
    }
  });

  it("includes Phase 3 corporate types", () => {
    const types = listComponentTypes();
    for (const required of [
      "company-header",
      "company-footer",
      "company-legal",
      "company-contact",
      "company-social",
    ]) {
      assert.ok(types.includes(required), `missing ${required}`);
    }
  });

  it("uses DE category labels", () => {
    const labels = new Set(EMAIL_COMPONENTS.map((c) => c.categoryLabel));
    assert.ok(labels.has("Inhalt"));
    assert.ok(labels.has("Layout"));
    assert.ok(labels.has("Firma"));
  });
});

describe("BRAND_DEFAULTS", () => {
  it("exposes Musterfirma placeholders and default variant", () => {
    assert.equal(BRAND_DEFAULTS.companyName, "Musterfirma GmbH");
    assert.equal(BRAND_DEFAULTS.variant, "default");
    assert.ok(BRAND_DEFAULTS.website.startsWith("https://"));
  });
});
