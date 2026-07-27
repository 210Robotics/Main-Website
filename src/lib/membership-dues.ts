export const membershipDuesStatuses = [
  "DUE",
  "PARTIAL",
  "PAID",
  "WAIVED",
] as const;

export type MembershipDuesStatus = (typeof membershipDuesStatuses)[number];

export function currentMembershipPeriod(date = new Date()) {
  const year = date.getFullYear();
  const seasonStart = date.getMonth() >= 6 ? year : year - 1;
  return `${seasonStart}-${seasonStart + 1}`;
}

export function membershipDuesStatus({
  amountDueCents,
  amountPaidCents,
  waived = false,
}: {
  amountDueCents: number;
  amountPaidCents: number;
  waived?: boolean;
}): MembershipDuesStatus {
  if (waived) return "WAIVED";
  if (amountDueCents > 0 && amountPaidCents >= amountDueCents) return "PAID";
  if (amountPaidCents > 0) return "PARTIAL";
  return "DUE";
}

