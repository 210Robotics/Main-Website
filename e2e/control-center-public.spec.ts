import { expect, test } from "@playwright/test";

test("private control-center and shop routes enforce sign-in", async ({ page }) => {
  for (const route of ["/admin/control-center", "/shop", "/parts/00000000-0000-0000-0000-000000000000"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: /Back to the build/i })).toBeVisible();
  }
  const response = await page.request.get("/api/command-palette");
  expect(response.status()).toBe(401);
});

test("public header stays focused and mobile portal navigation is reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open command palette" })).toHaveCount(0);
  const primary = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(primary).toBeVisible();
  await expect(primary.getByText("Programs", { exact: true })).toBeVisible();
  await expect(primary.getByText("Explore", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Portal" })).toBeVisible();
});

test("public layout has no horizontal overflow from phone to ultrawide", async ({ page }) => {
  test.setTimeout(60_000);
  for (const width of [390, 1024, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    if (width >= 1280) {
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: "Toggle menu" })).toBeVisible();
    }
  }
});
