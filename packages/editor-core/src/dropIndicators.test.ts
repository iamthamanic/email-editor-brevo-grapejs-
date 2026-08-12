/**
 * Unit tests for dropzone source sizing helpers.
 * Location: packages/editor-core/src/dropIndicators.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampDropHeight,
  FALLBACK_DROP_H_PX,
  MAX_DROP_H_PX,
  measureDropSourceSize,
  measureTargetHeight,
  MIN_DROP_H_PX,
  resolveDropHeight,
  resolveSourceElement,
  TOOLBAR_SOURCE_MAX_H_PX,
} from "./dropIndicators.js";

function fakeEl(width: number, height: number) {
  return {
    nodeType: 1,
    getBoundingClientRect: () => ({
      width,
      height,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  };
}

describe("clampDropHeight", () => {
  it("falls back for invalid heights", () => {
    assert.equal(clampDropHeight(0), FALLBACK_DROP_H_PX);
    assert.equal(clampDropHeight(-4), FALLBACK_DROP_H_PX);
    assert.equal(clampDropHeight(Number.NaN), FALLBACK_DROP_H_PX);
  });

  it("maps tiny toolbar sources to content-like fallback", () => {
    assert.equal(clampDropHeight(TOOLBAR_SOURCE_MAX_H_PX), FALLBACK_DROP_H_PX);
    assert.equal(clampDropHeight(32), FALLBACK_DROP_H_PX);
  });

  it("clamps real content to min/max", () => {
    assert.equal(
      clampDropHeight(TOOLBAR_SOURCE_MAX_H_PX + 1),
      TOOLBAR_SOURCE_MAX_H_PX + 1,
    );
    assert.equal(clampDropHeight(9999), MAX_DROP_H_PX);
    assert.equal(clampDropHeight(180.4), 180);
  });
});

describe("resolveDropHeight", () => {
  it("respects target slot ceiling", () => {
    assert.equal(resolveDropHeight(200, 128), 128);
    assert.equal(resolveDropHeight(80, 128), 80);
    assert.equal(resolveDropHeight(200, null), 200);
  });

  it("never drops below min height", () => {
    assert.equal(resolveDropHeight(20, 30), MIN_DROP_H_PX);
  });
});

describe("measureTargetHeight", () => {
  it("reads inside target height", () => {
    const col = fakeEl(400, 132);
    const h = measureTargetHeight({
      pos: { placement: "inside" },
      target: col,
    });
    assert.equal(h, 132);
  });

  it("reads parent height for before/after", () => {
    const parent = fakeEl(560, 96);
    const h = measureTargetHeight({
      pos: { placement: "before" },
      parent,
    });
    assert.equal(h, 96);
  });

  it("uses target element for inside placement", () => {
    const col = fakeEl(400, 132);
    const h = measureTargetHeight({
      pos: { placement: "inside" },
      target: col,
    });
    assert.equal(h, 132);
  });
});

describe("resolveSourceElement + measureDropSourceSize", () => {
  it("returns null without DOM / empty args", () => {
    assert.equal(resolveSourceElement(null), null);
    assert.equal(resolveSourceElement({}), null);
    assert.equal(measureDropSourceSize(null), null);
  });

  it("reads element / getEl / view.el", () => {
    const el = fakeEl(320, 88);
    assert.equal(resolveSourceElement(el), el);
    assert.equal(resolveSourceElement({ element: el }), el);
    assert.equal(resolveSourceElement({ getEl: () => el }), el);
    assert.equal(resolveSourceElement({ view: { el } }), el);
    assert.deepEqual(measureDropSourceSize({ getEl: () => el }), {
      width: 320,
      height: 88,
    });
  });

  it("prefers primary over secondary", () => {
    const a = fakeEl(10, 50);
    const b = fakeEl(20, 60);
    assert.equal(resolveSourceElement(a, b), a);
    assert.equal(resolveSourceElement(null, b), b);
  });
});
