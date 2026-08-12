/**
 * Unit tests for Textbaustein first-sentence helpers.
 * Location: apps/editor/src/templates/ParamTextPreview.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  firstSentenceOf,
  hasMoreAfterFirstSentence,
} from "./ParamTextPreview.js";

describe("firstSentenceOf", () => {
  it("returns the first sentence", () => {
    assert.equal(
      firstSentenceOf("Hallo Welt. Zweiter Satz hier."),
      "Hallo Welt.",
    );
  });

  it("returns full text when no terminator", () => {
    assert.equal(firstSentenceOf("Nur eine Zeile"), "Nur eine Zeile");
  });
});

describe("hasMoreAfterFirstSentence", () => {
  it("is false for single sentence", () => {
    assert.equal(hasMoreAfterFirstSentence("Nur eins."), false);
  });

  it("is true when more follows", () => {
    assert.equal(hasMoreAfterFirstSentence("Eins. Zwei."), true);
  });

  it("is true for long single sentence", () => {
    assert.equal(
      hasMoreAfterFirstSentence(`${"Wort ".repeat(40).trim()}.`),
      true,
    );
  });
});
