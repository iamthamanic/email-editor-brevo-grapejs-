/**
 * Unit tests for canvas component merge (pure JSON transform).
 * Location: packages/editor-core/src/migrateCanvasLayout.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCanonicalContentCanvas,
  migrateCanvasComponents,
  type CanvasCompJson,
} from "./migrateCanvasLayout.js";

function section(
  role: string,
  cols: CanvasCompJson[][],
): CanvasCompJson {
  return {
    type: "email-section",
    sectionRole: role,
    attributes: {
      "data-email-type": "email-section",
      "data-role": role,
      "data-section-role": role,
    },
    components: [
      {
        type: "email-row",
        components: cols.map((blocks, i) => {
          const width = Math.floor(100 / cols.length);
          return {
            type: "email-column",
            columnWidth: width,
            attributes: { width: `${width}%` },
            components: blocks,
          };
        }),
      },
    ],
  };
}

function text(content: string): CanvasCompJson {
  return {
    type: "email-text",
    attributes: { "data-email-type": "email-text" },
    content,
  };
}

describe("migrateCanvasComponents", () => {
  it("merges multiple content sections into one canvas", () => {
    const top = [
      section("header", [[text("Logo")]]),
      section("content", [[text("A")]]),
      section("content", [[text("B")]]),
      section("footer", [[text("F")]]),
    ];
    const next = migrateCanvasComponents(top);
    const roles = next
      .filter((c) => c.type === "email-section")
      .map((c) => c.sectionRole);
    assert.deepEqual(roles, ["header", "content", "footer"]);
    assert.equal(isCanonicalContentCanvas(next[1]!), true);
    const blob = JSON.stringify(next[1]);
    assert.match(blob, /"A"/);
    assert.match(blob, /"B"/);
  });

  it("wraps multi-column content as email-layout-row", () => {
    const top = [
      section("content", [[text("L")], [text("R")]]),
    ];
    const next = migrateCanvasComponents(top);
    assert.equal(next.length, 1);
    assert.equal(isCanonicalContentCanvas(next[0]!), true);
    assert.match(JSON.stringify(next[0]), /email-layout-row/);
  });

  it("is idempotent on canonical canvas", () => {
    const top = [
      section("header", [[text("H")]]),
      section("content", [[text("Only")]]),
      section("footer", [[text("F")]]),
      section("social", [[text("S")]]),
    ];
    const once = migrateCanvasComponents(top);
    const twice = migrateCanvasComponents(once);
    assert.deepEqual(twice, once);
  });

  it("creates canvas when only chrome exists", () => {
    const top = [section("header", [[text("H")]])];
    const next = migrateCanvasComponents(top);
    const roles = next.map((c) => c.sectionRole);
    assert.deepEqual(roles, ["header", "content"]);
  });

  it("sees rows through Grapes tbody wrappers", () => {
    const top: CanvasCompJson[] = [
      {
        type: "email-section",
        sectionRole: "content",
        attributes: {
          "data-role": "content",
          "data-section-role": "content",
        },
        components: [
          {
            type: "tbody",
            tagName: "tbody",
            components: [
              {
                type: "email-row",
                components: [
                  {
                    type: "email-column",
                    components: [text("ThroughTbody")],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    assert.equal(isCanonicalContentCanvas(top[0]!), true);
    const next = migrateCanvasComponents(top);
    assert.equal(next, top);
  });
});
