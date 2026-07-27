import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { centsToMoney } from "@/lib/operations";
import { getStripe, stripeIsConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Thank you for supporting 210" };
export const dynamic = "force-dynamic";

export default async function DonationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  let amount: number | null = null;
  let confirmed = false;
  if (
    stripeIsConfigured() &&
    sessionId &&
    /^cs_[A-Za-z0-9_]+$/.test(sessionId) &&
    sessionId.length < 256
  ) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.metadata?.purpose === "donation") {
        confirmed = session.payment_status === "paid";
        amount = session.amount_total;
      }
    } catch {
      // Show a safe receipt-pending state if Stripe is temporarily unavailable.
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-74px)] place-items-center grid-bg px-5 py-16">
      <section className="card w-full max-w-2xl p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto text-[#fd7803]" size={58} />
        <p className="eyebrow mt-7">Thank you</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-.04em] sm:text-5xl">
          You’re powering the next build.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[#aaa]">
          {confirmed
            ? `${amount ? `${centsToMoney(amount)} was` : "Your donation was"} confirmed. Stripe will email your receipt to the address entered at checkout.`
            : "Your payment is being confirmed. Stripe will email your receipt when processing is complete."}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link className="button" href="/">
            Return home
          </Link>
          <Link className="button secondary" href="/news">
            See what we’re building
          </Link>
        </div>
      </section>
    </main>
  );
}
