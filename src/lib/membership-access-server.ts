import "server-only";

import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  discordGuildMembers,
  donations,
  members,
  membershipDues,
  membershipPeriods,
  membershipSettings,
} from "@/db/schema";
import {
  evaluateMembershipAccess,
  type MemberAccessState,
} from "@/lib/membership-policy";
import { currentMembershipPeriod, membershipDuesStatus } from "@/lib/membership-dues";

export async function getMembershipSettings() {
  const [existing] = await getDb()
    .select()
    .from(membershipSettings)
    .where(eq(membershipSettings.id, "membership"))
    .limit(1);
  if (existing) return existing;
  const period = currentMembershipPeriod();
  const [created] = await getDb()
    .insert(membershipSettings)
    .values({ id: "membership", membershipYear: period })
    .onConflictDoNothing({ target: membershipSettings.id })
    .returning();
  if (created) return created;
  const [raced] = await getDb()
    .select()
    .from(membershipSettings)
    .where(eq(membershipSettings.id, "membership"))
    .limit(1);
  if (!raced) throw new Error("Membership settings could not be loaded.");
  return raced;
}

export async function getCurrentAnnualMembershipPeriod() {
  const settings = await getMembershipSettings();
  const [configured] = await getDb()
    .select()
    .from(membershipPeriods)
    .where(
      and(
        eq(membershipPeriods.academicYear, settings.membershipYear),
        eq(membershipPeriods.coverageType, "ANNUAL"),
        eq(membershipPeriods.isActive, true),
      ),
    )
    .orderBy(asc(membershipPeriods.startsAt))
    .limit(1);
  if (configured) return configured;
  const startYear = Number(settings.membershipYear.slice(0, 4));
  const startsAt = new Date(`${startYear}-08-01T00:00:00-05:00`);
  const endsAt = new Date(`${startYear + 1}-07-31T23:59:59-05:00`);
  const graceEndsAt = new Date(
    startsAt.getTime() + settings.gracePeriodDays * 86_400_000,
  );
  const [created] = await getDb()
    .insert(membershipPeriods)
    .values({
      id: `annual-${settings.membershipYear}`,
      label: `${settings.membershipYear} Academic Year`,
      academicYear: settings.membershipYear,
      coverageType: "ANNUAL",
      amountCents: settings.annualDuesCents,
      startsAt,
      endsAt,
      graceEndsAt,
    })
    .onConflictDoNothing({ target: membershipPeriods.id })
    .returning();
  if (created) return created;
  const [raced] = await getDb()
    .select()
    .from(membershipPeriods)
    .where(eq(membershipPeriods.id, `annual-${settings.membershipYear}`))
    .limit(1);
  if (!raced) throw new Error("Annual membership period could not be loaded.");
  return raced;
}

export async function getQualifiedFundraisingTotal(
  memberId: string,
  startsAt: Date,
  endsAt: Date,
) {
  const [row] = await getDb()
    .select({
      total: sql<number>`coalesce(sum(greatest(${donations.amountCents} - ${donations.refundedCents}, 0)), 0)`,
    })
    .from(donations)
    .where(
      and(
        eq(donations.attributedMemberId, memberId),
        sql`${donations.status} in ('PAID', 'PARTIALLY_REFUNDED')`,
        gte(donations.paidAt, startsAt),
        lte(donations.paidAt, endsAt),
      ),
    );
  return Number(row?.total ?? 0);
}

async function ensureAnnualDues(memberId: string) {
  const [settings, period] = await Promise.all([
    getMembershipSettings(),
    getCurrentAnnualMembershipPeriod(),
  ]);
  const [existing] = await getDb()
    .select()
    .from(membershipDues)
    .where(
      and(
        eq(membershipDues.memberId, memberId),
        eq(membershipDues.period, settings.membershipYear),
      ),
    )
    .limit(1);
  if (existing) return { dues: existing, settings, period };
  const [created] = await getDb()
    .insert(membershipDues)
    .values({
      memberId,
      period: settings.membershipYear,
      membershipPeriodId: period.id,
      coverageType: "ANNUAL_DUES",
      amountDueCents: settings.annualDuesCents,
      fundraisingThresholdCents: settings.fundraisingWaiverThresholdCents,
      dueAt: period.graceEndsAt ?? period.startsAt,
    })
    .onConflictDoNothing({
      target: [membershipDues.memberId, membershipDues.period],
    })
    .returning();
  if (created) return { dues: created, settings, period };
  const [raced] = await getDb()
    .select()
    .from(membershipDues)
    .where(
      and(
        eq(membershipDues.memberId, memberId),
        eq(membershipDues.period, settings.membershipYear),
      ),
    )
    .limit(1);
  if (!raced) throw new Error("Membership dues record could not be loaded.");
  return { dues: raced, settings, period };
}

