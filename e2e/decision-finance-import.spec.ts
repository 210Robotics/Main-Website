import { randomUUID } from "node:crypto";
import { clerk } from "@clerk/testing/playwright";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_CLERK_USER_EMAIL;
const databaseUrl = process.env.DATABASE_URL;

test("decision matrices rank editable designs and finance sheets import", async ({
  page,
}) => {
  test.skip(
    !adminEmail || !databaseUrl,
    "Operations E2E credentials are not configured.",
  );
  test.setTimeout(180_000);

  const sql = neon(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const matrixTitle = `Matrix import E2E ${suffix}`;
  const financeItem = `Finance import E2E ${suffix}`;

  async function cleanup() {
    await sql`delete from operations_hub_records where title = ${matrixTitle}`;
    await sql`delete from finance_entries where description = ${financeItem}`;
  }

  try {
    await cleanup();
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: adminEmail! });

    await page.goto("/admin/control-center?tab=decisions");
    await expect(
      page.getByRole("heading", { name: "Concept comparison matrix" }),
    ).toBeVisible();
    await expect(
      page.getByText("Live weighted result", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add design row" }).click();
    await expect(page.getByLabel("Design option 3")).toHaveValue("Concept C");

    const matrixImport = page
      .getByRole("heading", { name: "Import a decision matrix" })
      .locator("xpath=ancestor::section[1]");
    await matrixImport.getByLabel("Decision title (optional)").fill(matrixTitle);
    await matrixImport.getByLabel("Decision matrix file").setInputFiles({
      name: "matrix.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        [
          "Design,Requirement fit,Cost",
          "Weight,60,40",
          "Goal,Score,Lower",
          `${matrixTitle} Alpha,8,1000`,
          `${matrixTitle} Beta,7,500`,
        ].join("\n"),
      ),
    });
    await matrixImport
      .getByRole("button", { name: "Import and rank designs" })
      .click();
    await expect(
      matrixImport.getByText(/Imported 2 designs across 2 criteria/),
    ).toBeVisible();

    const history = page
      .locator("details")
      .filter({ hasText: matrixTitle })
      .first();
    await expect(
      history.getByText(`${matrixTitle} Beta`, { exact: true }),
    ).toBeVisible();
    const [savedMatrix] = await sql`
      select data->>'winner' as winner
      from operations_hub_records
      where title = ${matrixTitle}
      limit 1
    `;
    expect(savedMatrix?.winner).toBe(`${matrixTitle} Beta`);

    await page.goto("/admin/operations?tool=finance");
    const financeImport = page
      .getByRole("heading", { name: "Import finances" })
      .locator("xpath=ancestor::section[1]");
    await financeImport.getByLabel("Finance spreadsheet").setInputFiles({
      name: "finance.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        [
          "Item,Quantity,Unit Cost,Type,Category,Vendor,Status",
          `${financeItem},2,45.50,Expense,Robot parts,Test Vendor,Approved`,
        ].join("\n"),
      ),
    });
    await financeImport
      .getByRole("button", { name: "Import finance rows" })
      .click();
    await expect(financeImport.getByText("Imported 1 finance row.")).toBeVisible();
    const [savedFinance] = await sql`
      select quantity, unit_cost_cents, amount_cents, kind, status
      from finance_entries
      where description = ${financeItem}
      limit 1
    `;
    expect(savedFinance).toMatchObject({
      quantity: 2,
      unit_cost_cents: 4550,
      amount_cents: 9100,
      kind: "EXPENSE",
      status: "APPROVED",
    });
  } finally {
    await cleanup();
  }
});
