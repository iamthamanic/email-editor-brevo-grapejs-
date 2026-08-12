import { test, expect } from "@playwright/test";

/**
 * Template list cards: overflow menu, single + bulk delete, info modal.
 * Location: apps/editor/e2e/template-list-actions.spec.ts
 */

test.describe("Template list actions", () => {
  test("card list menu edit/info/delete + bulk delete", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const nameA = `ListActions A ${stamp}`;
    const nameB = `ListActions B ${stamp}`;

    const createA = await request.post("http://localhost:3001/api/templates", {
      data: { name: nameA, label: "Kampagne", subject: "Betreff A" },
    });
    expect(createA.ok()).toBeTruthy();
    const bodyA = await createA.json();
    expect(bodyA.data?.label).toBe("Kampagne");
    const idA = bodyA.data.id as string;

    const createB = await request.post("http://localhost:3001/api/templates", {
      data: { name: nameB, subject: "Betreff B" },
    });
    expect(createB.ok()).toBeTruthy();
    const bodyB = await createB.json();
    expect(bodyB.data?.label).toBeNull();

    const insights = await request.get(
      `http://localhost:3001/api/templates/${idA}/insights`,
    );
    expect(insights.ok()).toBeTruthy();
    const insightsBody = await insights.json();
    expect(insightsBody.data.logs.length).toBeGreaterThan(0);
    expect(insightsBody.data.logs[0].actorDisplayName).toBeTruthy();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "E-Mail Templates" })).toBeVisible();
    await expect(page.getByTestId("template-list")).toBeVisible();
    await expect(page.getByTestId("template-card-list")).toBeVisible();

    const search = page.getByTestId("template-list-search");
    await search.fill(String(stamp));
    await expect(page.getByTestId("template-list-row")).toHaveCount(2);

    const rowA = page
      .getByTestId("template-list-row")
      .filter({ hasText: nameA });
    await expect(rowA).toContainText(nameA);

    await rowA.getByTestId("template-row-menu").click();
    await expect(page.getByTestId("template-row-menu-panel")).toBeVisible();
    await expect(page.getByTestId("template-row-publish")).toBeVisible();
    await page.getByTestId("template-row-duplicate").click();
    const copyRow = page
      .getByTestId("template-list-row")
      .filter({ hasText: `(Kopie` })
      .filter({ hasText: nameA });
    await expect(copyRow).toBeVisible({ timeout: 10_000 });
    await expect(copyRow).toContainText(/Kopiert am \d{2}\.\d{2}\.\d{4}/);

    // Copies stay pinned above non-copies for the same search
    await search.fill(String(stamp));
    const rows = page.getByTestId("template-list-row");
    await expect(rows.first()).toContainText("(Kopie");

    const copyId = await request
      .get("http://localhost:3001/api/templates")
      .then(async (res) => {
        const body = await res.json();
        const hit = (body.data as Array<{ id: string; name: string }>).find(
          (t) => t.name.startsWith("(Kopie") && t.name.includes(nameA),
        );
        return hit?.id;
      });
    expect(copyId).toBeTruthy();
    if (copyId) {
      const delCopy = await request.delete(
        `http://localhost:3001/api/templates/${copyId}`,
      );
      expect(delCopy.ok()).toBeTruthy();
    }

    await search.fill(String(stamp));
    await expect(page.getByTestId("template-list-row")).toHaveCount(2);

    await rowA.getByTestId("template-row-menu").click();
    await expect(page.getByTestId("template-row-menu-panel")).toBeVisible();
    await page.getByTestId("template-row-info").click();
    await expect(page.getByTestId("template-info-modal")).toBeVisible();
    await expect(page.getByTestId("template-info-logs")).toContainText("Dev User");
    await page.getByTestId("template-info-tab-stats").click();
    await expect(page.getByTestId("template-info-stats")).toBeVisible();
    await expect(page.getByTestId("template-stats-csv")).toBeVisible();
    await page.getByTestId("template-info-close").click();
    await expect(page.getByTestId("template-info-modal")).toHaveCount(0);

    page.once("dialog", (dialog) => void dialog.accept());
    await rowA.getByTestId("template-row-menu").click();
    await page.getByTestId("template-row-delete").click();
    await expect(page.getByTestId("template-list-row").filter({ hasText: nameA })).toHaveCount(
      0,
      { timeout: 10_000 },
    );

    await search.fill(nameB);
    const rowB = page.getByTestId("template-list-row").filter({ hasText: nameB });
    await expect(rowB).toBeVisible();

    await rowB.getByTestId("template-row-select").check();
    await expect(page.getByTestId("template-bulk-bar")).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByTestId("template-bulk-delete").click();
    await expect(page.getByTestId("template-list-row").filter({ hasText: nameB })).toHaveCount(
      0,
      { timeout: 10_000 },
    );

    const editCreate = await request.post("http://localhost:3001/api/templates", {
      data: { name: `ListActions Edit ${stamp}` },
    });
    expect(editCreate.ok()).toBeTruthy();
    const editId = (await editCreate.json()).data.id as string;

    await page.goto("/");
    await search.fill(`ListActions Edit ${stamp}`);
    const editRow = page
      .getByTestId("template-list-row")
      .filter({ hasText: `ListActions Edit ${stamp}` });
    await editRow.getByTestId("template-row-menu").click();
    await page.getByTestId("template-row-edit").click();
    await expect(page).toHaveURL(new RegExp(`/templates/${editId}`));

    const del = await request.delete(`http://localhost:3001/api/templates/${editId}`);
    expect(del.ok()).toBeTruthy();
  });
});
