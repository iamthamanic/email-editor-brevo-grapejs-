/**
 * Editor schema version helpers.
 * Location: packages/email-schema/src/editorSchema.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CURRENT_EDITOR_SCHEMA_VERSION,
  isEditorSchemaCurrent,
  needsBrevoEditorMigration,
} from "./editorSchema.js";

describe("needsBrevoEditorMigration", () => {
  it("requires migration when Brevo-backed + editorData + old schema", () => {
    assert.equal(
      needsBrevoEditorMigration({
        brevoTemplateId: "4",
        editorSchemaVersion: 0,
        hasEditorData: true,
      }),
      true,
    );
  });

  it("is idempotent when schema is current", () => {
    assert.equal(
      needsBrevoEditorMigration({
        brevoTemplateId: "4",
        editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
        conversionVersion: 4,
        hasEditorData: true,
      }),
      false,
    );
  });

  it("requires migration when conversionVersion is stale", () => {
    assert.equal(
      needsBrevoEditorMigration({
        brevoTemplateId: "4",
        editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
        conversionVersion: 1,
        hasEditorData: true,
      }),
      true,
    );
  });

  it("requires migration when conversionVersion is missing", () => {
    assert.equal(
      needsBrevoEditorMigration({
        brevoTemplateId: "4",
        editorSchemaVersion: CURRENT_EDITOR_SCHEMA_VERSION,
        hasEditorData: true,
      }),
      true,
    );
  });

  it("skips templates without brevoTemplateId", () => {
    assert.equal(
      needsBrevoEditorMigration({
        brevoTemplateId: null,
        editorSchemaVersion: 0,
        hasEditorData: true,
      }),
      false,
    );
  });

  it("skips empty editorData (first convert path)", () => {
    assert.equal(
      needsBrevoEditorMigration({
        brevoTemplateId: "4",
        editorSchemaVersion: 0,
        hasEditorData: false,
      }),
      false,
    );
  });

  it("isEditorSchemaCurrent respects CURRENT", () => {
    assert.equal(isEditorSchemaCurrent(CURRENT_EDITOR_SCHEMA_VERSION), true);
    assert.equal(isEditorSchemaCurrent(0), false);
    assert.equal(isEditorSchemaCurrent(null), false);
  });
});
