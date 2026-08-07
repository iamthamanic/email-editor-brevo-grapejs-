/**
 * API smoke for variable catalog endpoints (package wiring).
 * Location: apps/api/src/variables/routes.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMAIL_VARIABLES,
  getSampleData,
  toExpression,
} from "@email-template/email-variables";

describe("variable routes data source", () => {
  it("catalog maps to expressions for every key", () => {
    for (const v of EMAIL_VARIABLES) {
      assert.equal(toExpression(v.key), `{{ params.${v.key} }}`);
    }
  });

  it("sample covers full catalog", () => {
    const sample = getSampleData();
    assert.equal(Object.keys(sample).length, EMAIL_VARIABLES.length);
  });
});
