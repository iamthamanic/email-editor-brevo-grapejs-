/**
 * Unit tests for empty layout-column detection.
 * Location: apps/editor/src/templates/emptyColumnInsert.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmptyContentColumn } from "./emptyColumnInsert";

type Fake = {
  get: (k: string) => unknown;
  getAttributes: () => Record<string, string>;
  parent: () => Fake | undefined;
  components: () => { models: Fake[] };
};

function fakeColumn(
  kids: Fake[],
  sectionRole = "content",
): Fake {
  const section: Fake = {
    get: (k) => (k === "type" ? "email-section" : k === "sectionRole" ? sectionRole : undefined),
    getAttributes: () => ({
      "data-role": sectionRole,
      "data-section-role": sectionRole,
    }),
    parent: () => undefined,
    components: () => ({ models: [] }),
  };
  const row: Fake = {
    get: (k) => (k === "type" ? "email-row" : undefined),
    getAttributes: () => ({}),
    parent: () => section,
    components: () => ({ models: [] }),
  };
  return {
    get: (k) => (k === "type" ? "email-column" : undefined),
    getAttributes: () => ({ "data-email-type": "email-column" }),
    parent: () => row,
    components: () => ({ models: kids }),
  };
}

function fakeLeaf(type: string): Fake {
  return {
    get: (k) => (k === "type" ? type : undefined),
    getAttributes: () => ({}),
    parent: () => undefined,
    components: () => ({ models: [] }),
  };
}

describe("isEmptyContentColumn", () => {
  it("true for empty content column", () => {
    assert.equal(isEmptyContentColumn(fakeColumn([]) as never), true);
  });

  it("false when column already has text", () => {
    assert.equal(
      isEmptyContentColumn(fakeColumn([fakeLeaf("email-text")]) as never),
      false,
    );
  });

  it("false for header chrome columns", () => {
    assert.equal(
      isEmptyContentColumn(fakeColumn([], "header") as never),
      false,
    );
  });
});
