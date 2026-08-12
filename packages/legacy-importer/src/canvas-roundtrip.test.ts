/**
 * R1 golden: Brevo/native HTML → convert → publish HTML → convert is idempotent.
 * Location: packages/legacy-importer/src/canvas-roundtrip.test.ts
 * Acceptance: `.qa/acceptance/canvas-roundtrip-hardening.md`
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { convertBrevoHtml } from "./convert.js";
import type { EmailBlock, NormalizedEmailDocument } from "./document.js";
import { grapesComponentsToPublishHtml } from "./serializeGrapesHtml.js";

const root = dirname(fileURLToPath(import.meta.url));

const FIXTURES = [
  "wrapped-production-brevo.html",
  "production-brevo-template-4.html",
] as const;

const EXPECTED_ROLES = ["header", "content", "footer", "social"] as const;

function loadFixture(name: string): string {
  return readFileSync(join(root, "../fixtures", name), "utf8");
}

function inventoryBlocks(blocks: EmailBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "layout-row") {
      out.push("layout-row");
      for (const col of b.columns) {
        for (const t of inventoryBlocks(col.children)) {
          out.push(`lr>${t}`);
        }
      }
    } else {
      out.push(b.type);
    }
  }
  return out;
}

/** Structural fingerprint — roles + column counts + block-type inventory. */
function treeFingerprint(doc: NormalizedEmailDocument) {
  return doc.children.map((sec) => ({
    role: sec.role ?? "content",
    cols: sec.columns.length,
    blocks: sec.columns.flatMap((c) => inventoryBlocks(c.children)),
  }));
}

function roundTripTwice(html: string) {
  const pass1 = convertBrevoHtml(html);
  const pub1 = grapesComponentsToPublishHtml(pass1.components);
  const pass2 = convertBrevoHtml(pub1);
  const pub2 = grapesComponentsToPublishHtml(pass2.components);
  const pass3 = convertBrevoHtml(pub2);
  return { pass1, pass2, pass3, pub1, pub2 };
}

describe("canvas round-trip hardening (R1)", () => {
  for (const name of FIXTURES) {
    it(`${name}: convert → publish → convert is idempotent`, () => {
      const html = loadFixture(name);
      const { pass1, pass2, pass3, pub1 } = roundTripTwice(html);

      assert.deepEqual(
        pass1.document.children.map((s) => s.role ?? "content"),
        [...EXPECTED_ROLES],
        "first pass roles",
      );
      assert.deepEqual(
        treeFingerprint(pass1.document),
        treeFingerprint(pass2.document),
        "pass1 → pass2 fingerprint",
      );
      assert.deepEqual(
        treeFingerprint(pass2.document),
        treeFingerprint(pass3.document),
        "pass2 → pass3 noop (idempotent)",
      );

      assert.match(pub1, /data-email-type="email-section"/);
      assert.match(pub1, /data-section-role="content"/);
      assert.match(pub1, /data-role="header"/);
    });
  }

  it("native multi-content export coalesces once then stays stable", () => {
    const multi = [
      `<table data-email-type="email-section" data-role="header" data-section-role="header" width="100%">
        <tr data-email-type="email-row"><td data-email-type="email-column">
          <img data-email-type="email-image" src="https://img.example/logo.png" alt="L"/>
        </td></tr>
      </table>`,
      `<table data-email-type="email-section" data-role="content" data-section-role="content" width="100%">
        <tr data-email-type="email-row"><td data-email-type="email-column">
          <div data-email-type="email-text"><p>A</p></div>
        </td></tr>
      </table>`,
      `<table data-email-type="email-section" data-role="content" data-section-role="content" width="100%">
        <tr data-email-type="email-row"><td data-email-type="email-column">
          <div data-email-type="email-text"><p>B</p></div>
        </td></tr>
      </table>`,
      `<table data-email-type="email-section" data-role="footer" data-section-role="footer" width="100%">
        <tr data-email-type="email-row">
          <td data-email-type="email-column" width="50%"><div data-email-type="email-text">L</div></td>
          <td data-email-type="email-column" width="50%"><div data-email-type="email-text">R</div></td>
        </tr>
      </table>`,
      `<table data-email-type="email-section" data-role="social" data-section-role="social" width="100%">
        <tr data-email-type="email-row"><td data-email-type="email-column">
          <div data-email-type="company-social" data-social-items='[{"network":"x","href":"https://x.com"}]'></div>
        </td></tr>
      </table>`,
    ].join("\n");

    const { pass1, pass2, pass3 } = roundTripTwice(multi);
    assert.deepEqual(
      pass1.document.children.map((s) => s.role ?? "content"),
      ["header", "content", "footer", "social"],
    );
    const content = pass1.document.children.find((s) => s.role === "content")!;
    assert.equal(content.columns.length, 1);
    assert.equal(
      content.columns[0]!.children.filter((b) => b.type === "rich-text").length,
      2,
    );
    const footer = pass1.document.children.find((s) => s.role === "footer")!;
    assert.equal(footer.columns.length, 2);

    assert.deepEqual(
      treeFingerprint(pass1.document),
      treeFingerprint(pass2.document),
    );
    assert.deepEqual(
      treeFingerprint(pass2.document),
      treeFingerprint(pass3.document),
    );
  });

  it("layout-row inside content survives publish re-import", () => {
    const html = `<table data-email-type="email-section" data-role="content" data-section-role="content" width="100%">
      <tr data-email-type="email-row"><td data-email-type="email-column">
        <div data-email-type="email-text"><p>Above</p></div>
        <table data-email-type="email-layout-row" data-layout="columns" data-layout-cols="2" width="100%">
          <tr data-email-type="email-row">
            <td data-email-type="email-column" width="50%"><div data-email-type="email-text"><p>L</p></div></td>
            <td data-email-type="email-column" width="50%"><div data-email-type="email-text"><p>R</p></div></td>
          </tr>
        </table>
        <div data-email-type="email-text"><p>Below</p></div>
      </td></tr>
    </table>`;

    const { pass1, pass2, pass3 } = roundTripTwice(html);
    const fp1 = treeFingerprint(pass1.document);
    assert.ok(
      fp1.some((s) => s.blocks.includes("layout-row")),
      `expected layout-row in ${JSON.stringify(fp1)}`,
    );
    assert.deepEqual(fp1, treeFingerprint(pass2.document));
    assert.deepEqual(
      treeFingerprint(pass2.document),
      treeFingerprint(pass3.document),
    );
  });

  it("empty HTML stays stable on second pass", () => {
    const { pass1, pass2, pass3 } = roundTripTwice("");
    assert.deepEqual(
      treeFingerprint(pass1.document),
      treeFingerprint(pass2.document),
    );
    assert.deepEqual(
      treeFingerprint(pass2.document),
      treeFingerprint(pass3.document),
    );
  });
});
