import { readFile, stat } from "node:fs/promises";
import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const adminEmail =
  process.env.E2E_CLERK_USER_EMAIL ?? process.env.INITIAL_SUPER_ADMIN_EMAIL;

test("admin notebook studio edits live and downloads a Word notebook", async ({
  page,
}) => {
  test.skip(!adminEmail, "A Clerk admin test account is not configured.");
  test.setTimeout(120_000);

  await page.goto("/");
  await clerk.signIn({ page, emailAddress: adminEmail! });
  await page.goto("/admin/operations?tool=notebook");

  await expect(
    page.getByRole("heading", { name: "Notebook Studio" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notebook pages" })).toBeVisible();
  await page.getByRole("link", { name: "+ Add page" }).click();
  await expect(page).toHaveURL(/tool=notebook&entry=new/);
  const createPage = page
    .getByRole("heading", { name: "Create a notebook page" })
    .locator("xpath=ancestor::section[1]");
  await createPage.getByLabel("Page starter").selectOption("test");
  page.once("dialog", (dialog) => dialog.accept());
  await createPage.getByRole("button", { name: "Load starter layout" }).click();
  await expect(createPage.getByRole("button", { name: "New notebook page" })).toHaveCount(0);
  await expect(createPage.getByText(/1 page/).first()).toBeVisible();
  await createPage.getByRole("button", { name: "Preview" }).click();
  await expect(createPage.getByText("Publication preview")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export editable Word (.docx)" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  expect((await stat(downloadedPath!)).size).toBeGreaterThan(10_000);

  await page.goto("/admin?tab=documents");
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private document archive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload DOCX or PDF" })).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload DOCX or PDF" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: download.suggestedFilename(),
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await readFile(downloadedPath!),
  });
  await expect(page.getByText(/Document imported into the secure site archive|Document imported and archived in Google Drive/)).toBeVisible({ timeout: 120_000 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.getByText("Document archived.")).toBeVisible();

  await page.goto("/admin/operations?tool=notebook");
  const driveImport = page
    .getByText("Import a page from a file or Google Drive", { exact: true })
    .locator("xpath=ancestor::details[1]");
  await driveImport.getByText("Import a page from a file or Google Drive", { exact: true }).click();
  const drivePageTitle = `E2E Drive page ${Date.now()}`;
  await driveImport.getByLabel("Page title").fill(drivePageTitle);
  await driveImport.getByLabel("Or import from Google Drive").fill(
    "https://docs.google.com/document/d/1RWPkO15rLcUbOH62E3MIy9eUVm1Ysnesh3nN66bMrLU/edit?usp=drivesdk",
  );
  await driveImport.getByRole("button", { name: "Import as notebook page" }).click();
  await expect(page).toHaveURL(/tool=notebook&entry=[0-9a-f-]+/, { timeout: 120_000 });
  await expect(page.getByRole("button", { name: `Delete ${drivePageTitle}` })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Delete ${drivePageTitle}` }).click();
  await expect(page.getByRole("button", { name: `Delete ${drivePageTitle}` })).toHaveCount(0);

  await page.goto("/admin?tab=docs");
  await expect(page.getByText(/Drag pages between categories/)).toBeVisible();
  await expect(page.locator('[draggable="true"]').first()).toBeVisible();
  const docCategories = page.locator("[data-doc-category-id]");
  if (await docCategories.count() > 1) {
    const sourceCategory = docCategories.first();
    const sourceCategoryId = await sourceCategory.getAttribute("data-doc-category-id");
    const pageToMove = sourceCategory.locator("[data-doc-page-id]").first();
    if (await pageToMove.count()) {
      const pageId = await pageToMove.getAttribute("data-doc-page-id");
      await pageToMove.dragTo(docCategories.nth(1));
      await expect(page.getByText("Documentation order saved.")).toBeVisible();
      await page.locator(`[data-doc-page-id="${pageId}"]`).dragTo(page.locator(`[data-doc-category-id="${sourceCategoryId}"]`));
      await expect(page.getByText("Documentation order saved.")).toBeVisible();
    }
  }
  await expect(page.getByRole("button", { name: /^Remove / }).first()).toBeVisible();

  await page.goto("/admin?tab=media");
  await expect(page.getByRole("heading", { name: "Create a separate gallery for every event" })).toBeVisible();
  await expect(page.getByLabel("Google Drive folder").first()).toBeVisible();
  const galleryTitle = `E2E Gallery ${Date.now()}`;
  await page.getByLabel("Event name").first().fill(galleryTitle);
  await page.getByLabel("Description").first().fill("Temporary gallery verification");
  await page.getByRole("button", { name: "Create event gallery" }).click();
  await expect(page.getByText("Gallery event created.")).toBeVisible();
  await page.getByText(galleryTitle, { exact: true }).click();
  await page.getByText(`Edit ${galleryTitle}`, { exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive event" }).click();
  await expect(page.getByText("Gallery event archived.")).toBeVisible();
});
