/**
 * Registry unit tests.
 * Location: packages/email-components/src/registry.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_DEFAULTS } from "./brandDefaults.js";
import { EMAIL_COMPONENTS, listComponentTypes } from "./registry.js";

describe("EMAIL_COMPONENTS registry", () => {
  it("includes required content + layout + section types", () => {
    const types = listComponentTypes();
    for (const required of [
      "email-text",
      "email-heading",
      "email-image",
      "email-button",
      "email-divider",
      "email-spacer",
      "email-section",
      "email-section-header",
      "email-section-footer",
      "email-columns-1",
      "email-columns-2",
      "email-columns-3",
      "company-social",
    ]) {
      assert.ok(types.includes(required), `missing ${required}`);
    }
  });

  it("does not expose legacy monolith header/footer as palette types", () => {
    const types = listComponentTypes();
    assert.equal(types.includes("email-header"), false);
    assert.equal(types.includes("company-header"), false);
    assert.equal(types.includes("company-footer"), false);
  });

  it("uses DE category labels", () => {
    const labels = new Set(EMAIL_COMPONENTS.map((c) => c.categoryLabel));
    assert.ok(labels.has("Inhalt"));
    assert.ok(labels.has("Layout"));
    assert.ok(labels.has("Bereiche"));
  });
});

describe("BRAND_DEFAULTS", () => {
  it("exposes Halteverbot123 / Browo brand chrome and default variant", () => {
    assert.equal(BRAND_DEFAULTS.companyName, "Browo GmbH");
    assert.equal(BRAND_DEFAULTS.variant, "default");
    assert.ok(BRAND_DEFAULTS.website.includes("halteverbot123"));
    assert.ok(BRAND_DEFAULTS.logoSrc.startsWith("https://"));
    assert.ok(BRAND_DEFAULTS.addressStreet.includes("Späth"));
    assert.ok(BRAND_DEFAULTS.socialItems.length >= 3);
  });
});
