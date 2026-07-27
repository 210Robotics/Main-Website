import { describe, expect, it } from "vitest";
import {
  donationProgress,
  parseSuggestedDonationAmounts,
} from "@/lib/donation-math";

describe("donation campaign helpers", () => {
  it("caps public progress at 100 percent", () => {
    expect(donationProgress(12_500, 10_000)).toBe(100);
    expect(donationProgress(5_000, 10_000)).toBe(50);
    expect(donationProgress(-1, 10_000)).toBe(0);
  });

  it("parses, deduplicates, and validates suggested dollar amounts", () => {
    expect(parseSuggestedDonationAmounts("1, 5, 10, 5, 25.50, .50, nope")).toEqual([
      100,
      500,
      1_000,
      2_550,
    ]);
  });
});
