import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/about",
  "/team",
  "/members",
  "/programs/vex-u",
  "/programs/sidc",
  "/projects/roborowdy",
  "/news",
  "/media",
  "/sponsors",
  "/events",
  "/resources",
  "/contact",
  "/join",
  "/docs",
  "/donate",
];

test("public site routes and navigation remain healthy", async ({ page }) => {
  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should return a successful response`).toBe(true);
    await expect(page.locator("main")).toBeVisible();
  }
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main-content");
  await expect(page.getByRole("link", { name: "RoboRowdy", exact: true })).toBeVisible();
  await page.goto("/team");
  await expect(page.getByRole("link", { name: "Mentors", exact: true })).toHaveAttribute("href", "#mentors");
  await expect(page.getByRole("heading", { name: "Experience behind the build." })).toBeVisible();
  await page.goto("/sponsors");
  await expect(page.getByRole("heading", { name: "Progress is a team sport." })).toBeVisible();
  await expect(page.getByText("Technology and mentorship")).toBeVisible();
});

test("public members never expose private account data", async ({ page }) => {
  await page.goto("/members");
  await expect(page.locator("main")).not.toContainText("@210robotics.com");
  await expect(page.locator("main")).not.toContainText("SUPER_ADMIN");
  await expect(page.getByRole("button", { name: /edit account/i })).toHaveCount(0);
});

test("public pages fit phone and ultrawide viewports", async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [390, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of publicRoutes) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.ok(), `${route} should load at ${width}px`).toBe(true);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `${route} should not overflow horizontally at ${width}px`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test("annual impact and sponsor self-service are production-ready", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const impact = await page.goto("/impact/2026");
  expect(impact?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Engineering impact, made visible." }),
  ).toBeVisible();
  await expect(page.getByText("Documented team hours")).toBeVisible();
  await page.getByRole("link", { name: "Partner with the team" }).click();
  await expect(page).toHaveURL(/\/sponsor-portal$/);
  await expect(
    page.getByRole("heading", { name: "A direct line to the team." }),
  ).toBeVisible();
  await expect(page.getByLabel("How can we help?")).toBeVisible();
  await page.getByLabel("How can we help?").selectOption({
    label: "Plan a renewal",
  });
  await expect(page.getByLabel("How can we help?")).toHaveValue(
    "Plan a renewal",
  );
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("media is organized into expandable event tabs and a compact carousel", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/media");
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Event galleries" })).toBeVisible();
  const eventTabs = page.getByRole("tablist", { name: "Event galleries" }).getByRole("tab");
  await expect(eventTabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(eventTabs.first()).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();
  await expect(page.locator('[aria-roledescription="carousel"]')).toBeVisible();
  await expect(page.locator(".media-grid")).toHaveCount(0);
  const initiallySelectedEvent = await page.getByRole("tabpanel").getAttribute("data-gallery-event");
  expect(initiallySelectedEvent).toBeTruthy();

  if ((await eventTabs.count()) > 1) {
    await eventTabs.nth(1).click();
    await expect(eventTabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(eventTabs.nth(1)).toHaveAttribute("aria-expanded", "true");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tablist", { name: "Event galleries" })).toBeVisible();
  await expect(page.locator('[aria-roledescription="carousel"]')).toBeVisible();
  expect(consoleErrors).toEqual([]);

  await page.goto(`/media?event=${encodeURIComponent(initiallySelectedEvent!)}#event-gallery-panel`);
  await expect(page.getByRole("tabpanel")).toHaveAttribute("data-gallery-event", initiallySelectedEvent!);
});

test("sign-in and registration provide Google and password access", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await expect(emailInput).toBeVisible();
  const inputColors = await emailInput.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { background: style.backgroundColor, foreground: style.color };
  });
  expect(inputColors).toEqual({
    background: "rgb(255, 255, 255)",
    foreground: "rgb(17, 24, 39)",
  });
  await expect(page.getByText("Having trouble signing in?")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "Contact an admin" })).toHaveAttribute("href", "/contact");

  await page.goto("/register");
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
});
