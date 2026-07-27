import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function stripeIsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  stripeClient ??= new Stripe(secretKey, { typescript: true });
  return stripeClient;
}

export type StripeBalanceSnapshot = {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
  livemode: boolean;
  error?: string;
};

export async function getStripeBalanceSnapshot(): Promise<StripeBalanceSnapshot> {
  if (!stripeIsConfigured()) {
    return { available: [], pending: [], livemode: false, error: "Not configured" };
  }
  try {
    const balance = await getStripe().balance.retrieve();
    return {
      available: balance.available.map(({ amount, currency }) => ({ amount, currency })),
      pending: balance.pending.map(({ amount, currency }) => ({ amount, currency })),
      livemode: balance.livemode,
    };
  } catch {
    return { available: [], pending: [], livemode: false, error: "Unavailable" };
  }
}
