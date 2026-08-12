/**
 * One-off runner: migrate legacy #TOKEN# → params in local DB.
 * Usage: npx tsx scripts/run-migrate-legacy-hashes.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hasLegacyHashTokens } from "@email-template/email-variables";
import { migrateLegacyHashes } from "../src/templates/migrateLegacyHashes.js";

async function main(): Promise<void> {
  const actor = {
    id: "dev-hash-migrate",
    displayName: "Dev Hash Migrate",
    permissions: ["email_templates.edit", "email_templates.read"],
  };
  const result = await migrateLegacyHashes(actor);
  console.log(JSON.stringify(result, null, 2));

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.emailTemplate.findMany({
      select: {
        brevoTemplateId: true,
        name: true,
        subject: true,
        publishedHtml: true,
        editorData: true,
      },
    });
    const leftover = rows.filter(
      (r) =>
        hasLegacyHashTokens(r.subject || "") ||
        hasLegacyHashTokens(r.publishedHtml || "") ||
        hasLegacyHashTokens(JSON.stringify(r.editorData || {})),
    );
    console.log("leftover with known hashes:", leftover.length);
    for (const r of leftover) {
      console.log("#" + String(r.brevoTemplateId ?? "?"), r.name);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
