import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const adminEmail =
  process.env.E2E_CLERK_USER_EMAIL ?? process.env.INITIAL_SUPER_ADMIN_EMAIL;

test("admin can synchronize the shared internal-document Drive folder", async ({ page }) => {
  test.skip(!adminEmail, "A Clerk admin test account is not configured.");
  test.setTimeout(240_000);

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: adminEmail! });
  await page.goto("/admin?tab=documents");
  await expect(page.getByRole("heading", { name: "Private document archive" })).toBeVisible();
  await page.getByRole("button", { name: "Sync Drive" }).click();
  await expect(page.getByText(/Drive sync complete: \d+ imported, \d+ already present or unsupported\./)).toBeVisible({ timeout: 220_000 });
  await expect(page.getByText(/documents?$/).first()).not.toContainText("0 documents");
});
