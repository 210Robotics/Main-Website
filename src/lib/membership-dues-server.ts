import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { membershipDues, membershipDuesPayments } from "@/db/schema";
import { membershipDuesStatus } from "@/lib/membership-dues";

export async function recalculateMembershipDues(membershipDuesId: string) {
  const [[dues], payments] = await Promise.all([
    getDb()
      .select()
      .from(membershipDues)
      .where(eq(membershipDues.id, membershipDuesId))
      .limit(1),
    getDb()
      .select()
      .from(membershipDuesPayments)
      .where(eq(membershipDuesPayments.membershipDuesId, membershipDuesId)),
  ]);
  if (!dues) return null;

  const stripePaidCents = payments.reduce(
    (total, payment) =>
      payment.status === "PAID"
        ? total + Math.max(0, payment.amountCents - payment.refundedCents)
        : total,
    0,
  );
  const amountPaidCents = Math.max(
    0,
    dues.manualAmountPaidCents + stripePaidCents,
  );
  const calculatedStatus = membershipDuesStatus({
    amountDueCents: dues.amountDueCents,
    amountPaidCents,
    waived: dues.status === "WAIVED" || dues.waiverType === "ADMIN",
  });
  const status =
    dues.status === "WAIVED_FUNDRAISING" || dues.waiverType === "FUNDRAISING"
      ? "WAIVED_FUNDRAISING"
      : calculatedStatus;
  const now = new Date();
  const [updated] = await getDb()
    .update(membershipDues)
    .set({
      amountPaidCents,
      status,
      paidAt: amountPaidCents >= dues.amountDueCents ? dues.paidAt ?? now : null,
      paymentMethod:
        stripePaidCents > 0
          ? dues.manualAmountPaidCents > 0
            ? "Stripe + manual"
            : "Stripe"
          : dues.paymentMethod,
      updatedAt: now,
    })
    .where(eq(membershipDues.id, membershipDuesId))
    .returning();
  return updated ?? null;
}
