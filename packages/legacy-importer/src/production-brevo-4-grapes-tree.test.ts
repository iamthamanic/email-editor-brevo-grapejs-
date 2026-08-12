/**
 * Grapes component-tree smoke for production Brevo #4 (no browser).
 * Location: packages/legacy-importer/src/production-brevo-4-grapes-tree.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { convertBrevoHtml } from "./convert.js";
import type { GrapesComponentDef } from "./types.js";

const html = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/production-brevo-template-4.html",
  ),
  "utf8",
);

function walk(nodes: GrapesComponentDef[] | string | undefined): GrapesComponentDef[] {
  if (!nodes || typeof nodes === "string") return [];
  const out: GrapesComponentDef[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...walk(n.components));
  }
  return out;
}

describe("production #4 Grapes tree", () => {
  it("footer has two 50% columns; social centered below", () => {
    const { components } = convertBrevoHtml(html);
    const footer = components.find((c) => c.sectionRole === "footer");
    const social = components.find((c) => c.sectionRole === "social");
    assert.ok(footer && social);

    const footerRow = (footer!.components as GrapesComponentDef[])[0]!;
    const cols = footerRow.components as GrapesComponentDef[];
    assert.equal(cols.length, 2);
    assert.equal(cols[0]!.attributes?.width, "50%");
    assert.equal(cols[1]!.attributes?.width, "50%");

    const leftKids = walk(cols[0]!.components);
    assert.ok(leftKids.some((c) => c.type === "email-image"));
    assert.ok(leftKids.some((c) => c.type === "email-text"));
    const logo = leftKids.find((c) => c.type === "email-image");
    assert.ok(
      Number(logo?.attributes?.width ?? 0) >= 180,
      `logo width should be Brevo-sized, got ${logo?.attributes?.width}`,
    );
    assert.equal(cols[0]!.attributes?.align, "left");
    assert.equal(cols[1]!.attributes?.align, "center");
    assert.equal(cols[0]!.columnWidth, 50);
    assert.equal(cols[1]!.columnWidth, 50);

    const contact = leftKids.find((c) => c.type === "email-text");
    const contactHtml = String(contact?.content ?? JSON.stringify(contact?.components));
    assert.match(contactHtml, /line-height:\s*1\.25/);
    assert.ok(!leftKids.some((c) => c.type === "email-spacer"));

    const rightKids = walk(cols[1]!.components);
    assert.ok(
      rightKids.some(
        (c) =>
          c.type === "email-image" &&
          (c.attributes?.["data-role"] === "certifications" ||
            c.attributes?.["data-role"] === "certifications"),
      ),
    );

    const socialBlob = JSON.stringify(social);
    assert.match(socialBlob, /text-align":"center"|text-align:center/);
    assert.ok(components.indexOf(footer!) < components.indexOf(social!));
  });
});
