/**
 * Unit tests for email-variables registry / expression / substitute.
 * Location: packages/email-variables/src/registry.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMAIL_VARIABLES,
  extractParamKeys,
  getSampleData,
  isKnownVariableKey,
  listPreviewContacts,
  listVariableKeys,
  substituteParams,
  toExpression,
} from "./index.js";

describe("EMAIL_VARIABLES", () => {
  it("includes customer, order, invoice groups", () => {
    const groups = new Set(EMAIL_VARIABLES.map((v) => v.group));
    assert.ok(groups.has("customer"));
    assert.ok(groups.has("order"));
    assert.ok(groups.has("invoice"));
  });

  it("has DE group labels", () => {
    const labels = new Set(EMAIL_VARIABLES.map((v) => v.groupLabel));
    assert.ok(labels.has("Kunde"));
    assert.ok(labels.has("Auftrag"));
    assert.ok(labels.has("Rechnung"));
  });

  it("covers required ERP keys", () => {
    const keys = listVariableKeys();
    for (const required of [
      "vorname",
      "bestellnummer",
      "rechnungsnummer",
      "mahnung",
      "gesamtbetrag",
      "adresse",
      "datum.vier.tage.vor.ablauf",
      "detaillierte.angaben",
    ]) {
      assert.ok(keys.includes(required), `missing ${required}`);
    }
  });

  it("exposes Angezeigte Informationen descriptions", () => {
    const bestell = EMAIL_VARIABLES.find((v) => v.key === "bestellnummer");
    assert.ok(bestell?.description.includes("Bestellnummer"));
    const name = EMAIL_VARIABLES.find((v) => v.key === "name");
    assert.ok(name?.description.includes("Nachname"));
  });
});

describe("toExpression", () => {
  it("builds {{ params.key }} for known keys", () => {
    assert.equal(toExpression("vorname"), "{{ params.vorname }}");
  });

  it("rejects unknown keys", () => {
    assert.throws(() => toExpression("not_a_real_key"));
  });
});

describe("substituteParams", () => {
  it("replaces known tags and keeps unknown", () => {
    const sample = getSampleData();
    const html =
      "Hallo {{ params.vorname }}, x={{ params.unknown_key }}!";
    const out = substituteParams(html, sample);
    assert.equal(out, `Hallo ${sample.vorname}, x={{ params.unknown_key }}!`);
  });

  it("tolerates whitespace in expressions", () => {
    const sample = getSampleData();
    assert.equal(
      substituteParams("{{  params.vorname  }}", sample),
      sample.vorname,
    );
  });
});

describe("extractParamKeys / isKnownVariableKey", () => {
  it("extracts keys from html", () => {
    const keys = extractParamKeys("a {{ params.email }} b {{ params.vorname }}");
    assert.deepEqual(keys.sort(), ["email", "vorname"]);
  });

  it("extracts nested paths", () => {
    const keys = extractParamKeys(
      "{{ params.a.b }} {{params.datum.vier.tage}}",
    );
    assert.deepEqual(keys.sort(), ["a.b", "datum.vier.tage"]);
  });

  it("knows registry keys only", () => {
    assert.equal(isKnownVariableKey("vorname"), true);
    assert.equal(isKnownVariableKey("nope"), false);
  });
});

describe("getSampleData", () => {
  it("covers every registry key with non-secret muster values", () => {
    const sample = getSampleData();
    for (const key of listVariableKeys()) {
      assert.ok(key in sample, `sample missing ${key}`);
      assert.ok(typeof sample[key] === "string");
    }
    assert.ok(sample.email?.endsWith("@example.com"));
  });
});

describe("listPreviewContacts", () => {
  it("exposes mock customers with full param maps", () => {
    const contacts = listPreviewContacts();
    assert.ok(contacts.length >= 2);
    for (const c of contacts) {
      assert.ok(c.id);
      assert.ok(c.email.includes("@example.com"));
      assert.ok(c.kundenId);
      for (const key of listVariableKeys()) {
        assert.ok(key in c.params, `${c.id} missing ${key}`);
      }
    }
    assert.notEqual(contacts[0]!.params.vorname, contacts[1]!.params.vorname);
  });
});
