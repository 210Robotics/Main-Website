import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const activeEmail = process.env.E2E_CLERK_USER_EMAIL;
const pendingEmail = process.env.E2E_PENDING_USER_EMAIL;

test("active account remains in the portal through navigation and reload", async ({
  page,
}) => {
  test.skip(
    !activeEmail,
    "Temporary active Clerk test user is not configured.",
  );
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: activeEmail! });
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/portal$/);
  await page.reload();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(
    page.getByRole("heading", { name: /welcome back/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Update profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  if (process.env.E2E_EXPECT_ADMIN === "true") {
    await page.getByRole("link", { name: "Open admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Team control center." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Members & roster" }).click();
    await expect(page).toHaveURL(/\/admin\?tab=members$/);
    await expect(page.getByText("Public team and program cards")).toBeVisible();
    const memberDirectory = page
      .getByRole("heading", { name: "Member directory" })
      .locator("xpath=ancestor::section[1]");
    await expect(memberDirectory.locator("tbody button").first()).toBeVisible();
    await page.getByRole("link", { name: "Activity records" }).click();
    await expect(page).toHaveURL(/\/admin\?tab=activity$/);
    const activityLog = page
      .getByRole("heading", { name: "Team activity log" })
      .locator("xpath=ancestor::section[1]");
    await expect(activityLog).toBeVisible();
    await activityLog.getByLabel("Record type").selectOption("hour");
    await expect(
      activityLog.getByText("Hours", { exact: true }).first(),
    ).toBeVisible();
    await activityLog
      .getByRole("button", { name: "View more" })
      .first()
      .click();
    await expect(
      activityLog.getByRole("button", { name: "Hide details" }),
    ).toBeVisible();
    await expect(
      activityLog.getByRole("button", { name: "Save hour changes" }),
    ).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: "Open admin" })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  }
});

test("pending account is sent to account review", async ({ page }) => {
  test.skip(
    !pendingEmail,
    "Temporary pending Clerk test user is not configured.",
  );
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: pendingEmail! });
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/pending$/);
  await expect(
    page.getByRole("heading", { name: /waiting for approval/i }),
  ).toBeVisible();
});
