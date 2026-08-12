/**
 * Brevo editor migration — mocked gateway + failure safety.
 * Location: apps/api/src/templates/migrateBrevoEditor.test.ts
 *
 * Requires Postgres (same DATABASE_URL as API). Skips when DB unreachable.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before, after } from "node:test";
import {
  CURRENT_EDITOR_SCHEMA_VERSION,
  ERROR_CODES,
  type AuthUser,
} from "@email-template/email-schema";
import { prisma } from "../db.js";
import { BrevoApiError } from "../brevo/client.js";
import { migrateBrevoEditor } from "./migrateBrevoEditor.js";
import { ServiceError } from "./service.js";

const actor: AuthUser = {
  id: "test-actor",
  displayName: "Test Actor",
  permissions: ["email_templates.edit", "email_templates.read"],
};

const fixtureHtml = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../packages/legacy-importer/fixtures/production-brevo-template-4.html",
  ),
  "utf8",
);

const corruptedEditor = {
  pages: [{ frames: [{ component: { components: [] } }] }],
  note: "collapsed-corruption-stub",
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

describe("migrateBrevoEditor", () => {
  it("skips when DB unavailable", { skip: false }, () => {
    if (!dbOk) {
      console.log("SKIP migrateBrevoEditor DB tests — no Postgres");
    }
    assert.ok(true);
  });

  it("migrates from Brevo GET, backups, sets schema version; idempotent after", async (t) => {
    if (!dbOk) {
      t.skip("Postgres unavailable");
      return;
    }

    const row = await prisma.emailTemplate.create({
      data: {
        name: "Migration Test #4",
        brevoTemplateId: BigInt(9_000_004),
        status: "DRAFT",
        source: "BREVO",
        editorData: corruptedEditor,
        publishedHtml: "<html><body>corrupted editor export</body></html>",
        editorSchemaVersion: 0,
        revision: 1,
      },
    });
    createdIds.push(row.id);

    let fetchCount = 0;
    const result = await migrateBrevoEditor(row.id, actor, {
      fetchBrevoTemplate: async (id) => {
        fetchCount += 1;
        assert.equal(id, 9_000_004);
        return { htmlContent: fixtureHtml, modifiedAt: "2026-08-01T12:00:00.000Z" };
      },
    });

    assert.equal(result.migrated, true);
    assert.ok(result.backupVersionId);
    assert.equal(result.template.editorSchemaVersion, CURRENT_EDITOR_SCHEMA_VERSION);
    assert.equal(result.template.migrationRequired, false);
    assert.equal(fetchCount, 1);

    const backup = await prisma.templateVersion.findUnique({
      where: { id: result.backupVersionId! },
    });
    assert.ok(backup);
    assert.equal(backup!.reason, "pre_brevo_editor_migration");
    assert.deepEqual(backup!.editorData, corruptedEditor);

    const comps = result.template.editorData.components as Array<{
      sectionRole?: string;
    }>;
    assert.ok(Array.isArray(comps) && comps.length >= 4);
    assert.deepEqual(
      comps.map((c) => c.sectionRole),
      ["header", "content", "footer", "social"],
    );

    // Idempotent — no second Brevo fetch / no overwrite
    const again = await migrateBrevoEditor(row.id, actor, {
      fetchBrevoTemplate: async () => {
        fetchCount += 1;
        return { htmlContent: fixtureHtml };
      },
    });
    assert.equal(again.migrated, false);
    assert.equal(fetchCount, 1);
  });

  it("keeps old editorData when Brevo fetch fails", async (t) => {
    if (!dbOk) {
      t.skip("Postgres unavailable");
      return;
    }

    const row = await prisma.emailTemplate.create({
      data: {
        name: "Migration Fail Fetch",
        brevoTemplateId: BigInt(9_000_005),
        status: "DRAFT",
        source: "BREVO",
        editorData: corruptedEditor,
        editorSchemaVersion: 0,
        revision: 3,
      },
    });
    createdIds.push(row.id);

    await assert.rejects(
      () =>
        migrateBrevoEditor(row.id, actor, {
          fetchBrevoTemplate: async () => {
            throw new BrevoApiError("boom", 503);
          },
        }),
      (err: unknown) => {
        assert.ok(err instanceof ServiceError);
        assert.equal(err.code, ERROR_CODES.MIGRATION_FAILED);
        return true;
      },
    );

    const kept = await prisma.emailTemplate.findUnique({ where: { id: row.id } });
    assert.equal(kept!.revision, 3);
    assert.equal(kept!.editorSchemaVersion, 0);
    assert.deepEqual(kept!.editorData, corruptedEditor);
  });

  it("keeps old editorData when convert fails (empty invalid html)", async (t) => {
    if (!dbOk) {
      t.skip("Postgres unavailable");
      return;
    }

    const row = await prisma.emailTemplate.create({
      data: {
        name: "Migration Fail Convert",
        brevoTemplateId: BigInt(9_000_006),
        status: "DRAFT",
        source: "BREVO",
        editorData: corruptedEditor,
        editorSchemaVersion: 0,
        revision: 2,
      },
    });
    createdIds.push(row.id);

    // Empty HTML → MIGRATION_FAILED before write
    await assert.rejects(
      () =>
        migrateBrevoEditor(row.id, actor, {
          fetchBrevoTemplate: async () => ({ htmlContent: "   " }),
        }),
      (err: unknown) => {
        assert.ok(err instanceof ServiceError);
        assert.equal(err.code, ERROR_CODES.MIGRATION_FAILED);
        return true;
      },
    );

    const kept = await prisma.emailTemplate.findUnique({ where: { id: row.id } });
    assert.equal(kept!.revision, 2);
    assert.deepEqual(kept!.editorData, corruptedEditor);
  });

  it("rejects templates without brevoTemplateId", async (t) => {
    if (!dbOk) {
      t.skip("Postgres unavailable");
      return;
    }

    const row = await prisma.emailTemplate.create({
      data: {
        name: "Local only",
        status: "DRAFT",
        source: "LOCAL",
        editorData: corruptedEditor,
        editorSchemaVersion: 0,
        revision: 1,
      },
    });
    createdIds.push(row.id);

    await assert.rejects(
      () => migrateBrevoEditor(row.id, actor),
      (err: unknown) => {
        assert.ok(err instanceof ServiceError);
        assert.equal(err.code, ERROR_CODES.VALIDATION);
        return true;
      },
    );
  });
});
