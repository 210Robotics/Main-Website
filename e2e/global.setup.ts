import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });

setup("Clerk testing token", async () => {
  setup.skip(!process.env.CLERK_SECRET_KEY, "Clerk test keys are not configured.");
  await clerkSetup();
});
