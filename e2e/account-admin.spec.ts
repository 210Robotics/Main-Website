import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_CLERK_USER_EMAIL;
const targetName = process.env.E2E_ACCESS_TARGET_NAME;

test("access overrides persist and delete requires confirmation", async ({ page }) => {
  test.skip(!adminEmail || !targetName, "Admin access mutation test is not configured.");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: adminEmail! });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Sponsor manager" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add sponsor" })).toBeVisible();
  const suspendedRow = page.getByRole("row").filter({ hasText: "SUSPENDED" }).first();
  if (await suspendedRow.count())
    await expect(suspendedRow.getByRole("button", { name: "Restore account" })).toBeVisible();

  async function openEditor() {
    const row = page.getByRole("row").filter({ hasText: targetName! });
    await row.getByRole("button", { name: "Edit account" }).click();
    return page.getByRole("dialog").filter({ hasText: targetName! });
  }

  let changed = false;
  try {
    let editor = await openEditor();
    const permission = editor.getByLabel("Manage sponsors override");
    await permission.selectOption("deny");
    await editor.getByRole("button", { name: "Save access" }).click();
    await expect(editor.getByText("Access settings saved.")).toBeVisible();
    changed = true;
    await editor.getByRole("button", { name: "Close" }).click();

    await page.reload();
    editor = await openEditor();
    await expect(editor.getByLabel("Manage sponsors override")).toHaveValue("deny");
    await editor.getByRole("button", { name: "Close" }).click();

    const row = page.getByRole("row").filter({ hasText: targetName! });
    await row.getByRole("button", { name: "Delete account" }).click();
    const deleteDialog = page.getByRole("dialog").filter({ hasText: `Delete ${targetName}` });
    await expect(deleteDialog.getByText("Permanent action")).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Cancel" }).click();
  } finally {
    if (changed) {
      await page.reload();
      const editor = await openEditor();
      await editor.getByLabel("Manage sponsors override").selectOption("allow");
      await editor.getByRole("button", { name: "Save access" }).click();
      await expect(editor.getByText("Access settings saved.")).toBeVisible();
    }
  }
});
