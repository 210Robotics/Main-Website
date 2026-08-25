"use client";

import { useCallback, useMemo, useState } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function MembershipDuesCheckout({
  duesId,
  period,
  amountDueCents,
  amountPaidCents,
  status,
  dueAt,
  fundraisingRaisedCents,
  fundraisingThresholdCents,
  payments,
  publishableKey,
}: {
  duesId: string;
  period: string;
  amountDueCents: number;
  amountPaidCents: number;
  status: string;
  dueAt: string | null;
  fundraisingRaisedCents: number;
  fundraisingThresholdCents: number;
  payments: Array<{
    id: string;
    amountCents: number;
    paymentDate: string;
    paymentMethod: string;
    coveragePeriod: string;
    status: string;
    receiptNumber: string | null;
  }>;
  publishableKey: string;
}) {
  const router = useRouter();
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : Promise.resolve(null)),
    [publishableKey],
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const outstandingCents = Math.max(0, amountDueCents - amountPaidCents);
  const settled = ["PAID", "WAIVED", "WAIVED_FUNDRAISING"].includes(status);
  const waiverProgress = fundraisingThresholdCents > 0
    ? Math.min(100, Math.round((fundraisingRaisedCents / fundraisingThresholdCents) * 100))
    : 100;
  const payable = outstandingCents >= 50;
  const handleComplete = useCallback(() => {
    setComplete(true);
    setClientSecret(null);
    router.refresh();
  }, [router]);
  const checkoutOptions = useMemo(
    () => ({ clientSecret, onComplete: handleComplete }),
    [clientSecret, handleComplete],
  );

  async function openCheckout() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/membership-dues/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ duesId }),
      });
      const payload = (await response.json()) as {
        clientSecret?: string;
        message?: string;
      };
      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.message || "The secure payment form could not be opened.");
      }
      setClientSecret(payload.clientSecret);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The secure payment form could not be opened.",
      );
    } finally {
      setPending(false);
    }
  }

  if (complete) {
    return (
      <div className="border border-emerald-800/70 bg-emerald-950/20 p-6 text-center">
        <CheckCircle2 className="mx-auto text-emerald-400" size={46} />
        <h3 className="mt-4 text-xl font-bold">Payment submitted</h3>
        <p className="mt-2 text-sm leading-6 text-emerald-100/70">
          Stripe is confirming the payment. Your dues total and linked Discord
          access update automatically after the signed webhook is received.
        </p>
      </div>
    );
  }

  return (
    <section className="card p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">{period} membership</p>
          <h2 className="mt-3 text-2xl font-bold">Membership dues</h2>
          <p className="mt-2 text-sm leading-6 text-[#999]">
            {dueAt
              ? `Due ${new Date(dueAt).toLocaleDateString("en-US", { dateStyle: "long" })}`
              : "No due date has been set."}
          </p>
        </div>
        <span
          className={
            settled
              ? "tag border-emerald-700 text-emerald-300"
              : "tag border-amber-700 text-amber-300"
          }
        >
          {status}
        </span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Amount due" value={money(amountDueCents)} />
        <Metric label="Received" value={money(amountPaidCents)} />
        <Metric label="Remaining" value={money(outstandingCents)} />
      </div>
      <div className="mt-5 border border-[#333] bg-[#0d0d0d] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><strong className="text-white">Fundraising waiver</strong><p className="mt-1 text-xs text-[#888]">Only finalized, member-attributed donations count.</p></div>
          <span className="text-sm tabular-nums text-[#ddd]">{money(fundraisingRaisedCents)} / {money(fundraisingThresholdCents)}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#262626]" role="progressbar" aria-label="Fundraising waiver progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={waiverProgress}>
          <div className="h-full rounded-full bg-[#fd7803]" style={{ width: `${waiverProgress}%` }} />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#999]">{status === "WAIVED_FUNDRAISING" ? "Yearly dues waived through fundraising." : `${money(Math.max(0, fundraisingThresholdCents - fundraisingRaisedCents))} more to waive yearly dues.`}</p>
      </div>

      {clientSecret ? (
        <div className="mt-6 overflow-hidden bg-white py-2">
          <EmbeddedCheckoutProvider
            key={clientSecret}
            stripe={stripePromise}
            options={checkoutOptions}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : settled ? (
        <div className="mt-6 flex gap-3 border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm leading-6 text-emerald-100/75">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          Your membership dues are settled for this period.
        </div>
      ) : !payable ? (
        <div className="mt-6 border border-amber-900/60 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100/75">
          This dues record does not have a payable balance yet. Contact an
          officer to confirm the amount due.
        </div>
      ) : (
        <div className="mt-6">
          <button
            className="button min-h-12 w-full justify-center sm:w-auto"
            type="button"
            disabled={pending || !publishableKey}
            onClick={openCheckout}
          >
            <CreditCard aria-hidden="true" size={18} />
            {pending ? "Opening secure payment…" : `Pay ${money(outstandingCents)}`}
          </button>
          {!publishableKey && (
            <p className="mt-3 text-sm text-amber-300">
              Card payments are temporarily unavailable. Contact an officer.
            </p>
          )}
          <p className="mt-4 flex max-w-2xl gap-3 text-xs leading-6 text-[#777]">
            <ShieldCheck className="mt-1 shrink-0 text-[#fd7803]" size={16} />
            Stripe securely handles card details. The 210 Robotics website does
            not store card numbers.
          </p>
        </div>
      )}
      {message && (
        <p className="mt-4 border border-red-900/70 bg-red-950/20 p-3 text-sm text-red-200">
          {message}
        </p>
      )}
      <div className="mt-7 border-t border-[#333] pt-6">
        <h3 className="text-lg font-bold">Payment history</h3>
        {payments.length ? (
          <div className="mt-4 grid gap-2">
            {payments.map((payment) => (
              <div className="grid gap-3 border border-[#333] p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" key={payment.id}>
                <div><strong>{money(payment.amountCents)}</strong><p className="mt-1 text-xs text-[#777]">{new Date(payment.paymentDate).toLocaleDateString("en-US", { dateStyle: "medium" })} · {payment.paymentMethod.replaceAll("_", " ")} · {payment.coveragePeriod}</p></div>
                <span className="tag w-fit">{payment.status}</span>
                {payment.status === "PAID" ? <Link className="button secondary min-h-10 justify-center" href={`/api/membership-dues/receipts/${payment.id}`}>Download receipt</Link> : <span />}
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-[#777]">No confirmed dues payments are on file yet.</p>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#333] bg-[#101010] p-4">
      <strong className="text-xl text-white">{value}</strong>
      <p className="mt-1 text-xs uppercase tracking-[.08em] text-[#777]">
        {label}
      </p>
    </div>
  );
}