export type MembershipAccessSnapshot = {
  memberId: string;
  accessState: MemberAccessState;
  entitled: boolean;
  reason: string;
  duesStatus: string;
  period: string;
  amountDueCents: number;
  amountPaidCents: number;
  fundraisingRaisedCents: number;
  fundraisingThresholdCents: number;
  discordLinked: boolean;
  universityVerified: boolean;
  profileComplete: boolean;
  usedGracePeriod: boolean;
};

export async function reconcileMemberMembership(
  memberId: string,
): Promise<MembershipAccessSnapshot | null> {
  const [{ dues, settings, period }, memberRows, discordRows] = await Promise.all([
    ensureAnnualDues(memberId),
    getDb().select().from(members).where(eq(members.id, memberId)).limit(1),
    getDb()
      .select({ id: discordGuildMembers.id })
      .from(discordGuildMembers)
      .where(
        and(
          eq(discordGuildMembers.linkedMemberId, memberId),
          isNull(discordGuildMembers.leftAt),
        ),
      )
      .limit(1),
  ]);
  const member = memberRows[0];
  if (!member) return null;
  const fundraisingRaisedCents = await getQualifiedFundraisingTotal(
    memberId,
    period.startsAt,
    period.endsAt,
  );
  const earnedFundraisingWaiver =
    fundraisingRaisedCents >= settings.fundraisingWaiverThresholdCents;
  const adminWaiver = dues.waiverType === "ADMIN";
  const baseStatus = membershipDuesStatus({
    amountDueCents: dues.amountDueCents,
    amountPaidCents: dues.amountPaidCents,
  });
  const duesStatus = adminWaiver
    ? "WAIVED"
    : earnedFundraisingWaiver
      ? "WAIVED_FUNDRAISING"
      : baseStatus;
  const now = new Date();
  await getDb()
    .update(membershipDues)
    .set({
      membershipPeriodId: dues.membershipPeriodId ?? period.id,
      fundraisingRaisedCents,
      fundraisingThresholdCents: settings.fundraisingWaiverThresholdCents,
      status: duesStatus,
      waiverType: adminWaiver
        ? "ADMIN"
        : earnedFundraisingWaiver
          ? "FUNDRAISING"
          : null,
      waiverReason: adminWaiver
        ? dues.waiverReason
        : earnedFundraisingWaiver
          ? `Confirmed member-attributed fundraising reached $${(
              fundraisingRaisedCents / 100
            ).toFixed(2)}.`
          : null,
      waivedAt:
        adminWaiver || earnedFundraisingWaiver ? dues.waivedAt ?? now : null,
      paidBeforeWaiverReview:
        earnedFundraisingWaiver && dues.amountPaidCents > 0,
      updatedAt: now,
    })
    .where(eq(membershipDues.id, dues.id));

  const universityVerified = Boolean(member.universityEmailVerifiedAt);
  const approvedException = Boolean(member.universityEmailOverrideAt);
  const profileComplete = Boolean(
    member.profileCompletedAt &&
      member.firstName.trim() &&
      member.lastName.trim() &&
      member.displayName.trim() &&
      member.academicLevel,
  );
  const decision = evaluateMembershipAccess({
    memberStatus: member.status,
    accessRole: member.accessRole,
    academicLevel: member.academicLevel,
    universityVerified,
    approvedException,
    profileComplete,
    discordLinked: discordRows.length > 0,
    duesStatus,
    gracePeriodEndsAt: member.gracePeriodEndsAt ?? period.graceEndsAt,
    membershipExpiresAt: member.membershipExpiresAt,
    now,
  });
  await getDb()
    .update(members)
    .set({
      accessState: decision.state,
      accessStateReason: decision.reason,
      accessStateUpdatedAt: now,
      membershipExpiresAt:
        decision.entitled && !decision.usedGracePeriod
          ? period.endsAt
          : member.membershipExpiresAt,
      updatedAt: now,
    })
    .where(eq(members.id, memberId));
  return {
    memberId,
    accessState: decision.state,
    entitled: decision.entitled,
    reason: decision.reason,
    duesStatus,
    period: settings.membershipYear,
    amountDueCents: dues.amountDueCents,
    amountPaidCents: dues.amountPaidCents,
    fundraisingRaisedCents,
    fundraisingThresholdCents: settings.fundraisingWaiverThresholdCents,
    discordLinked: discordRows.length > 0,
    universityVerified,
    profileComplete,
    usedGracePeriod: decision.usedGracePeriod,
  };
}

export async function reconcileAllMembershipAccess() {
  const rows = await getDb()
    .select({ id: members.id })
    .from(members)
    .orderBy(asc(members.createdAt));
  const snapshots: MembershipAccessSnapshot[] = [];
  for (const row of rows) {
    try {
      const snapshot = await reconcileMemberMembership(row.id);
      if (snapshot) snapshots.push(snapshot);
    } catch (error) {
      console.error("Membership reconciliation failed for member", {
        memberId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return snapshots;
}
