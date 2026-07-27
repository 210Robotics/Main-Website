import { describe, expect, it } from "vitest";
import {
  createCustomPageDraft,
  isAvailableCustomPageSlug,
  normalizeCustomPageSlug,
  sortCustomPages,
} from "@/lib/custom-pages";

describe("custom pages", () => {
  it("normalizes labels into safe root slugs", () => {
    expect(normalizeCustomPageSlug("  Alumni & Outreach!  ")).toBe(
      "alumni-outreach",
    );
  });

  it("rejects reserved and duplicate slugs", () => {
    const page = createCustomPageDraft({
      id: "one",
      label: "Alumni",
      slug: "alumni",
      now: "2026-07-17T00:00:00.000Z",
    });
    expect(isAvailableCustomPageSlug("team", [page])).toBe(false);
    expect(isAvailableCustomPageSlug("alumni", [page])).toBe(false);
    expect(isAvailableCustomPageSlug("alumni", [page], "one")).toBe(true);
  });

  it("sorts navigation pages by order and label", () => {
    const first = createCustomPageDraft({
      id: "first",
      label: "Zeta",
      slug: "zeta",
      now: "2026-07-17T00:00:00.000Z",
    });
    const second = { ...first, id: "second", navLabel: "Alpha" };
    expect(sortCustomPages([first, second]).map((page) => page.id)).toEqual([
      "second",
      "first",
    ]);
  });
});
