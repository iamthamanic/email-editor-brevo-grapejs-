/**
 * Editor-native HTML (sibling email-section tables) must keep section roles.
 * Location: packages/legacy-importer/src/editor-native-roundtrip.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { convertBrevoHtml } from "./convert.js";
import { normalizedEmailToGrapesComponents } from "./mapper/toGrapesJs.js";
import { parseBrevoHtml } from "./parser/parseBrevoHtml.js";
import {
  hasEditorSectionMarkers,
  parseEditorNativeHtml,
} from "./parser/parseEditorNativeHtml.js";

const fixture = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/wrapped-production-brevo.html",
  ),
  "utf8",
);

const EXPECTED_ROLES = ["header", "content", "footer", "social"] as const;

function rolesOf(doc: { children: Array<{ role?: string }> }) {
  return doc.children.map((s) => s.role ?? "content");
}

/** Minimal Grapes-like export: sibling section tables (legacy multi-content). */
function grapesExportHtml(): string {
  return [
    `<table data-email-type="email-section" data-role="header" data-section-role="header" width="100%">
      <tr data-email-type="email-row"><td data-email-type="email-column">
        <img data-email-type="email-image" src="https://img.mailinblue.com/logo-full.png" data-role="brand-logo" alt="Logo"/>
      </td></tr>
    </table>`,
    `<table data-email-type="email-section" data-role="content" data-section-role="content" width="100%">
      <tr data-email-type="email-row"><td data-email-type="email-column">
        <div data-email-type="email-text" data-role="main-content"><p>Main</p></div>
      </td></tr>
    </table>`,
    `<table data-email-type="email-section" data-role="content" data-section-role="content" width="100%">
      <tr data-email-type="email-row"><td data-email-type="email-column">
        <div data-email-type="email-text"><p>Signature</p></div>
      </td></tr>
    </table>`,
    `<table data-email-type="email-section" data-role="content" data-section-role="content" width="100%">
      <tr data-email-type="email-row"><td data-email-type="email-column">
        <div data-email-type="email-text"><p>Portal</p></div>
      </td></tr>
    </table>`,
    `<table data-email-type="email-section" data-role="footer" data-section-role="footer" width="100%">
      <tr data-email-type="email-row">
        <td data-email-type="email-column" width="50%">
          <img data-email-type="email-image" src="https://x/co-logo.png" data-role="brand-logo"/>
          <div data-email-type="email-text" data-role="company-contact">Firma</div>
        </td>
        <td data-email-type="email-column" width="50%">
          <img data-email-type="email-image" src="https://x/certs.png" data-role="certifications"/>
        </td>
      </tr>
    </table>`,
    `<table data-email-type="email-section" data-role="social" data-section-role="social" width="100%">
      <tr data-email-type="email-row"><td data-email-type="email-column">
        <div data-email-type="company-social" data-social-items='[{"network":"tiktok","href":"https://tiktok.com"}]'></div>
      </td></tr>
    </table>`,
  ].join("\n");
}

describe("editor-native HTML roundtrip preserves section ownership", () => {
  it("native path coalesces multi content into one canvas", () => {
    const html = grapesExportHtml();
    assert.equal(hasEditorSectionMarkers(html), true);

    const native = parseEditorNativeHtml(html);
    assert.deepEqual(rolesOf(native), [...EXPECTED_ROLES]);
    const content = native.children.find((s) => s.role === "content")!;
    assert.equal(content.columns.length, 1);
    const texts = content.columns[0]!.children.filter(
      (b) => b.type === "rich-text",
    );
    assert.equal(texts.length, 3);

    const viaConvert = convertBrevoHtml(html);
    assert.deepEqual(rolesOf(viaConvert.document), [...EXPECTED_ROLES]);
    assert.deepEqual(
      viaConvert.components.map(
        (c) => (c.attributes as Record<string, string>)?.["data-role"],
      ),
      [...EXPECTED_ROLES],
    );

    const footer = viaConvert.document.children.find((s) => s.role === "footer")!;
    assert.equal(footer.columns.length, 2);
    assert.equal(
      footer.columns[0]!.children.filter((b) => b.type === "image").length,
      1,
    );
    assert.equal(
      footer.columns[0]!.children.filter((b) => b.type === "rich-text").length,
      1,
    );
    assert.equal(
      footer.columns[1]!.children.filter((b) => b.type === "image").length,
      1,
    );
  });

  it("golden production: mapper emits single content canvas + chrome", () => {
    const doc = parseBrevoHtml(fixture);
    assert.deepEqual(rolesOf(doc), [...EXPECTED_ROLES]);
    const comps = normalizedEmailToGrapesComponents(doc);
    assert.deepEqual(
      comps.map((c) => (c as { sectionRole?: string }).sectionRole),
      [...EXPECTED_ROLES],
    );
    assert.deepEqual(
      comps.map(
        (c) => (c.attributes as Record<string, string>)?.["data-section-role"],
      ),
      [...EXPECTED_ROLES],
    );

    const headerJson = JSON.stringify(comps[0]);
    assert.match(headerJson, /email-image/);
    assert.match(headerJson, /logo-full/);

    const footer = comps.find(
      (c) =>
        (c.attributes as Record<string, string>)?.["data-role"] === "footer",
    )!;
    const footerCols = (
      (footer.components as Array<{ components?: unknown[] }>)[0]
        ?.components ?? []
    ).length;
    assert.equal(footerCols, 2);

    const social = comps.find(
      (c) =>
        (c.attributes as Record<string, string>)?.["data-role"] === "social",
    )!;
    assert.match(JSON.stringify(social), /company-social/);
  });
});
