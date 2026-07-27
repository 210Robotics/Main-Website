import { describe, expect, it } from "vitest";
import {
  getWebsitePageDefinition,
  resolveWebsitePageContent,
  websiteContentDefaults,
  websiteContentKey,
  websitePages,
} from "@/lib/site-content-schema";

describe("website content schema", () => {
  it("uses unique page ids, routes, and field keys", () => {
    expect(new Set(websitePages.map((page) => page.id)).size).toBe(websitePages.length);
    expect(new Set(websitePages.map((page) => page.route)).size).toBe(websitePages.length);
    for (const page of websitePages) {
      expect(new Set(page.fields.map((field) => field.key)).size).toBe(page.fields.length);
    }
  });

  it("merges saved values over safe page defaults", () => {
    const page = getWebsitePageDefinition("team");
    const overrides = {
      [websiteContentKey("team", "heroTitle")]: "A changed team title",
    };
    const resolved = resolveWebsitePageContent("team", overrides);
    expect(resolved.heroTitle).toBe("A changed team title");
    expect(resolved.heroImage).toBe(
      page.fields.find((field) => field.key === "heroImage")?.defaultValue,
    );
    expect(websiteContentDefaults()[websiteContentKey("team", "heroTitle")]).toBe(
      "Every machine is a team effort.",
    );
  });
});
