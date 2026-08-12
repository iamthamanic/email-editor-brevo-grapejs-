import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { createTemplateViaModal } from "./helpers/createTemplate";

/**
 * Verify-UI: our-side drop-in readiness (conflict UI + docs + storage).
 * Location: apps/editor/e2e/our-side-dropin-ready.spec.ts (mirror of .qa/runs/2026-08-10-our-side-dropin-ready.spec.ts)
 */

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const evidenceDir = path.join(repoRoot, ".qa/evidence/our-side-dropin-ready");
const unique = `Conflict-UI-${Date.now()}`;

function loadDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    const envPath = path.join(repoRoot, "apps/api/.env");
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const m = line.match(/^DATABASE_URL=(.*)$/);
        if (m) {
          process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
          break;
        }
      }
    }
  }
  // Prisma on macOS often fails resolving localhost → ::1 while Postgres listens on 127.0.0.1
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
      "@localhost:",
      "@127.0.0.1:",
    );
  }
}

test.describe("our-side-dropin-ready docs (no DB)", () => {
  test("docs + AssetStorageProvider exist on disk", () => {
    fs.mkdirSync(evidenceDir, { recursive: true });
    expect(
      fs.existsSync(path.join(repoRoot, "docs/EMBED_CONTRACT.md")),
    ).toBeTruthy();
    expect(fs.existsSync(path.join(repoRoot, "docs/FEATURES.md"))).toBeTruthy();
    expect(
      fs.existsSync(path.join(repoRoot, "docs/en/FEATURES.md")),
    ).toBeTruthy();
    const features = fs.readFileSync(
      path.join(repoRoot, "docs/FEATURES.md"),
      "utf8",
    );
    expect(features).toMatch(/brevo-sync.*implemented/i);
    expect(features).toMatch(/legacy-importer.*implemented/i);
    expect(features).toMatch(/security-erp.*implemented/i);
    expect(
      fs.existsSync(path.join(repoRoot, "apps/api/src/assets/provider.ts")),
    ).toBeTruthy();
    expect(
      fs.existsSync(
        path.join(repoRoot, "apps/api/src/assets/localDiskStorage.ts"),
      ),
    ).toBeTruthy();
  });
});

