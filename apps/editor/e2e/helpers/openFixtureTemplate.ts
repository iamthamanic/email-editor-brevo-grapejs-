import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Open an editor template seeded from a committed GrapesJS editorData fixture.
 * Location: apps/editor/e2e/helpers/openFixtureTemplate.ts
 *
 * Avoids Dev-DB / Brevo dependency so structural-host bugs stay reproducible.
 */

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

export type FixtureName = "structural-template" | "multi-content-template";

function loadEditorData(name: FixtureName): Record<string, unknown> {
  const raw = readFileSync(path.join(fixturesDir, `${name}.json`), "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * POST /api/templates with fixture editorData, then navigate to the editor.
 * @returns template id
 */
export async function openFixtureTemplate(
  page: Page,
  fixture: FixtureName = "structural-template",
  name = `Fixture-${fixture}-${Date.now()}`,
): Promise<string> {
  const editorData = loadEditorData(fixture);

  const created = await page.evaluate(
    async ({ name: templateName, editorData: data }) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          subject: "E2E Structural Fixture",
          editorData: data,
        }),
      });
      const json = (await res.json()) as {
        data?: { id?: string };
        id?: string;
        error?: unknown;
      };
      if (!res.ok) {
        throw new Error(
          `createTemplate failed ${res.status}: ${JSON.stringify(json)}`,
        );
      }
      const id = json.data?.id ?? json.id;
      if (!id) throw new Error(`createTemplate missing id: ${JSON.stringify(json)}`);
      return id;
    },
    { name, editorData },
  );

  await page.goto(`/templates/${created}`);
  await expect(page.locator(".gjs-host")).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      async () =>
        page
          .frameLocator(".gjs-frame")
          .first()
          .locator('[data-email-type="email-text"]')
          .count(),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);

  await page.waitForFunction(() =>
    Boolean((window as Window & { __emailEditor?: unknown }).__emailEditor),
  );

  return created;
}

/** Seed a content textbaustein for drop tests; returns its id. */
export async function seedTextbaustein(
  page: Page,
  title = `E2E-TB-${Date.now()}`,
  text?: string,
): Promise<string> {
  // Unique body so API content-hash dedupe does not return an older section
  // under a different name (search by title would then find nothing).
  const body =
    text ??
    `Eingefügter Textbaustein ${title} mit {{ params.vorname }}.`;
  return page.evaluate(
    async ({ title: t, text: content }) => {
      const res = await fetch("/api/saved-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t,
          role: "content",
          sectionData: {
            type: "email-text",
            name: t,
            attributes: {
              "data-email-type": "email-text",
              "data-textbaustein-title": t,
            },
            content: content.replace(/\n/g, "<br/>"),
          },
        }),
      });
      const json = (await res.json()) as {
        data?: { id?: string; name?: string };
        id?: string;
      };
      if (!res.ok) {
        throw new Error(
          `createSavedSection failed ${res.status}: ${JSON.stringify(json)}`,
        );
      }
      const id = json.data?.id ?? json.id;
      if (!id) throw new Error("createSavedSection missing id");
      return id;
    },
    { title, text: body },
  );
}
