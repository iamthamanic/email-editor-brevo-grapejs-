import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const rows = await p.emailSavedSection.findMany({
  where: {
    OR: [{ name: { startsWith: "AGB" } }, { name: { startsWith: "Angebot" } }],
  },
  select: { name: true, sectionData: true },
  orderBy: { name: "asc" },
});
for (const r of rows) {
  const c = String((r.sectionData as { content?: string })?.content ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 110);
  console.log(r.name);
  console.log("  ", c);
  console.log();
}
await p.$disconnect();
