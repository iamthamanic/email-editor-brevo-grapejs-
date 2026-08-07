/**
 * P0 regression: wrapped Brevo body must not collapse to social-only.
 * Location: packages/legacy-importer/src/wrapped-production.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseHTML } from "linkedom";
import { convertBrevoHtml } from "./convert.js";
import { findEmailRoot, resolveContentRoot } from "./parser/findEmailRoot.js";
import { stripBrevoNoise, stripUnsafe } from "./parser/sanitize.js";
import { isSocialCluster } from "./recognition/social.js";
import { parseBrevoHtml } from "./parser/parseBrevoHtml.js";
import { normalizedEmailToGrapesComponents } from "./mapper/toGrapesJs.js";
import type { EmailBlock, NormalizedEmailDocument } from "./types.js";

const html = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/wrapped-production-brevo.html",
  ),
  "utf8",
);

function allBlocks(doc: NormalizedEmailDocument): EmailBlock[] {
  return doc.children.flatMap((s) => s.columns.flatMap((c) => c.children));
}

const REQUIRED_PARAMS = [
  "anrede",
  "name",
  "datum.vier.tage.vor.ablauf",
  "bestellnummer",
  "adresse",
  "plz",
  "stadt",
  "datum_von",
  "datum_bis",
  "uhrzeit_von",
  "uhrzeit_bis",
  "detaillierte.angaben",
];

const REQUIRED_TEXT = [
  "Sehr geehrte/r",
  "wir hoffen, dass Ihr Vorhaben",
  "Auftragsdetails",
  "Mit freundlichen Grüßen",
  "Wussten Sie schon?",
  "Browo GmbH",
];

describe("P0 wrapped Brevo root + social greed", () => {
  it("findEmailRoot selects inner 600 content table, not outer 100% wrapper", () => {
    const { document } = parseHTML(html);
    stripUnsafe(document.documentElement);
    stripBrevoNoise(document.documentElement);
    const outer = document.querySelector("table.nl2go-body-table")!;
    assert.equal(outer.getAttribute("width"), "100%");
    const resolved = resolveContentRoot(outer);
    assert.equal(resolved.getAttribute("width"), "600");
    const info = findEmailRoot(document);
    assert.equal(info.root.getAttribute("width"), "600");
    assert.equal(info.width, 600);
    const rows = [
      ...info.root.querySelectorAll(":scope > tbody > tr, :scope > tr"),
    ];
    assert.ok(rows.length >= 5, `expected >=5 section rows, got ${rows.length}`);
  });

  it("outer wrapper cell is NOT a social cluster", () => {
    const { document } = parseHTML(html);
    const outerTd = document.querySelector(
      "table.nl2go-body-table > tbody > tr > td, table.nl2go-body-table > tr > td",
    );
    assert.ok(outerTd);
    assert.equal(isSocialCluster(outerTd!), false);
  });

  it("NormalizedEmailDocument keeps all major sections and content", () => {
    const doc = parseBrevoHtml(html);
    assert.ok(
      doc.children.length >= 5,
      `sections=${doc.children.length}`,
    );

    const blocks = allBlocks(doc);
    const types = blocks.map((b) => b.type);
    assert.ok(types.includes("image"), "logo/cert image missing");
    assert.ok(types.filter((t) => t === "rich-text").length >= 3);
    assert.equal(types.filter((t) => t === "social-links").length, 1);
    assert.ok(
      types.includes("company-information") ||
        doc.children.some((s) => s.columns.length === 2),
      "footer columns missing",
    );

    const blob = JSON.stringify(doc);
    for (const t of REQUIRED_TEXT) {
      assert.ok(blob.includes(t), `missing text: ${t}`);
    }
    for (const p of REQUIRED_PARAMS) {
      assert.ok(
        blob.includes(p) || blob.includes(`params.${p}`),
        `missing param: ${p}`,
      );
    }
    assert.match(blob, /logo-full\.png/);
    assert.match(blob, /certs\.png/);
    assert.match(blob, /g\.page\/r\/example-review|Google Review/);
    assert.match(blob, /portal\.halteverbot123\.de|kundenportal/i);
    assert.match(blob, /tiktok\.com/);
  });

  it("mapper emits email-param pills inside rich-text HTML", () => {
    const doc = parseBrevoHtml(html);
    const components = normalizedEmailToGrapesComponents(doc);
    const json = JSON.stringify(components);
    // Badges live as HTML spans inside email-text (single RTE host — no double caret)
    assert.match(json, /data-email-type=\\"email-param\\"|data-param-key=/);
    assert.match(json, /data-param-key=\\"anrede\\"/);
    assert.match(json, /data-param-key=\\"name\\"/);
    assert.match(json, /datum\.vier\.tage\.vor\.ablauf/);
    const paramCount = (json.match(/data-param-key=/g) || []).length;
    assert.ok(paramCount >= 12, `param pills=${paramCount}`);
  });

  it("header is section role=header with brand logo image child", () => {
    const doc = parseBrevoHtml(html);
    const headers = doc.children.filter((s) => s.role === "header");
    assert.equal(headers.length, 1);
    const logo = headers[0]!.columns[0]!.children.filter(
      (b) => b.type === "image" && b.role === "brand-logo",
    );
    assert.equal(logo.length, 1);

    const components = normalizedEmailToGrapesComponents(doc);
    assert.equal(components[0]?.type, "email-section");
    assert.equal(
      (components[0]?.attributes as Record<string, string>)?.["data-role"],
      "header",
    );
    assert.match(JSON.stringify(components[0]), /logo-full\.png/);
    assert.match(JSON.stringify(components[0]), /"type":"email-image"/);
  });

  it("footer 50/50 — logo image + contact richtext | cert image", () => {
    const doc = parseBrevoHtml(html);
    const footer = doc.children.find(
      (s) => s.role === "footer" || s.role === "corporate-footer",
    );
    assert.ok(footer);
    assert.equal(footer!.columns.length, 2);
    assert.equal(footer!.columns[0]?.width, 50);
    assert.equal(footer!.columns[1]?.width, 50);
    const left = footer!.columns[0]!.children;
    const right = footer!.columns[1]!.children;
    assert.equal(
      left.filter((b) => b.type === "image" && b.role === "brand-logo").length,
      1,
    );
    assert.equal(left.filter((b) => b.type === "rich-text").length, 1);
    assert.equal(
      left.filter((b) => b.type === "company-information").length,
      0,
    );
    assert.equal(right.filter((b) => b.type === "image").length, 1);

    const components = normalizedEmailToGrapesComponents(doc);
    const json = JSON.stringify(components);
    assert.match(json, /"data-role":"footer"/);
    assert.match(json, /co-logo\.png/);
    assert.match(json, /certs\.png/);
    assert.doesNotMatch(json, /"type":"company-contact"/);

    function walk(node: unknown, hits: string[]): void {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const n of node) walk(n, hits);
        return;
      }
      const o = node as Record<string, unknown>;
      if (o.type === "email-image") {
        const src = String(
          (o.attributes as Record<string, string> | undefined)?.src ?? "",
        );
        if (src.includes("co-logo.png")) hits.push(src);
      }
      for (const v of Object.values(o)) walk(v, hits);
    }
    const hits: string[] = [];
    walk(components, hits);
    assert.equal(hits.length, 1, `co-logo as email-image once: ${hits.length}`);
  });

  it("review/portal/website links are not buttons", () => {
    const doc = parseBrevoHtml(html);
    const buttons = allBlocks(doc).filter((b) => b.type === "button");
    assert.equal(buttons.length, 0);
    const blob = JSON.stringify(doc);
    assert.match(blob, /g\.page\/r\/example-review/);
    assert.match(blob, /portal\.halteverbot123\.de/);
  });

  it("mapper emits multiple grapes components (not social-only)", () => {
    const doc = parseBrevoHtml(html);
    const components = normalizedEmailToGrapesComponents(doc);
    assert.ok(components.length >= 5, `components=${components.length}`);
    const types = components.map((c) => c.type);
    assert.ok(types.every((t) => t === "email-section"));
    const roles = components.map(
      (c) => (c.attributes as Record<string, string>)?.["data-role"],
    );
    assert.ok(roles.includes("header"));
    assert.ok(roles.includes("footer"));
    assert.ok(roles.includes("social"));
    const json = JSON.stringify(components);
    assert.match(json, /email-text|Sehr geehrte/);
    assert.match(json, /email-image|logo-full/);
    assert.match(json, /company-social|data-social-items/);
    assert.ok(
      !(
        components.length === 1 &&
        json.includes("company-social") &&
        !json.includes("email-text") &&
        !json.includes("Sehr geehrte")
      ),
    );
  });

  it("full convert preserves inventory and never auto-approves social-only collapse", () => {
    const { document, components, report } = convertBrevoHtml(html);
    assert.ok(document.children.length >= 5);
    assert.ok(report.richTextCount >= 3);
    assert.ok(report.imageCount >= 2);
    assert.equal(report.socialGroupCount, 1);
    assert.ok(components.length >= 5);

    for (const p of REQUIRED_PARAMS) {
      assert.ok(
        report.sourceParams.includes(p),
        `source missing ${p}: ${report.sourceParams.join(",")}`,
      );
      assert.ok(
        report.outputParams.includes(p),
        `output missing ${p}: ${report.outputParams.join(",")}`,
      );
    }
    assert.equal(report.variables.preserved, report.variables.expected);
    assert.equal(report.images.preserved, report.images.expected);
    assert.equal(report.links.preserved, report.links.expected);
    assert.equal(report.textPreserved, true);

    // Explicit anti-collapse invariant
    const onlySocial =
      document.children.length === 1 &&
      allBlocks(document).every((b) => b.type === "social-links");
    assert.equal(onlySocial, false);
    if (onlySocial) {
      assert.equal(report.autoApproved, false);
    }
  });

  it("email-section mapping does not nest table directly under table", () => {
    const doc = parseBrevoHtml(html);
    const components = normalizedEmailToGrapesComponents(doc);
    for (const sec of components) {
      if (sec.type !== "email-section") continue;
      const kids = sec.components;
      assert.ok(Array.isArray(kids));
      const first = (kids as { tagName?: string; type?: string }[])[0];
      assert.ok(first);
      assert.notEqual(first.type, "company-social");
      assert.notEqual(first.tagName?.toLowerCase(), "table");
    }
  });
});
