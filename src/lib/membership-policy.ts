export const academicLevels = [
  "FRESHMAN",
  "SOPHOMORE",
  "JUNIOR",
  "SENIOR",
  "GRADUATE",
  "MASTERS",
  "PHD",
  "MENTOR",
] as const;

export type AcademicLevel = (typeof academicLevels)[number];

export const memberAccessStates = [
  "ACCOUNT_CREATED",
  "UTSA_EMAIL_PENDING",
  "UTSA_VERIFIED",
  "PROFILE_INCOMPLETE",
  "DISCORD_NOT_LINKED",
  "DUES_PENDING",
  "ADMIN_REVIEW",
  "ACTIVE_MEMBER",
  "WAIVED_MEMBER",
  "SUSPENDED",
  "EXPIRED",
  "ALUMNI",
  "MENTOR",
  "GUEST",
] as const;

export type MemberAccessState = (typeof memberAccessStates)[number];

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isUtsaStudentEmail(value: string) {
  return normalizeEmail(value).endsWith("@my.utsa.edu");
}

const leadershipRoles = new Set([
  "SUPER_ADMIN",
  "FULL_ADMIN",
  "OFFICER",
  "DIRECTOR",
  "LEAD",
]);

export function isLeadershipAccessRole(role: string) {
  return leadershipRoles.has(role);
}

export type MembershipPolicyInput = {
  memberStatus: "PENDING" | "ACTIVE" | "SUSPENDED";
  accessRole: string;
  academicLevel: string | null;
  universityVerified: boolean;
  approvedException: boolean;
  profileComplete: boolean;
  discordLinked: boolean;
  duesStatus: string | null;
  gracePeriodEndsAt: Date | null;
  membershipExpiresAt: Date | null;
  now?: Date;
};

export type MembershipPolicyDecision = {
  state: MemberAccessState;
  entitled: boolean;
  reason: string;
  usedGracePeriod: boolean;
};

export function evaluateMembershipAccess(
  input: MembershipPolicyInput,
): MembershipPolicyDecision {
  const now = input.now ?? new Date();
  if (input.memberStatus === "SUSPENDED") {
    return {
      state: "SUSPENDED",
      entitled: false,
      reason: "Membership access is suspended.",
      usedGracePeriod: false,
    };
  }
  if (input.membershipExpiresAt && input.membershipExpiresAt < now) {
    return {
      state: "EXPIRED",
      entitled: false,
      reason: "The recorded membership period has expired.",
      usedGracePeriod: false,
    };
  }
  if (input.accessRole === "MENTOR" || input.academicLevel === "MENTOR") {
    return input.memberStatus === "ACTIVE"
      ? {
          state: "MENTOR",
          entitled: true,
          reason: "Approved mentor access.",
          usedGracePeriod: false,
        }
      : {
          state: "ADMIN_REVIEW",
          entitled: false,
          reason: "Mentor access requires officer approval.",
          usedGracePeriod: false,
        };
  }
  if (isLeadershipAccessRole(input.accessRole) && input.memberStatus === "ACTIVE") {
    return {
      state: "ACTIVE_MEMBER",
      entitled: true,
      reason: "Leadership access is active.",
      usedGracePeriod: false,
    };
  }
  const inGracePeriod = Boolean(
    input.memberStatus === "ACTIVE" &&
      input.gracePeriodEndsAt &&
      input.gracePeriodEndsAt >= now,
  );
  if (!input.universityVerified && !input.approvedException) {
    return inGracePeriod
      ? {
          state: "ADMIN_REVIEW",
          entitled: true,
          reason: "Existing-member grace period: UTSA verification is pending.",
          usedGracePeriod: true,
        }
      : {
          state: "UTSA_EMAIL_PENDING",
          entitled: false,
          reason: "Verify an @my.utsa.edu email or request an approved exception.",
          usedGracePeriod: false,
        };
  }
  if (!input.profileComplete) {
    return inGracePeriod
      ? {
          state: "PROFILE_INCOMPLETE",
          entitled: true,
          reason: "Existing-member grace period: finish the member profile.",
          usedGracePeriod: true,
        }
      : {
          state: "PROFILE_INCOMPLETE",
          entitled: false,
          reason: "Complete the required member profile.",
          usedGracePeriod: false,
        };
  }
  if (!input.discordLinked) {
    return inGracePeriod
      ? {
          state: "DISCORD_NOT_LINKED",
          entitled: true,
          reason: "Existing-member grace period: connect Discord.",
          usedGracePeriod: true,
        }
      : {
          state: "DISCORD_NOT_LINKED",
          entitled: false,
          reason: "Connect the Discord account used in the team server.",
          usedGracePeriod: false,
        };
  }
  if (input.duesStatus === "WAIVED" || input.duesStatus === "WAIVED_FUNDRAISING") {
    return {
      state: "WAIVED_MEMBER",
      entitled: input.memberStatus === "ACTIVE",
      reason: "Membership dues are waived for the current period.",
      usedGracePeriod: false,
    };
  }
  if (input.duesStatus !== "PAID") {
    return inGracePeriod
      ? {
          state: "DUES_PENDING",
          entitled: true,
          reason: "Existing-member grace period: dues are pending.",
          usedGracePeriod: true,
        }
      : {
          state: "DUES_PENDING",
          entitled: false,
          reason: "Membership dues are not satisfied for the current period.",
          usedGracePeriod: false,
        };
  }
  if (input.memberStatus !== "ACTIVE") {
    return {
      state: "ADMIN_REVIEW",
      entitled: false,
      reason: "All automatic checks passed; officer approval is pending.",
      usedGracePeriod: false,
    };
  }
  return {
    state: "ACTIVE_MEMBER",
    entitled: true,
    reason: "Membership verification is complete.",
    usedGracePeriod: false,
  };
}

