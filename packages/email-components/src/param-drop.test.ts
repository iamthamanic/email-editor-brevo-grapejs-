/**
 * Unit tests for inline drop type resolution (Phase 1).
 * Location: packages/email-components/src/param-drop.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dropSourceType, isInlineParamDrop } from "./param";

describe("dropSourceType / isInlineParamDrop", () => {
  it("reads type from Grapes-like .get()", () => {
    assert.equal(
      dropSourceType({ get: (k: string) => (k === "type" ? "email-param" : "") }),
      "email-param",
    );
  });

  it("reads type from plain drag definition", () => {
    assert.equal(dropSourceType({ type: "email-text" }), "email-text");
  });

  it("accepts textbaustein and param sources", () => {
    assert.equal(isInlineParamDrop({ type: "email-text" }), true);
    assert.equal(isInlineParamDrop({ type: "email-heading" }), true);
    assert.equal(
      isInlineParamDrop({ get: (k: string) => (k === "type" ? "email-param" : "") }),
      true,
    );
    assert.equal(isInlineParamDrop({ type: "email-image" }), false);
  });
});
