/**
 * Permission gate for migrate-legacy-hashes (unit-level requirePermission).
 * Location: apps/api/src/templates/migrateLegacyHashes.auth.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuthUser } from "@email-template/email-schema";
import { requirePermission } from "../auth/dev-auth.js";

describe("migrate-legacy-hashes authz", () => {
  it("denies users without email_templates.edit", () => {
    const reader: AuthUser = {
      id: "r",
      displayName: "Reader",
      permissions: ["email_templates.read"],
    };
    assert.equal(requirePermission(reader, "email_templates.edit"), false);
  });

  it("allows edit permission", () => {
    const editor: AuthUser = {
      id: "e",
      displayName: "Editor",
      permissions: ["email_templates.edit"],
    };
    assert.equal(requirePermission(editor, "email_templates.edit"), true);
  });
});
