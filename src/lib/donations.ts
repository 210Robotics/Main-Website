import "server-only";

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  donationCampaignSettings,
  donations,
  financeEntries,
  financePlans,
  members,
} from "@/db/schema";

export const DEFAULT_DONATION_CAMPAIGN: {
  id: string;
  title: string;
  description: string;
  goalCents: number;
  suggestedAmountsCents: number[];
  isActive: boolean;
} = {
  id: "primary",
  title: "Power the next build.",
  description:
    "Help 210 Robotics fund competition travel, robot parts, tools, and student-led engineering.",
  goalCents: 1_000_000,
  suggestedAmountsCents: [100, 500, 1_000, 2_500, 5_000, 10_000, 21_000, 50_000],
  isActive: true,
};

export type DonationCampaign = typeof donationCampaignSettings.$inferSelect;
export type Donation = typeof donations.$inferSelect;

export type DonationSummary = {
  netRaisedCents: number;
  grossRaisedCents: number;
  refundedCents: number;
  confirmedCount: number;
  last30DaysCents: number;
};

export async function getDonationCampaign(): Promise<DonationCampaign> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(donationCampaignSettings)
    .where(eq(donationCampaignSettings.id, DEFAULT_DONATION_CAMPAIGN.id))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(donationCampaignSettings)
    .values(DEFAULT_DONATION_CAMPAIGN)
    .onConflictDoNothing({ target: donationCampaignSettings.id })
    .returning();
  if (created) return created;

  const [raced] = await db
    .select()
    .from(donationCampaignSettings)
    .where(eq(donationCampaignSettings.id, DEFAULT_DONATION_CAMPAIGN.id))
    .limit(1);
  if (!raced) throw new Error("Donation campaign could not be loaded.");
  return raced;
}

export async function getDonationSummary(): Promise<DonationSummary> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await getDb()
    .select({
      grossRaisedCents: sql<number>`coalesce(sum(case when ${donations.status} in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') then ${donations.amountCents} else 0 end), 0)`,
      refundedCents: sql<number>`coalesce(sum(${donations.refundedCents}), 0)`,
      netRaisedCents: sql<number>`coalesce(sum(case when ${donations.status} in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') then greatest(${donations.amountCents} - ${donations.refundedCents}, 0) else 0 end), 0)`,
      confirmedCount: sql<number>`count(*) filter (where ${donations.status} in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'))`,
      last30DaysCents: sql<number>`coalesce(sum(case when ${donations.status} in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') and ${donations.paidAt} >= ${thirtyDaysAgo} then greatest(${donations.amountCents} - ${donations.refundedCents}, 0) else 0 end), 0)`,
    })
    .from(donations)
    .where(eq(donations.campaignId, DEFAULT_DONATION_CAMPAIGN.id));

  return {
    grossRaisedCents: Number(row?.grossRaisedCents ?? 0),
    refundedCents: Number(row?.refundedCents ?? 0),
    netRaisedCents: Number(row?.netRaisedCents ?? 0),
    confirmedCount: Number(row?.confirmedCount ?? 0),
    last30DaysCents: Number(row?.last30DaysCents ?? 0),
  };
}

export async function getRecentDonations(limit = 50) {
  return getDb()
    .select()
    .from(donations)
    .where(
      and(
        eq(donations.campaignId, DEFAULT_DONATION_CAMPAIGN.id),
        sql`${donations.status} in ('PAID', 'PARTIALLY_REFUNDED')`,
      ),
    )
    .orderBy(desc(donations.paidAt), desc(donations.createdAt))
    .limit(limit);
}

export type DonationRecognition = {
  topDonors: Array<{
    name: string;
    amountCents: number;
    giftCount: number;
  }>;
  memberFundraisers: Array<{
    memberId: string;
    name: string;
    amountCents: number;
    giftCount: number;
  }>;
  recentDonors: Array<{
    id: string;
    name: string;
    amountCents: number;
    paidAt: Date;
    attributedMemberName: string | null;
  }>;
};

