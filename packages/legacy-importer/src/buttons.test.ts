/**
 * Button recognition regression — plain links must stay rich-text.
 * Location: packages/legacy-importer/src/buttons.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertBrevoHtml } from "./convert.js";
import { looksLikeButton, isButtonOnlyRoot } from "./recognition/buttons.js";
import { parseHTML } from "linkedom";

function el(html: string): Element {
  const { document } = parseHTML(`<div id="r">${html}</div>`);
  return document.getElementById("r")!.firstElementChild!;
}

describe("button recognition", () => {
  it("plain inline link is NOT a button", () => {
    const root = el(
      `<p><a href="https://example.com" style="padding:4px;">Normaler Link</a></p>`,
    );
    assert.equal(looksLikeButton(root), false);
  });

  it("nl2go textstyle with prose + link is NOT button-only", () => {
    const root = el(
      `<div class="nl2go-default-textstyle"><p>Mit freundlichen Grüßen</p><p><a href="https://g.page/r/example-review" style="padding:2px;color:#00f;">Google Review</a></p></div>`,
    );
    assert.equal(isButtonOnlyRoot(root), false);
  });

  it("real Brevo-style CTA with background is a button", () => {
    const root = el(
      `<a class="default-button" href="https://example.com/cta" style="background-color:#275073;border-radius:4px;padding:12px 24px;color:#fff;">Jetzt buchen</a>`,
    );
    assert.equal(looksLikeButton(root), true);
  });

  it("production review + portal links stay rich-text, not buttons", () => {
    const html = `
      <table width="600"><tr><td class="nl2go-default-textstyle">
        <p><a href="https://g.page/r/CSJ8B4fVirujEAE/review" style="padding:2px;">Google Review</a></p>
        <p>👉 <a href="https://portal.halteverbot123.de" style="padding:4px;color:blue;">Hier klicken für Ihren Zugang</a></p>
        <p><a href="https://www.halteverbot123.de">www.halteverbot123.de</a></p>
      </td></tr></table>`;
    const { document } = convertBrevoHtml(html);
    const blocks = document.children.flatMap((s) =>
      s.columns.flatMap((c) => c.children),
    );
    assert.equal(
      blocks.filter((b) => b.type === "button").length,
      0,
      "expected zero buttons",
    );
    const rt = blocks.find((b) => b.type === "rich-text");
    assert.ok(rt && rt.type === "rich-text");
    assert.match(rt.html, /g\.page|review/i);
    assert.match(rt.html, /portal\.halteverbot123/);
    assert.match(rt.html, /halteverbot123\.de/);
  });

  it("td bgcolor wrapper scores as button", () => {
    const root = el(
      `<td bgcolor="#275073"><a href="https://example.com/x" style="color:#fff;">CTA</a></td>`,
    );
    assert.equal(looksLikeButton(root), true);
  });
});
