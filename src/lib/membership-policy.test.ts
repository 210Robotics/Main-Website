import { describe, expect, it } from "vitest";
import {
  evaluateMembershipAccess,
  isUtsaStudentEmail,
} from "@/lib/membership-policy";

const complete = {
  memberStatus: "ACTIVE" as const,
  accessRole: "MEMBER",
  academicLevel: "SENIOR",
  universityVerified: true,
  approvedException: false,
  profileComplete: true,
  discordLinked: true,
  duesStatus: "PAID",
  gracePeriodEndsAt: null,
  membershipExpiresAt: null,
  now: new Date("2026-08-25T12:00:00Z"),
};

describe("membership access policy", () => {
  it("accepts only the official verified student domain helper", () => {
    expect(isUtsaStudentEmail("Student@my.utsa.edu")).toBe(true);
    expect(isUtsaStudentEmail("student@utsa.edu")).toBe(false);
    expect(isUtsaStudentEmail("student@my.utsa.edu.example.com")).toBe(false);
  });

  it("activates a fully verified member", () => {
    expect(evaluateMembershipAccess(complete)).toMatchObject({
      state: "ACTIVE_MEMBER",
      entitled: true,
    });
  });

  it("blocks an unverified student email", () => {
    expect(
      evaluateMembershipAccess({ ...complete, universityVerified: false }),
    ).toMatchObject({ state: "UTSA_EMAIL_PENDING", entitled: false });
  });

  it("requires Discord and dues independently", () => {
    expect(
      evaluateMembershipAccess({ ...complete, discordLinked: false }),
    ).toMatchObject({ state: "DISCORD_NOT_LINKED", entitled: false });
    expect(
      evaluateMembershipAccess({ ...complete, duesStatus: "DUE" }),
    ).toMatchObject({ state: "DUES_PENDING", entitled: false });
  });

  it("recognizes fundraising waivers and suspensions", () => {
    expect(
      evaluateMembershipAccess({
        ...complete,
        duesStatus: "WAIVED_FUNDRAISING",
      }),
    ).toMatchObject({ state: "WAIVED_MEMBER", entitled: true });
    expect(
      evaluateMembershipAccess({ ...complete, memberStatus: "SUSPENDED" }),
    ).toMatchObject({ state: "SUSPENDED", entitled: false });
  });

  it("preserves existing access only during the configured grace period", () => {
    expect(
      evaluateMembershipAccess({
        ...complete,
        universityVerified: false,
        gracePeriodEndsAt: new Date("2026-10-01T00:00:00Z"),
      }),
    ).toMatchObject({ entitled: true, usedGracePeriod: true });
  });
});