export async function getDonationRecognition(
  recentLimit = 36,
): Promise<DonationRecognition> {
  const rows = await getDb()
    .select({
      id: donations.id,
      donorName: donations.donorName,
      donorEmail: donations.donorEmail,
      amountCents: donations.amountCents,
      refundedCents: donations.refundedCents,
      paidAt: donations.paidAt,
      createdAt: donations.createdAt,
      attributedMemberId: donations.attributedMemberId,
      attributedMemberName: members.displayName,
    })
    .from(donations)
    .leftJoin(members, eq(members.id, donations.attributedMemberId))
    .where(
      and(
        eq(donations.campaignId, DEFAULT_DONATION_CAMPAIGN.id),
        sql`${donations.status} in ('PAID', 'PARTIALLY_REFUNDED')`,
        sql`greatest(${donations.amountCents} - ${donations.refundedCents}, 0) > 0`,
      ),
    )
    .orderBy(desc(donations.paidAt), desc(donations.createdAt))
    .limit(5000);

  const donors = new Map<
    string,
    { name: string; amountCents: number; giftCount: number }
  >();
  const memberTotals = new Map<
    string,
    { memberId: string; name: string; amountCents: number; giftCount: number }
  >();
  for (const row of rows) {
    const net = Math.max(0, row.amountCents - row.refundedCents);
    const publicName = row.donorName?.trim();
    if (publicName) {
      const key =
        row.donorEmail?.trim().toLowerCase() ||
        publicName.toLocaleLowerCase();
      const existing = donors.get(key);
      donors.set(key, {
        name: existing?.name || publicName,
        amountCents: (existing?.amountCents || 0) + net,
        giftCount: (existing?.giftCount || 0) + 1,
      });
    }
    if (row.attributedMemberId && row.attributedMemberName) {
      const existing = memberTotals.get(row.attributedMemberId);
      memberTotals.set(row.attributedMemberId, {
        memberId: row.attributedMemberId,
        name: row.attributedMemberName,
        amountCents: (existing?.amountCents || 0) + net,
        giftCount: (existing?.giftCount || 0) + 1,
      });
    }
  }

  return {
    topDonors: [...donors.values()]
      .sort((left, right) => right.amountCents - left.amountCents)
      .slice(0, 10),
    memberFundraisers: [...memberTotals.values()]
      .sort((left, right) => right.amountCents - left.amountCents)
      .slice(0, 15),
    recentDonors: rows.slice(0, recentLimit).map((row) => ({
      id: row.id,
      name: row.donorName?.trim() || "Anonymous supporter",
      amountCents: Math.max(0, row.amountCents - row.refundedCents),
      paidAt: row.paidAt || row.createdAt,
      attributedMemberName: row.attributedMemberName,
    })),
  };
}

export async function getClub210Supporters() {
  const rows = await getDb()
    .select({
      donorName: donations.donorName,
      paidAt: donations.paidAt,
    })
    .from(donations)
    .where(
      and(
        eq(donations.campaignId, DEFAULT_DONATION_CAMPAIGN.id),
        isNotNull(donations.donorName),
        sql`${donations.status} in ('PAID', 'PARTIALLY_REFUNDED')`,
        sql`greatest(${donations.amountCents} - ${donations.refundedCents}, 0) >= 21000`,
      ),
    )
    .orderBy(desc(donations.paidAt));

  const seen = new Set<string>();
  return rows.filter((row): row is { donorName: string; paidAt: Date | null } => {
    if (!row.donorName) return false;
    const key = row.donorName.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function donationLedgerPlan() {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(financePlans)
    .orderBy(
      sql`case when ${financePlans.status} = 'ACTIVE' then 0 else 1 end`,
      desc(financePlans.fiscalYear),
      desc(financePlans.updatedAt),
    )
    .limit(1);
  if (existing) return existing;

  const year = new Date().getFullYear();
  const [created] = await db
    .insert(financePlans)
    .values({
      name: `Donations & Giving ${year}`,
      fiscalYear: year,
      project: "Organization",
      status: "ACTIVE",
      notes:
        "Automatically maintained from confirmed Stripe donations. Refunds and disputes are reconciled automatically.",
    })
    .returning();
  return created;
}

/**
 * Mirrors one Stripe donation into the regular finance ledger. The Stripe
 * checkout session is used as a stable source key so webhook retries and the
 * periodic reconciliation job remain idempotent.
 */
export async function syncDonationIncomeEntry(donation: Donation) {
  const db = getDb();
  const plan = await donationLedgerPlan();
  const sourceKey = `stripe-donation:${donation.stripeCheckoutSessionId}`;
  const eligible = [
    "PAID",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ].includes(donation.status);
  const amountCents = eligible
    ? Math.max(0, donation.amountCents - donation.refundedCents)
    : 0;
  const values = {
    planId: plan.id,
    kind: "INCOME",
    category: "Donations & Giving",
    description: donation.donorName
      ? `Stripe donation from ${donation.donorName}`
      : "Anonymous Stripe donation",
    vendor: "Stripe",
    quantity: 1,
    unitCostCents: amountCents,
    amountCents,
    status: amountCents > 0 ? "PAID" : "CANCELED",
    occurredAt: donation.paidAt ?? donation.createdAt,
    receiptUrl: sourceKey,
    notes: [
      `Automatically synchronized from Stripe checkout ${donation.stripeCheckoutSessionId}.`,
      donation.donorEmail ? `Donor email: ${donation.donorEmail}` : "",
      donation.refundedCents
        ? `Refunded: $${(donation.refundedCents / 100).toFixed(2)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    updatedAt: new Date(),
  };
  const [existing] = await db
    .select({ id: financeEntries.id })
    .from(financeEntries)
    .where(eq(financeEntries.receiptUrl, sourceKey))
    .limit(1);
  if (existing) {
    await db
      .update(financeEntries)
      .set(values)
      .where(eq(financeEntries.id, existing.id));
    return { created: false, entryId: existing.id };
  }
  const [created] = await db
    .insert(financeEntries)
    .values(values)
    .returning({ id: financeEntries.id });
  return { created: true, entryId: created.id };
}

export async function syncAllDonationIncomeEntries() {
  const rows = await getDb()
    .select()
    .from(donations)
    .where(
      sql`${donations.status} in ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED')`,
    )
    .orderBy(desc(donations.createdAt));
  for (const donation of rows) await syncDonationIncomeEntry(donation);
  return rows.length;
}
