"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ExternalLink, Landmark, LockKeyhole, X } from "lucide-react";
import { useRouter } from "next/navigation";

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

const utsaGivingUrl =
  "https://engage.utsa.edu/site/Donation2;jsessionid=00000000.app30122b?idb=386460020&DONATION_LEVEL_ID_SELECTED=1&df_id=3081&mfc_pref=T&3081.donation=form1&NONCE_TOKEN=030307102E9D32EF4AB467700D1D64E6&idb=0";

export function DonationForm({
  defaultAmount = 5,
  suggestedAmounts,
  publishableKey,
  members,
}: {
  defaultAmount?: number;
  suggestedAmounts: number[];
  publishableKey: string;
  members: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const checkoutRef = useRef<HTMLDivElement>(null);
  const largeGiftPrimaryRef = useRef<HTMLButtonElement>(null);
  const utsaInstructionsRef = useRef<HTMLDivElement>(null);
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : Promise.resolve(null)),
    [publishableKey],
  );
  const [amount, setAmount] = useState(String(defaultAmount));
  const [attributedMemberId, setAttributedMemberId] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [showLargeGiftChoice, setShowLargeGiftChoice] = useState(false);
  const [showUtsaInstructions, setShowUtsaInstructions] = useState(false);
  const suggestions = [
    ...new Set([
      100,
      500,
      21_000,
      50_000,
      100_000,
      ...suggestedAmounts.slice(0, 7),
    ]),
  ]
    .sort((left, right) => left - right);
  const numericAmount = Number(amount);
  const impactCopy =
    numericAmount >= 1_000
      ? "A major gift can underwrite competition travel, a robot subsystem, or critical shop equipment."
      : numericAmount >= 500
        ? "This level can cover a major mechanism, event materials, or a meaningful portion of competition costs."
        : numericAmount >= 210
          ? "Welcome to Club 210—your support helps students move from early prototypes to a competition-ready robot."
          : numericAmount >= 100
            ? "This can fund sensors, stock material, testing supplies, or several rapid prototypes."
            : numericAmount >= 25
              ? "This can put fresh material and hardware directly into a student-built prototype."
              : "Every gift adds momentum and helps students keep building, testing, and learning.";
  const handleComplete = useCallback(() => {
    setComplete(true);
    router.refresh();
  }, [router]);
  const checkoutOptions = useMemo(
    () => ({ clientSecret, onComplete: handleComplete }),
    [clientSecret, handleComplete],
  );

  useEffect(() => {
    if (showLargeGiftChoice) largeGiftPrimaryRef.current?.focus();
  }, [showLargeGiftChoice]);

  async function beginStripeCheckout(numericAmount: number) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/donations/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: numericAmount,
          attributedMemberId: attributedMemberId || null,
        }),
      });
      const payload = (await response.json()) as {
        clientSecret?: string;
        message?: string;
      };
      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.message || "Payment form could not be opened.");
      }
      setClientSecret(payload.clientSecret);
      requestAnimationFrame(() =>
        checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Payment form could not be opened. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function openCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 1) {
      setMessage("Choose an amount of at least $1.");
      return;
    }
    if (numericAmount >= 1_000) {
      setShowLargeGiftChoice(true);
      return;
    }
    await beginStripeCheckout(numericAmount);
  }

  if (complete) {
    return (
      <div className="py-8 text-center">
        <CheckCircle2 className="mx-auto text-[#fd7803]" size={54} />
        <h3 className="mt-5 text-2xl font-bold">Thank you for supporting 210.</h3>
        <p className="mt-3 text-sm leading-7 text-[#999]">
          Your payment was submitted securely. Stripe will email your receipt,
          and the campaign total will update as soon as it is confirmed.
        </p>
        {Number(amount) >= 210 && (
          <p className="mt-4 border border-[#fd7803]/40 bg-[#fd7803]/10 p-4 text-sm leading-6 text-[#ffd0a4]">
            Welcome to Club 210. We&apos;ll use the contact details and T-shirt size
            provided at checkout to coordinate your benefits.
          </p>
        )}
        <button
          className="button secondary mt-6"
          onClick={() => {
            setComplete(false);
            setClientSecret(null);
            setAmount(String(defaultAmount));
          }}
          type="button"
        >
          Make another donation
        </button>
      </div>
    );
  }

  if (clientSecret) {
    return (
      <div ref={checkoutRef}>
        <button
          className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-[#aaa] hover:text-white"
          onClick={() => setClientSecret(null)}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Change amount
        </button>
        <div className="overflow-hidden bg-white py-2">
          <EmbeddedCheckoutProvider
            key={clientSecret}
            stripe={stripePromise}
            options={checkoutOptions}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-6" onSubmit={openCheckout} aria-busy={pending}>
      <fieldset>
        <legend className="mb-3 text-sm font-bold text-white">
          Choose a donation amount
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {suggestions.map((cents) => {
            const value = String(cents / 100);
            return (
              <button
                className={`relative min-h-16 border px-4 text-base font-bold transition ${
                  amount === value
                    ? "border-[#fd7803] bg-[#fd7803] text-black"
                    : cents === 21_000
                      ? "border-[#fd7803] bg-[#261405] text-white hover:bg-[#321a07]"
                      : "border-[#3a3a3a] bg-[#111] text-white hover:border-[#fd7803]"
                }`}
                key={cents}
                onClick={() => {
                  setAmount(value);
                  if (cents >= 100_000) setShowLargeGiftChoice(true);
                }}
                type="button"
              >
                <span className="block">{dollars(cents)}</span>
                {cents === 21_000 && (
                  <span
                    className={`mt-1 block font-mono text-[.58rem] uppercase tracking-[.14em] ${
                      amount === value ? "text-black/70" : "text-[#fd7803]"
                    }`}
                  >
                    Club 210
                  </span>
                )}
                {cents === 100_000 && (
                  <span
                    className={`mt-1 block font-mono text-[.58rem] uppercase tracking-[.14em] ${
                      amount === value ? "text-black/70" : "text-[#fd7803]"
                    }`}
                  >
                    Choose route
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="border-l-2 border-[#fd7803] bg-[#fd7803]/[.07] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
          What your gift can do
        </p>
        <p className="mt-2 text-sm leading-6 text-[#c9c3bc]">{impactCopy}</p>
      </div>
      <label className="grid gap-2">
        <span className="text-sm font-bold text-white">Or enter an amount</span>
        <span className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-[#fd7803]">
            $
          </span>
          <input
            className="input !pl-9 text-lg font-bold"
            inputMode="decimal"
            min="1"
            max="50000"
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            type="number"
            value={amount}
          />
        </span>
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-bold text-white">
          Credit this gift to a 210 member
          <span className="ml-2 font-normal text-[#777]">(optional)</span>
        </span>
        <select
          className="input"
          value={attributedMemberId}
          onChange={(event) => setAttributedMemberId(event.target.value)}
        >
          <option value="">No member attribution</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <span className="text-xs leading-5 text-[#777]">
          Choose the member who introduced you to 210 Robotics. Their
          collective fundraising total will update after payment is confirmed.
        </span>
      </label>
      <div className="border border-[#4a321d] bg-[#1c1209] p-4">
        <p className="flex gap-3 text-xs leading-6 text-[#d5b18c]">
          <Building2 className="mt-1 shrink-0 text-[#fd7803]" size={17} />
          Donations above $500 are treated as sponsor or benefactor
          contributions. The team may follow up about recognition and benefits.
        </p>
      </div>
      <button className="button w-full" disabled={pending || !publishableKey} type="submit">
        {pending
          ? "Loading secure payment…"
          : `Continue with ${Number(amount) >= 1 ? `$${Number(amount).toLocaleString()}` : "donation"}`}
        {!pending && <ArrowRight aria-hidden="true" size={16} />}
      </button>
      <p className="flex items-center justify-center gap-2 text-center text-xs text-[#888]">
        <LockKeyhole aria-hidden="true" size={14} />
        Pay securely without leaving 210robotics.com
      </p>
      <div className="border-t border-[#333] pt-5 text-center">
        <p className="text-sm font-bold text-white">Giving $1,000 or more?</p>
        <p className="mt-2 text-xs leading-6 text-[#888]">
          You can pay here through Stripe or use UTSA&apos;s official giving portal
          for the university tax-deductible giving route.
        </p>
        <button
          className="mt-3 text-xs font-bold text-[#fd7803] underline decoration-[#fd7803]/45 underline-offset-4 hover:text-white"
          onClick={() => {
            if (Number(amount) < 1_000) setAmount("1000");
            setShowLargeGiftChoice(true);
          }}
          type="button"
        >
          Compare large-gift options
        </button>
      </div>
      {showUtsaInstructions && (
        <div
          className="border-2 border-[#fd7803] bg-[#171008] p-5"
          id="utsa-giving-instructions"
          ref={utsaInstructionsRef}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#fd7803] text-black">
              <Landmark aria-hidden="true" size={20} />
            </span>
            <div>
              <p className="font-bold text-white">Official UTSA giving instructions</p>
              <p className="mt-1 text-xs leading-6 text-[#c3aa92]">
                Select <strong className="text-white">KCEID 210 Robotics</strong>
                under Gift Designation so your contribution reaches the team.
              </p>
            </div>
          </div>
          <ol className="mt-4 grid gap-2 border-t border-[#4a321d] pt-4 text-xs leading-5 text-[#aaa]">
            <li><strong className="text-[#fd7803]">1.</strong> Enter your gift amount in the UTSA form.</li>
            <li><strong className="text-[#fd7803]">2.</strong> Under Gift Designation, choose KCEID 210 Robotics.</li>
            <li><strong className="text-[#fd7803]">3.</strong> Complete the donor information and retain UTSA&apos;s acknowledgment.</li>
          </ol>
          <a
            className="button secondary mt-5 w-full"
            href={utsaGivingUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open official UTSA giving
            <ExternalLink aria-hidden="true" size={15} />
          </a>
          <p className="mt-4 text-[.68rem] leading-5 text-[#8f8174]">
            UTSA states that qualifying university contributions are deductible
            for federal income-tax purposes under IRC §170(c)(1). Deductibility
            can depend on donor circumstances and benefits received; consult a
            qualified tax adviser.
          </p>
        </div>
      )}
      <p className="text-center text-sm text-red-400" aria-live="polite">
        {message || (!publishableKey ? "Online payments are being configured." : "")}
      </p>
      {showLargeGiftChoice && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <button
            aria-label="Close large-gift options"
            className="absolute inset-0 cursor-default"
            onClick={() => setShowLargeGiftChoice(false)}
            type="button"
          />
          <section
            aria-labelledby="large-gift-title"
            aria-modal="true"
            className="relative z-10 my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto border border-[#fd7803]/60 bg-[#0b0b0b] p-5 shadow-2xl sm:p-8"
            role="dialog"
          >
            <button
              aria-label="Close"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center border border-[#333] text-[#aaa] hover:border-[#fd7803] hover:text-white"
              onClick={() => setShowLargeGiftChoice(false)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
            <p className="eyebrow">Large-gift options</p>
            <h3 className="mt-3 pr-12 text-2xl font-black text-white" id="large-gift-title">
              How would you like to give ${Number(amount).toLocaleString()}?
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#999]">
              Both paths support 210 Robotics. Choose the payment and documentation
              option that works best for you.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                className="border border-[#fd7803] bg-[#fd7803] p-5 text-left text-black transition hover:bg-[#ff9437] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!publishableKey || pending}
                onClick={() => {
                  setShowLargeGiftChoice(false);
                  void beginStripeCheckout(Number(amount));
                }}
                ref={largeGiftPrimaryRef}
                type="button"
              >
                <strong className="block text-lg">Pay with Stripe</strong>
                <span className="mt-2 block text-xs font-semibold leading-5">
                  Stay on 210robotics.com and complete the secure payment here.
                </span>
              </button>
              <button
                className="border border-[#444] bg-[#151515] p-5 text-left text-white transition hover:border-[#fd7803]"
                onClick={() => {
                  setShowLargeGiftChoice(false);
                  setShowUtsaInstructions(true);
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                      utsaInstructionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    ),
                  );
                }}
                type="button"
              >
                <strong className="block text-lg">UTSA tax-deductible route</strong>
                <span className="mt-2 block text-xs leading-5 text-[#aaa]">
                  Reveal the tax-deductible route and KCEID designation instructions.
                </span>
              </button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