test.describe("our-side-dropin-ready conflict UI", () => {
  let seededId: string | null = null;
  let prisma: PrismaClient;

  test.beforeAll(async () => {
    loadDatabaseUrl();
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL missing — start Postgres and set apps/api/.env");
    }
    prisma = new PrismaClient();
    fs.mkdirSync(evidenceDir, { recursive: true });
    // Warm connection with retry (docker may still be starting)
    let lastErr: unknown;
    for (let i = 0; i < 10; i++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    if (lastErr) throw lastErr;

    const pending = {
      html: "<html><body><p>Remote version from Brevo</p></body></html>",
      name: unique,
      subject: "Remote subject",
      senderName: null as string | null,
      senderEmail: "test@example.com",
      replyTo: null as string | null,
      label: null as string | null,
      fetchedAt: new Date().toISOString(),
      htmlHash: "abc123",
    };
    const row = await prisma.emailTemplate.create({
      data: {
        name: unique,
        subject: "Local subject",
        status: "CONFLICT",
        source: "BREVO",
        editorData: {
          __etsImport: 1,
          components: [
            {
              type: "email-text",
              content: "<p>Local draft keep me</p>",
            },
          ],
        },
        publishedHtml: "<p>Old published</p>",
        editorSchemaVersion: 2,
        conversionMeta: {
          editorSchemaVersion: 2,
          conversionVersion: 4,
          conversionSource: "brevo",
          pendingRemote: pending,
        },
        revision: 3,
        lastSyncedAt: new Date(),
      },
    });
    seededId = row.id;
  });

  test.afterAll(async () => {
    if (seededId) {
      await prisma.emailTemplate
        .delete({ where: { id: seededId } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  test("conflict badge + resolve actions in list and keep_local", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    expect(seededId).toBeTruthy();

    await page.goto("/");
    await expect(page.getByTestId("template-card-list")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("template-list-search").fill(unique);

    const row = page
      .getByTestId("template-list-row")
      .filter({ hasText: unique })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("CONFLICT", { exact: true })).toBeVisible();

    await page.screenshot({
      path: path.join(evidenceDir, "01-conflict-badge.png"),
      fullPage: true,
    });

    await row.getByTestId("template-row-menu").click();
    const panel = page.getByTestId("template-row-menu-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("template-row-resolve-remote")).toBeVisible();
    await expect(panel.getByTestId("template-row-resolve-local")).toBeVisible();

    await page.screenshot({
      path: path.join(evidenceDir, "02-resolve-actions.png"),
      fullPage: true,
    });

    page.once("dialog", (d) => {
      void d.accept();
    });
    await panel.getByTestId("template-row-resolve-local").click();

    await expect(
      page
        .getByTestId("template-list-row")
        .filter({ hasText: unique })
        .getByText("DRAFT", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: path.join(evidenceDir, "03-after-keep-local.png"),
      fullPage: true,
    });

    const after = await prisma.emailTemplate.findUnique({
      where: { id: seededId! },
    });
    expect(after?.status).toBe("DRAFT");
    const blob = JSON.stringify(after?.editorData ?? {});
    expect(blob).toContain("Local draft keep me");
  });

  test("editor conflict banner resolve remote", async ({ page }) => {
    test.setTimeout(90_000);
    const name = `${unique}-editor`;
    const row = await prisma.emailTemplate.create({
      data: {
        name,
        status: "CONFLICT",
        source: "BREVO",
        editorData: {
          __etsImport: 1,
          components: [{ type: "email-text", content: "<p>Before remote</p>" }],
        },
        publishedHtml: "<p>old</p>",
        editorSchemaVersion: 2,
        conversionMeta: {
          editorSchemaVersion: 2,
          conversionVersion: 4,
          conversionSource: "brevo",
          pendingRemote: {
            html: "<html><body><table><tr><td><p>Remote body ok</p></td></tr></table></body></html>",
            name,
            subject: "S",
            senderName: null,
            senderEmail: null,
            replyTo: null,
            label: null,
            fetchedAt: new Date().toISOString(),
            htmlHash: "def456",
          },
        },
        revision: 1,
      },
    });

    try {
      await page.goto(`/templates/${row.id}`);
      await expect(page.getByTestId("sync-conflict-banner")).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByTestId("conflict-accept-remote")).toBeVisible();
      await expect(page.getByTestId("conflict-keep-local")).toBeVisible();

      await page.screenshot({
        path: path.join(evidenceDir, "04-editor-conflict-banner.png"),
        fullPage: true,
      });

      await page.getByTestId("conflict-accept-remote").click();
      await expect(page.getByTestId("sync-conflict-banner")).toBeHidden({
        timeout: 15_000,
      });

      await page.screenshot({
        path: path.join(evidenceDir, "05-after-accept-remote.png"),
        fullPage: true,
      });

      const updated = await prisma.emailTemplate.findUnique({
        where: { id: row.id },
      });
      expect(updated?.status).toBe("DRAFT");
    } finally {
      await prisma.emailTemplate
        .delete({ where: { id: row.id } })
        .catch(() => undefined);
    }
  });

  test("resolve without conflict returns 400", async ({ request }) => {
    const created = await request.post("http://127.0.0.1:3001/api/templates", {
      data: { name: `${unique}-clean` },
      headers: { "Content-Type": "application/json" },
    });
    expect(created.ok()).toBeTruthy();
    const body = (await created.json()) as {
      data: { id: string; revision: number };
    };
    const id = body.data.id;
    const res = await request.post(
      `http://127.0.0.1:3001/api/templates/${id}/resolve-sync`,
      {
        data: { action: "keep_local", expectedRevision: body.data.revision },
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(res.status()).toBe(400);
    await request.delete(`http://127.0.0.1:3001/api/templates/${id}`);
  });

  test("regression: list + Brevo sync button + open editor", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await expect(page.getByTestId("template-card-list")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: /Von Brevo laden/i }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "06-regression-list.png"),
      fullPage: true,
    });
    // Prefer opening an existing card over full create modal (subject field timing)
    const firstEdit = page.getByTestId("template-card-edit").first();
    if (await firstEdit.count()) {
      await firstEdit.click();
    } else {
      await createTemplateViaModal(page, `${unique}-regression`);
    }
    await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({
      path: path.join(evidenceDir, "07-regression-editor.png"),
      fullPage: true,
    });
  });
});
