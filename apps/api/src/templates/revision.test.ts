/**
 * Unit tests for revision concurrency helper.
 * Location: apps/api/src/templates/revision.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ERROR_CODES } from "@email-template/email-schema";
import { ServiceError, assertRevisionMatch } from "./service.js";

describe("assertRevisionMatch", () => {
  it("passes when revisions match", () => {
    assert.doesNotThrow(() => assertRevisionMatch(3, 3));
  });

  it("throws REVISION_CONFLICT on mismatch", () => {
    assert.throws(
      () => assertRevisionMatch(3, 2),
      (error: unknown) => {
        assert.ok(error instanceof ServiceError);
        assert.equal(error.code, ERROR_CODES.REVISION_CONFLICT);
        assert.equal(error.httpStatus, 409);
        return true;
      },
    );
  });
});
