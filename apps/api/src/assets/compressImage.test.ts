/**
 * Unit tests for image compress-to-max.
 * Location: apps/api/src/assets/compressImage.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { compressImageToMax, MAX_ASSET_BYTES } from "./compressImage.js";
import { detectImageKind } from "./detectImage.js";

/** Uncompressible-ish RGB noise so JPEG stays large without resize. */
async function noisyJpeg(width: number, height: number): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = (i * 37 + (i % 251) * 13) & 0xff;
  }
  return sharp(raw, { raw: { width, height, channels } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("compressImageToMax", () => {
  it("keeps small images unchanged", async () => {
    const small = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 3,
        background: { r: 20, g: 80, b: 160 },
      },
    })
      .png()
      .toBuffer();

    const out = await compressImageToMax(small);
    assert.equal(out.compressed, false);
    assert.equal(out.buf.length, small.length);
    assert.equal(out.kind, "png");
  });

  it("shrinks oversized images to ≤ 2 MiB", async () => {
    const huge = await noisyJpeg(3500, 3500);
    assert.ok(
      huge.length > MAX_ASSET_BYTES,
      `expected fixture > 2MiB, got ${huge.length}`,
    );

    const out = await compressImageToMax(huge);
    assert.equal(out.compressed, true);
    assert.ok(out.buf.length <= MAX_ASSET_BYTES, `got ${out.buf.length}`);
    assert.ok(detectImageKind(out.buf));
    assert.ok(out.originalBytes > out.buf.length);
  });
});
