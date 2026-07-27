export function donationProgress(raisedCents: number, goalCents: number) {
  if (goalCents <= 0) return 0;
  return Math.min(100, Math.max(0, (raisedCents / goalCents) * 100));
}

export function parseSuggestedDonationAmounts(value: string) {
  const amounts = value
    .split(",")
    .map((item) => Math.round(Number(item.trim()) * 100))
    .filter(
      (amount) => Number.isInteger(amount) && amount >= 100 && amount <= 5_000_000,
    );
  return [...new Set(amounts)].slice(0, 8);
}
