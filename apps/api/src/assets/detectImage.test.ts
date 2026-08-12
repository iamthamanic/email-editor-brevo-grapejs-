/**
 * Unit tests for image magic-byte detection.
 * Location: apps/api/src/assets/detectImage.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageKind } from "./detectImage.js";

describe("detectImageKind", () => {
  it("detects jpeg/png/gif/webp headers", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(detectImageKind(jpeg), "jpeg");

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    assert.equal(detectImageKind(png), "png");

    const gif = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0,
    ]);
    assert.equal(detectImageKind(gif), "gif");

    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    assert.equal(detectImageKind(webp), "webp");
  });

  it("rejects non-images", () => {
    assert.equal(detectImageKind(Buffer.from("hello world!!")), null);
    assert.equal(detectImageKind(Buffer.alloc(0)), null);
  });
});
