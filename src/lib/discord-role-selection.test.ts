import { describe, expect, it } from "vitest";
import {
  discordInterestRoleEmoji,
  inferDiscordOnboardingRoleIds,
  isDiscordInterestRole,
} from "@/lib/discord-role-selection";

const roles = [
  { id: "1", name: "@everyone", position: 0, managed: false },
  { id: "2", name: "Agreed", position: 2, managed: false },
  { id: "3", name: "VEX U Member", position: 3, managed: false },
  { id: "4", name: "Integration", position: 4, managed: true },
];

describe("Discord onboarding role selection", () => {
  it("finds the agreed and VEX U member roles by name", () => {
    expect(inferDiscordOnboardingRoleIds(roles)).toEqual({
      agreedRoleId: "2",
      vexUMemberRoleId: "3",
    });
  });

  it("prefers valid configured roles", () => {
    expect(
      inferDiscordOnboardingRoleIds(
        [
          ...roles,
          { id: "5", name: "Rules Accepted", position: 5, managed: false },
          { id: "6", name: "University Team", position: 6, managed: false },
        ],
        { agreedRoleId: "5", vexUMemberRoleId: "6" },
      ),
    ).toEqual({
      agreedRoleId: "5",
      vexUMemberRoleId: "6",
    });
  });

  it("ignores managed configured roles", () => {
    expect(
      inferDiscordOnboardingRoleIds(roles, {
        agreedRoleId: "4",
        vexUMemberRoleId: "4",
      }),
    ).toEqual({
      agreedRoleId: "2",
      vexUMemberRoleId: "3",
    });
  });
});

describe("Discord interest role safety", () => {
  it("allows team interests and chooses a matching emoji", () => {
    const role = {
      id: "20",
      name: "Mechanical",
      position: 2,
      managed: false,
    };
    expect(isDiscordInterestRole(role)).toBe(true);
    expect(discordInterestRoleEmoji(role)).toBe("🔧");
  });

  it("rejects privileged and membership roles", () => {
    for (const name of [
      "Mechanical Lead",
      "Officer",
      "Verified Member",
      "VEX U Member",
      "Admin",
    ]) {
      expect(
        isDiscordInterestRole({ id: name, name, position: 2, managed: false }),
      ).toBe(false);
    }
  });
});
