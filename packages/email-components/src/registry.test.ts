/**
 * Registry unit tests.
 * Location: packages/email-components/src/registry.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

  it("uses DE category labels", () => {
    const labels = new Set(EMAIL_COMPONENTS.map((c) => c.categoryLabel));
    assert.ok(labels.has("Inhalt"));
    assert.ok(labels.has("Layout"));
  });
});
