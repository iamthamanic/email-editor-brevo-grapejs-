/**
 * Golden fixture: production Brevo transactional template #4 (raw htmlContent).
 * Location: packages/legacy-importer/src/production-brevo-template-4.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { convertBrevoHtml } from "./convert.js";
import { parseBrevoHtml } from "./parser/parseBrevoHtml.js";

const html = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/production-brevo-template-4.html",
  ),
  "utf8",
);

describe("production Brevo template #4", () => {
  it("recognizes roles exactly [header, content, footer, social]", () => {
    const doc = parseBrevoHtml(html);
    const roles = doc.children.map((s) => s.role ?? "content");
    assert.deepEqual(roles, ["header", "content", "footer", "social"]);
    const content = doc.children.find((s) => s.role === "content");
    assert.ok(content);
    assert.equal(content!.columns.length, 1);
  });

  it("footer is nested 50/50 columns (company | cert)", () => {
    const doc = parseBrevoHtml(html);
    const footer = doc.children.find((s) => s.role === "footer");
    assert.ok(footer, "footer section missing");
    assert.equal(footer!.columns.length, 2);
    assert.ok(
      (footer!.columns[0]!.width ?? 0) >= 40 &&
        (footer!.columns[0]!.width ?? 0) <= 60,
    );
    assert.ok(
      (footer!.columns[1]!.width ?? 0) >= 40 &&
        (footer!.columns[1]!.width ?? 0) <= 60,
    );
    const leftTypes = footer!.columns[0]!.children.map((b) => b.type);
    const rightTypes = footer!.columns[1]!.children.map((b) => b.type);
    assert.ok(leftTypes.includes("image") || leftTypes.includes("rich-text"));
    assert.ok(rightTypes.includes("image"));
  });

  it("mapper emits sectionRole on every section incl. content", () => {
    const { components } = convertBrevoHtml(html);
    const roles = components.map((c) => {
      const attrs = c.attributes ?? {};
      return (
        c.sectionRole ||
        attrs["data-section-role"] ||
        attrs["data-role"] ||
        ""
      );
    });
    assert.deepEqual(roles, ["header", "content", "footer", "social"]);
    assert.ok(
      components.every(
        (c) =>
          c.sectionRole &&
          c.attributes?.["data-section-role"] === c.sectionRole &&
          c.attributes?.["data-role"] === c.sectionRole,
      ),
    );
  });

  it("footer left=logo+contact, right=cert; contact is compact (no spacers)", () => {
    const doc = parseBrevoHtml(html);
    const footer = doc.children.find((s) => s.role === "footer");
    assert.ok(footer);
    assert.equal(footer!.columns.length, 2);

    const left = footer!.columns[0]!;
    const right = footer!.columns[1]!;
    const leftTypes = left.children.map((b) => b.type);
    assert.ok(leftTypes.includes("image"), `left=${leftTypes}`);
    assert.ok(leftTypes.includes("rich-text"), `left=${leftTypes}`);
    assert.ok(
      !leftTypes.includes("spacer"),
      "contact must not use spacer blocks between lines",
    );

    const contact = left.children.find((b) => b.type === "rich-text") as {
      html: string;
      role?: string;
    };
    assert.equal(contact.role, "company-contact");
    assert.match(contact.html, /Browo GmbH/i);
    assert.match(contact.html, /Späthstraße|Spaethstrasse|Späthstrasse/i);
    assert.match(contact.html, /12359 Berlin/);
    assert.match(contact.html, /halteverbot123\.de/i);
    assert.match(contact.html, /info123@halteverbot123\.de/i);
    // Compact: single block, tight line-height — not spacer stacks
    assert.match(contact.html, /line-height:\s*1(\.25)?/);
    assert.ok(
      !/<p[^>]*>\s*<br/i.test(contact.html),
      "no empty paragraph gaps",
    );
    const lineCount =
      (contact.html.match(/<p\b/gi) ?? []).length +
      (contact.html.match(/<br\s*\/?>/gi) ?? []).length;
    assert.ok(lineCount >= 4, `expected several contact lines, got ${lineCount}`);

    const logo = left.children.find((b) => b.type === "image") as {
      width?: number;
      role?: string;
    };
    assert.equal(logo.role, "brand-logo");
    assert.ok(
      (logo.width ?? 0) >= 180,
      `logo should keep Brevo width (~229), got ${logo.width}`,
    );

    const rightTypes = right.children.map((b) => b.type);
    assert.deepEqual(rightTypes, ["image"]);
    assert.equal(
      (right.children[0] as { role?: string }).role,
      "certifications",
    );
    assert.ok(
      ((right.children[0] as { width?: number }).width ?? 0) >= 200,
      "cert image should keep Brevo width (~270)",
    );
  });

  it("social is separate, centered, with expected networks", () => {
    const { document, components } = convertBrevoHtml(html);
    assert.equal(document.children.at(-1)?.role, "social");
    const socialComp = components.find((c) => c.sectionRole === "social");
    assert.ok(socialComp);
    const blob = JSON.stringify(socialComp);
    assert.match(blob, /text-align":"center"|text-align:center/);
    assert.match(blob, /tiktok/i);
    assert.match(blob, /linkedin/i);
    assert.match(blob, /instagram/i);
    assert.match(blob, /facebook/i);
    assert.match(blob, /youtube/i);
  });
});
