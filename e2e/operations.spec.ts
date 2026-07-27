import { randomUUID } from "node:crypto";
import { clerk } from "@clerk/testing/playwright";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_CLERK_USER_EMAIL;
const databaseUrl = process.env.DATABASE_URL;

test("operations supports itemized budgets, part quantities, and task approval", async ({
  page,
}) => {
  test.skip(
    !adminEmail || !databaseUrl,
    "Operations E2E credentials are not configured.",
  );
  test.setTimeout(180_000);

  const sql = neon(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const marker = `Operations E2E ${suffix}`;
  const partNumber = `E2E-${suffix}`;
  const taskId = randomUUID();
  const [member] = await sql`
    select id from members where lower(email) = lower(${adminEmail!}) and status = 'ACTIVE' limit 1
  `;
  expect(member?.id).toBeTruthy();
  const memberId = String(member.id);

  async function cleanupOperationsQa() {
    await sql`delete from member_tasks where title like 'Operations E2E %'`;
    await sql`
      delete from finance_sponsor_commitments where plan_id in (select id from finance_plans where name like 'Operations E2E %')
    `;
    await sql`
      delete from finance_entries where plan_id in (select id from finance_plans where name like 'Operations E2E %')
    `;
    await sql`delete from finance_plans where name like 'Operations E2E %'`;
    await sql`delete from engineering_parts where part_number like 'E2E-%'`;
  }

  try {
    await cleanupOperationsQa();
    await sql`
      insert into member_tasks (id, assigned_to_member_id, created_by_member_id, title, description, project, priority, status)
      values (${taskId}, ${memberId}, ${memberId}, ${marker}, 'Submit this task for completion approval.', 'E2E', 'NORMAL', 'TODO')
    `;

    await page.goto("/");
    await clerk.signIn({ page, emailAddress: adminEmail! });

    await page.goto("/portal?tab=tasks");
    const memberTask = page.locator("details").filter({ hasText: marker });
    await memberTask.locator("summary").click();
    await memberTask.getByLabel("Progress").selectOption("IN_REVIEW");
    await memberTask
      .getByRole("button", { name: "Save progress / submit" })
      .click();
    await expect(
      memberTask.getByText(/A task manager must approve it/i),
    ).toBeVisible();

    await page.goto("/admin/operations?tool=tasks");
    const adminTask = page
      .locator("details")
      .filter({ hasText: marker })
      .first();
    await adminTask.locator("summary").click();
    await expect(
      adminTask.getByText("Completion approval", { exact: true }),
    ).toBeVisible();
    await adminTask.getByRole("button", { name: "Approve completion" }).click();
    await expect(adminTask.getByText(/^Approved/)).toBeVisible();

    const [approvedTask] = await sql`
      select status, approved_at from member_tasks where id = ${taskId}
    `;
    expect(approvedTask?.status).toBe("DONE");
    expect(approvedTask?.approved_at).toBeTruthy();

    await page.goto("/admin/operations?tool=finance");
    await expect(
      page.getByRole("heading", { name: "Financial planning and ledger" }),
    ).toBeVisible();
    const createPlan = page
      .getByRole("heading", { name: "Create a budget plan" })
      .locator("xpath=ancestor::section[1]");
    await createPlan.getByLabel("Plan name").fill(marker);
    await createPlan.locator('input[name="project"]').fill("E2E");
    await createPlan.getByLabel("Minimum budget").fill("250");
    await createPlan.getByLabel("Maximum budget").fill("750");
    await createPlan.getByRole("button", { name: "Create plan" }).click();
    await expect(page.getByText("Plan created.")).toBeVisible();

    const plan = page
      .getByRole("heading", { name: marker, exact: true })
      .locator("xpath=ancestor::details[1]");
    if (
      !(await plan.evaluate((element) => (element as HTMLDetailsElement).open))
    )
      await plan.locator("summary").click();
    const budgetRange = plan
      .getByRole("heading", { name: "Budget range" })
      .locator("xpath=ancestor::section[1]");
    await budgetRange.getByLabel("Minimum budget").fill("300");
    await budgetRange.getByLabel("Maximum budget").fill("900");
    await budgetRange.getByRole("button", { name: "Update range" }).click();
    await expect(plan.getByText("Budget range updated.")).toBeVisible();

    const addItem = plan
      .getByRole("heading", { name: "Add financial item" })
      .locator("xpath=ancestor::section[1]");
    await addItem.locator('select[name="kind"]').selectOption("EXPENSE");
    await addItem
      .locator('input[name="description"]')
      .fill(`${marker} expense`);
    await addItem.locator('select[name="category"]').selectOption("Robot parts");
    await addItem.getByRole("button", { name: "Increase quantity" }).click();
    await addItem.locator('input[name="unitCost"]').fill("75");
    await addItem.getByRole("button", { name: "Add budget line" }).click();
    await expect(
      plan.getByRole("textbox", { name: "Budget item description" }),
    ).toHaveValue(`${marker} expense`);
    await expect(
      plan.getByText("$150.00", { exact: true }).first(),
    ).toBeVisible();

    await page.goto("/admin/operations?tool=engineering");
    await expect(
      page.getByRole("heading", { name: "Engineering release control" }),
    ).toBeVisible();
    const addPart = page
      .getByRole("heading", { name: "Add a master part" })
      .locator("xpath=ancestor::section[1]");
    await addPart.locator('input[name="project"]').fill("E2E");
    await addPart.getByLabel("Part number").fill(partNumber);
    await addPart.getByLabel("Part name").fill(marker);
    await addPart.getByRole("button", { name: "Increase quantity" }).click();
    await addPart.getByRole("button", { name: "Increase quantity" }).click();
    await expect(
      addPart.getByRole("spinbutton", { name: "Quantity" }),
    ).toHaveValue("3");
    await addPart.getByRole("button", { name: "Add part" }).click();
    await expect(
      page.getByRole("heading", { name: new RegExp(marker) }),
    ).toBeVisible();
    await expect(page.getByText("Qty 3", { exact: true })).toBeVisible();
  } finally {
    await cleanupOperationsQa();
  }
});
