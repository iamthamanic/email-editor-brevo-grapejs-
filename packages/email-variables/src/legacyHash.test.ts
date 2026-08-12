/**
 * Unit tests for legacy #TOKEN# → params replacement.
 * Location: packages/email-variables/src/legacyHash.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasLegacyHashTokens,
  LEGACY_HASH_TO_PARAM,
  replaceLegacyHashTokens,
  replaceLegacyHashTokensDeep,
} from "./legacyHash.js";

describe("replaceLegacyHashTokens", () => {
  it("maps known uppercase hashes to params expressions", () => {
    assert.equal(
      replaceLegacyHashTokens("Hallo #KUNDE_NAME#"),
      "Hallo {{ params.name }}",
    );
    assert.equal(
      replaceLegacyHashTokens("HV123-#BESTELLNR# - #ADRESSE#"),
      "HV123-{{ params.bestellnummer }} - {{ params.adresse }}",
    );
  });

  it("handles ###TOKEN### without leftover hashes", () => {
    const out = replaceLegacyHashTokens(
      "BWB ID: ###BWB_ZEICHEN###, ###DATUM###, ###ADRESSE###",
    );
    assert.equal(
      out,
      "BWB ID: {{ params.bwb.id }}, {{ params.bestelldatum }}, {{ params.adresse }}",
    );
    assert.ok(!out.includes("#"));
  });

  it("is case-insensitive on the token name", () => {
    assert.equal(
      replaceLegacyHashTokens("#kunde_name#"),
      "{{ params.name }}",
    );
  });

  it("leaves unknown hashes unchanged", () => {
    assert.equal(replaceLegacyHashTokens("#FOO_BAR#"), "#FOO_BAR#");
  });

  it("is idempotent on params expressions", () => {
    const once = replaceLegacyHashTokens("#BESTELLNR#");
    assert.equal(replaceLegacyHashTokens(once), once);
  });

  it("covers every mapped token", () => {
    for (const [token, key] of Object.entries(LEGACY_HASH_TO_PARAM)) {
      const out = replaceLegacyHashTokens(`#${token}#`);
      assert.equal(out, `{{ params.${key} }}`);
    }
  });
});

describe("hasLegacyHashTokens", () => {
  it("detects known hashes only", () => {
    assert.equal(hasLegacyHashTokens("x #BESTELLNR# y"), true);
    assert.equal(hasLegacyHashTokens("x #UNKNOWN# y"), false);
    assert.equal(hasLegacyHashTokens("{{ params.name }}"), false);
  });
});

describe("replaceLegacyHashTokensDeep", () => {
  it("walks nested objects and arrays", () => {
    const input = {
      subject: "#BESTELLNR#",
      nested: [{ content: "#KUNDE_NAME#" }, "plain"],
    };
    assert.deepEqual(replaceLegacyHashTokensDeep(input), {
      subject: "{{ params.bestellnummer }}",
      nested: [{ content: "{{ params.name }}" }, "plain"],
    });
  });
});
