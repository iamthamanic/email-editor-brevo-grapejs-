/**
 * Unit tests for nested presentation-table unwrap.
 * Location: packages/legacy-importer/src/unwrap.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseHTML } from "linkedom";
import { findMultiColumnLayoutCells } from "./recognition/unwrap.js";

describe("findMultiColumnLayoutCells", () => {
  it("unwraps table > tr > td > table > tr > th[50%]+th[50%]", () => {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>
<table class="outer" width="100%">
  <tr>
    <td>
      <table width="100%">
        <tr>
          <th width="50%">Left</th>
          <th width="50%">Right</th>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`);
    const outer = document.querySelector("table.outer")!;
    const cells = findMultiColumnLayoutCells(outer);
    assert.ok(cells);
    assert.equal(cells!.length, 2);
    assert.equal(cells![0]!.getAttribute("width"), "50%");
    assert.equal(cells![1]!.getAttribute("width"), "50%");
  });

  it("returns null for true single-column modules", () => {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>
<table class="outer"><tr><td><p>Only text</p></td></tr></table>
</body></html>`);
    assert.equal(
      findMultiColumnLayoutCells(document.querySelector("table.outer")!),
      null,
    );
  });
});
