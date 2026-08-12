/**
 * Legacy hash batch migration — DB integration tests.
 * Location: apps/api/src/templates/migrateLegacyHashes.test.ts
 */

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import type { AuthUser } from "@email-template/email-schema";
import { prisma } from "../db.js";
import { migrateLegacyHashes } from "./migrateLegacyHashes.js";

const actor: AuthUser = {
  id: "test-hash-migrator",
  displayName: "Hash Migrator",
  permissions: ["email_templates.edit", "email_templates.read"],
};

let dbOk = false;
const createdIds: string[] = [];

before(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
});

after(async () => {
  if (!dbOk) return;
  for (const id of createdIds) {
    await prisma.emailTemplate.deleteMany({ where: { id } });
  }
});

describe("migrateLegacyHashes", () => {
  it("rewrites subject/html hashes and is idempotent", async () => {
    if (!dbOk) {
      console.log("SKIP migrateLegacyHashes DB tests — no Postgres");
      return;
    }

    const row = await prisma.emailTemplate.create({
      data: {
        name: "TEST legacy hash migrate",
        subject: "Bestellnummer: HV123-#BESTELLNR# - #ADRESSE#",
        publishedHtml:
          "<p>Hallo #KUNDE_NAME#</p><title>###BWB_ZEICHEN###</title>",
        editorData: {
          pages: [
            {
              frames: [
                {
                  component: {
                    components: [{ type: "text", content: "#LANGE#" }],
                  },
                },
              ],
            },
          ],
        },
        status: "DRAFT",
        revision: 1,
      },
    });
    createdIds.push(row.id);

    const first = await migrateLegacyHashes(actor, { ids: [row.id] });
    const hit = first.items.find((i) => i.id === row.id);
    assert.ok(hit);
    assert.ok(hit.fields.includes("subject"));
    assert.ok(hit.fields.includes("publishedHtml"));
    assert.equal(hit.reconverted, true);

    const updated = await prisma.emailTemplate.findUniqueOrThrow({
      where: { id: row.id },
    });
    assert.equal(
      updated.subject,
      "Bestellnummer: HV123-{{ params.bestellnummer }} - {{ params.adresse }}",
    );
    assert.match(updated.publishedHtml ?? "", /\{\{\s*params\.name\s*\}\}/);
    assert.match(updated.publishedHtml ?? "", /\{\{\s*params\.bwb\.id\s*\}\}/);
    assert.ok(!/#BESTELLNR#|#KUNDE_NAME#|#BWB_ZEICHEN#/.test(
      `${updated.subject}\n${updated.publishedHtml}\n${JSON.stringify(updated.editorData)}`,
    ));
    assert.ok(
      updated.editorData &&
        typeof updated.editorData === "object" &&
        "__etsImport" in (updated.editorData as object),
    );

    const second = await migrateLegacyHashes(actor, { ids: [row.id] });
    assert.equal(
      second.items.find((i) => i.id === row.id),
      undefined,
    );
  });
});
