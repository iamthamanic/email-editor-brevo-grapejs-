/**
 * Block thumbnail coverage for toolbar palette.
 * Location: packages/email-components/src/blockThumbnails.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMAIL_COMPONENTS } from "./registry.js";
import { blockThumbnail, BLOCK_THUMBNAILS } from "./blockThumbnails.js";

describe("blockThumbnails", () => {
  it("covers every palette component type", () => {
    for (const def of EMAIL_COMPONENTS) {
      assert.ok(
        BLOCK_THUMBNAILS[def.type],
        `missing thumbnail for ${def.type}`,
      );
      const svg = blockThumbnail(def.type);
      assert.match(svg, /^<svg\b/);
      assert.match(svg, /width="72"/);
    }
  });

  it("returns fallback svg for unknown types", () => {
    assert.match(blockThumbnail("no-such-block"), /^<svg\b/);
  });
});
