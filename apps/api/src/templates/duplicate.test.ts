/**
 * Unit tests for duplicate template naming.
 * Location: apps/api/src/templates/duplicate.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  duplicateTemplateName,
  formatDuplicateStamp,
  isDuplicateTemplateName,
} from "./service.js";

describe("duplicateTemplateName", () => {
  it("prefixes German (Kopie) with exact local stamp", () => {
    const at = new Date("2026-08-09T18:52:33.000Z");
    const name = duplicateTemplateName("Rechnung", at);
    assert.match(name, /^\(Kopie .+\) Rechnung$/);
    assert.ok(isDuplicateTemplateName(name));
    assert.equal(name.includes(formatDuplicateStamp(at)), true);
  });

  it("strips prior copy prefix when re-duplicating", () => {
    const at = new Date("2026-08-09T18:52:33.000Z");
    const once = duplicateTemplateName("Rechnung", at);
    const twice = duplicateTemplateName(once, at);
    assert.match(twice, /^\(Kopie .+\) Rechnung$/);
    assert.doesNotMatch(twice, /\) \(Kopie/);
  });

  it("trims and falls back for empty names", () => {
    const name = duplicateTemplateName("  ", new Date("2026-08-09T18:52:33.000Z"));
    assert.match(name, /^\(Kopie .+\) Template$/);
  });
});

describe("isDuplicateTemplateName", () => {
  it("detects leading Kopie prefix", () => {
    assert.equal(isDuplicateTemplateName("(Kopie) Foo"), true);
    assert.equal(isDuplicateTemplateName("(Kopie 09.08.2026, 20:52:33) Foo"), true);
    assert.equal(isDuplicateTemplateName("Foo (Kopie)"), true);
    assert.equal(isDuplicateTemplateName("Foo"), false);
  });
});
