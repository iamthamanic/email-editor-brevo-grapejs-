/**
 * Unit tests for traits-modal selection resolve.
 * Location: apps/editor/src/templates/openTraitsOnSelect.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTraitsComponent } from "./openTraitsOnSelect";

type Fake = {
  get: (k: string) => unknown;
  findType: (t: string) => Fake[];
};

function fake(type: string, find: Record<string, Fake[]> = {}): Fake {
  return {
    get: (k: string) => (k === "type" ? type : undefined),
    findType: (t: string) => find[t] ?? [],
  };
}

describe("resolveTraitsComponent", () => {
  it("returns image/button/param directly", () => {
    const img = fake("email-image");
    assert.equal(resolveTraitsComponent(img), img);
    const btn = fake("email-button");
    assert.equal(resolveTraitsComponent(btn), btn);
  });

  it("promotes single image inside column", () => {
    const image = fake("email-image");
    const col = fake("email-column", { "email-image": [image] });
    assert.equal(resolveTraitsComponent(col), image);
  });

  it("does not promote when multiple images", () => {
    const col = fake("email-column", {
      "email-image": [fake("email-image"), fake("email-image")],
    });
    assert.equal(resolveTraitsComponent(col), null);
  });

  it("ignores unrelated types", () => {
    assert.equal(resolveTraitsComponent(fake("email-text")), null);
  });
});
