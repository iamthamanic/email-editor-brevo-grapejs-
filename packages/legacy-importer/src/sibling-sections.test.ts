/**
 * Real Brevo shape: sibling modular section tables inside width=600 cell.
 * Location: packages/legacy-importer/src/sibling-sections.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { parseHTML } from "linkedom";
import { convertBrevoHtml } from "./convert.js";
import { parseBrevoHtml } from "./parser/parseBrevoHtml.js";
import {
  findEmailRoot,
  resolveContentRoot,
} from "./parser/findEmailRoot.js";
import { stripBrevoNoise, stripUnsafe } from "./parser/sanitize.js";

const html = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/sibling-sections-brevo.html",
  ),
  "utf8",
);

describe("sibling Brevo section tables", () => {
  it("unwraps to 600 canvas even when it has a single row", () => {
    const { document } = parseHTML(html);
    stripUnsafe(document.documentElement);
    stripBrevoNoise(document.documentElement);
    const outer = document.querySelector("table.nl2go-body-table")!;
    const resolved = resolveContentRoot(outer);
    assert.equal(resolved.getAttribute("width"), "600");
    const info = findEmailRoot(document);
    assert.equal(info.root.getAttribute("width"), "600");
  });

  it("recognizes header / content / footer / social roles", () => {
    const doc = parseBrevoHtml(html);
    const roles = doc.children.map((s) => s.role ?? "content");
    assert.ok(roles[0] === "header", `roles=${roles.join(",")}`);
    assert.ok(roles.includes("footer"), `roles=${roles.join(",")}`);
    assert.ok(roles.includes("social"), `roles=${roles.join(",")}`);
    assert.equal(
      roles.filter((r) => r === "content").length,
      1,
      `roles=${roles.join(",")}`,
    );
    assert.ok(doc.children.length >= 4, `sections=${doc.children.length}`);
  });

  it("mapper emits distinct top-level section roles", () => {
    const { components } = convertBrevoHtml(html);
    const roles = components.map(
      (c) => (c.attributes as Record<string, string>)?.["data-role"],
    );
    assert.deepEqual(roles[0], "header");
    assert.ok(roles.includes("footer"));
    assert.ok(roles.includes("social"));
    assert.equal(roles.filter((r) => r === "content").length, 1);
    assert.ok(
      roles.every(
        (r) =>
          r === "header" ||
          r === "content" ||
          r === "footer" ||
          r === "social",
      ),
    );
  });
});
