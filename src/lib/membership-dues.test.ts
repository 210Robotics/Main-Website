import { describe, expect, it } from "vitest";
import {
  currentMembershipPeriod,
  membershipDuesStatus,
} from "@/lib/membership-dues";

describe("membership dues", () => {
  it("uses a July-to-June team period", () => {
    expect(currentMembershipPeriod(new Date(2026, 6, 1))).toBe("2026-2027");
    expect(currentMembershipPeriod(new Date(2027, 5, 30))).toBe("2026-2027");
  });

  it("derives payment status from itemized amounts", () => {
    expect(
      membershipDuesStatus({ amountDueCents: 10_000, amountPaidCents: 0 }),
    ).toBe("DUE");
    expect(
      membershipDuesStatus({
        amountDueCents: 10_000,
        amountPaidCents: 2_500,
      }),
    ).toBe("PARTIAL");
    expect(
      membershipDuesStatus({
        amountDueCents: 10_000,
        amountPaidCents: 10_000,
      }),
    ).toBe("PAID");
    expect(
      membershipDuesStatus({
        amountDueCents: 10_000,
        amountPaidCents: 0,
        waived: true,
      }),
    ).toBe("WAIVED");
  });
});

