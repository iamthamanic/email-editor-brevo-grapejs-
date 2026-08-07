/**
 * Unit tests for Brevo HTML → NormalizedEmailDocument → GrapesJS.
 * Location: packages/legacy-importer/src/convert.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  convertBrevoHtml,
  needsConversion,
  parseBrevoHtml,
  tokenizeParams,
} from "./index.js";
import type { EmailBlock, NormalizedEmailDocument } from "./types.js";

const fixDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

function load(name: string): string {
  return readFileSync(join(fixDir, name), "utf8");
}

function allBlocks(doc: NormalizedEmailDocument): EmailBlock[] {
  return doc.children.flatMap((s) => s.columns.flatMap((c) => c.children));
}

function assertPreservation(html: string): void {
  const { document, components, report } = convertBrevoHtml(html);
  assert.ok(document.version === 1);
  assert.ok(components.length >= 1);
  assert.equal(report.variables.preserved, report.variables.expected);
  assert.equal(report.images.preserved, report.images.expected);
  assert.equal(report.links.preserved, report.links.expected);
  assert.equal(report.textPreserved, true);
}

describe("tokenizeParams", () => {
  it("splits text and params", () => {
    const parts = tokenizeParams("Hallo {{ params.vorname }}, x");
    assert.equal(parts.length, 3);
    assert.equal(parts[0]?.type, "textnode");
    assert.equal(parts[1]?.type, "email-param");
    assert.equal(parts[1]?.attributes?.["data-param-key"], "vorname");
  });

  it("keeps nested param paths", () => {
    const parts = tokenizeParams("{{ params.polizei.vorgangsnummer }}");
    assert.equal(
      parts[0]?.attributes?.["data-param-key"],
      "polizei.vorgangsnummer",
    );
  });
});

describe("rich text formatting", () => {
  it("preserves p/br/strong/color/link — not flattened plaintext", () => {
    const html = load("rich-text-formatting.html");
    const { document, components } = convertBrevoHtml(html);
    const blocks = allBlocks(document);
    const rt = blocks.find((b) => b.type === "rich-text");
    assert.ok(rt && rt.type === "rich-text");
    assert.match(rt.html, /<p>/i);
    assert.match(rt.html, /<strong>Max<\/strong>/i);
    assert.match(rt.html, /<br\s*\/?>/i);
    assert.match(rt.html, /color\s*:\s*#ff0000/i);
    assert.match(rt.html, /<a[^>]+href="https:\/\/example\.com\/info"/i);
    assert.doesNotMatch(rt.html, /^Hallo Max Test$/);
    const json = JSON.stringify(components);
    assert.match(json, /"tagName":"strong"|<strong>Max<\/strong>/);
    assert.doesNotMatch(json, /id="isPasted"/);
    assert.doesNotMatch(json, /data-fr-linked/);
  });
});

describe("nested params", () => {
  it("preserves deep param paths through document and grapes emit", () => {
    const html = load("nested-params.html");
    const { document, components, report } = convertBrevoHtml(html);
    const json = JSON.stringify({ document, components });
    for (const key of [
      "name",
      "detaillierte.angaben",
      "datum.vier.tage.vor.ablauf",
      "nested.path",
    ]) {
      assert.ok(
        json.includes(key) || json.includes(`params.${key}`),
        `missing ${key}`,
      );
    }
    assert.equal(report.variables.expected, 4);
    assert.equal(report.variables.preserved, 4);
  });
});

describe("logo header", () => {
  it("recognizes nested image table as image block", () => {
    const { document } = convertBrevoHtml(load("logo-header.html"));
    const blocks = allBlocks(document);
    const img = blocks.find((b) => b.type === "image");
    assert.ok(img && img.type === "image");
    assert.match(img.src, /brand-logo\.png/);
    assert.equal(img.width, 200);
    assert.ok(blocks.every((b) => b.type !== "legacy-html"));
  });
});

describe("two columns", () => {
  it("builds 50/50 section columns", () => {
    const { document } = convertBrevoHtml(load("two-columns.html"));
    assert.equal(document.children.length, 1);
    const sec = document.children[0]!;
    assert.equal(sec.columns.length, 2);
    assert.equal(sec.columns[0]?.width, 50);
    assert.equal(sec.columns[1]?.width, 50);
    const json = JSON.stringify(document);
    assert.match(json, /params\.stadt|stadt/);
  });
});

describe("company footer", () => {
  it("keeps 50/50 company + cert without collapsing to legacy", () => {
    const { document, report } = convertBrevoHtml(load("company-footer.html"));
    const sec = document.children.find((s) => s.columns.length === 2);
    assert.ok(sec);
    assert.equal(sec!.columns[0]?.width, 50);
    assert.equal(sec!.columns[1]?.width, 50);
    const left = sec!.columns[0]!.children;
    const right = sec!.columns[1]!.children;
    assert.ok(
      left.some(
        (b) =>
          b.type === "company-information" ||
          b.type === "rich-text" ||
          b.type === "image",
      ),
    );
    assert.ok(right.some((b) => b.type === "image"));
    assert.ok(!allBlocks(document).every((b) => b.type === "legacy-html"));
    assert.equal(report.images.preserved, report.images.expected);
  });
});

describe("social links", () => {
  it("aggregates five networks into one social-links block", () => {
    const { document, components } = convertBrevoHtml(load("social-links.html"));
    const social = allBlocks(document).filter((b) => b.type === "social-links");
    assert.equal(social.length, 1);
    if (social[0]?.type === "social-links") {
      assert.equal(social[0].items.length, 5);
      const nets = social[0].items.map((i) => i.network).sort();
      assert.deepEqual(nets, [
        "facebook",
        "instagram",
        "linkedin",
        "tiktok",
        "youtube",
      ]);
    }
    const json = JSON.stringify(components);
    assert.match(json, /company-social|data-social-items/);
  });
});

describe("full production fixture", () => {
  it("yields semantic sections and preserves inventory", () => {
    const html = load("full-production-brevo.html");
    assertPreservation(html);
    const { document, report } = convertBrevoHtml(html);
    assert.ok(document.settings.width === 600);
    assert.ok(report.sectionCount >= 4);
    assert.ok(report.socialGroupCount >= 1);
    assert.ok(report.imageCount >= 2);
    assert.ok(report.richTextCount >= 2);
    const blocks = allBlocks(document);
    assert.ok(blocks.some((b) => b.type === "image"));
    assert.ok(blocks.some((b) => b.type === "rich-text"));
    assert.ok(blocks.some((b) => b.type === "social-links"));
  });
});

describe("convertBrevoHtml simple-brevo", () => {
  it("converts fixture into email blocks and preserves params/images/links", () => {
    const fixture = load("simple-brevo.html");
    const { components, report, document } = convertBrevoHtml(fixture);
    assert.ok(components.length >= 3);
    assert.ok(document.children.length >= 3);
    const json = JSON.stringify(components);
    assert.match(json, /email-image|email-text|email-section|email-columns/);
    assert.match(json, /vorname|params\.vorname/);
    assert.match(json, /bestellnummer/);
    assert.match(json, /logo\.png/);
    assert.match(json, /example\.com\/order/);
    assert.equal(report.variables.expected, 4);
    assert.equal(report.variables.preserved, report.variables.expected);
    assert.equal(report.images.expected, 1);
    assert.equal(report.images.preserved, 1);
    assert.equal(report.links.expected, 1);
    assert.equal(report.links.preserved, 1);
  });

  it("does not execute or keep script tags", () => {
    const { components, document } = convertBrevoHtml(
      `<table width="600"><tr><td class="nl2go-default-textstyle">Hi<script>alert(1)</script></td></tr></table>`,
    );
    const json = JSON.stringify({ components, document });
    assert.doesNotMatch(json, /<script/i);
    assert.doesNotMatch(json, /alert\(1\)/);
  });

  it("does not drop deep nested text (legacy only as last resort)", () => {
    const { document } = convertBrevoHtml(
      `<table class="nl2go-body-table" width="600"><tr><td><table><tr><td><table><tr><td class="nl2go-default-textstyle">deep</td></tr></table></td></tr></table></td></tr></table>`,
    );
    const json = JSON.stringify(document);
    assert.match(json, /deep/);
  });
});

describe("parseBrevoHtml isolation", () => {
  it("returns document without grapes types", () => {
    const doc = parseBrevoHtml(load("simple-text.html"));
    assert.equal(doc.version, 1);
    const json = JSON.stringify(doc);
    assert.doesNotMatch(json, /email-section|email-text|email-param/);
    assert.match(json, /"type":"rich-text"/);
  });
});

describe("needsConversion", () => {
  it("true only when editor empty and html present", () => {
    assert.equal(needsConversion({}, "<p>x</p>"), true);
    assert.equal(needsConversion({ pages: [] }, "<p>x</p>"), false);
    assert.equal(needsConversion({}, ""), false);
    assert.equal(needsConversion(null, "<p>x</p>"), true);
  });
});
