"use client";

import { useEffect, useState } from "react";
import { donationProgress } from "@/lib/donation-math";
import { centsToMoney } from "@/lib/operations";

type PublicDonationSummary = {
  netRaisedCents: number;
  confirmedCount: number;
  last30DaysCents: number;
};

export function DonationProgress({
  goalCents,
  initialSummary,
}: {
  goalCents: number;
  initialSummary: PublicDonationSummary;
}) {
  const [summary, setSummary] = useState(initialSummary);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/donations/summary", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = (await response.json()) as PublicDonationSummary;
        if (active) setSummary(next);
      } catch {
        // Keep the last confirmed totals during a temporary network interruption.
      }
    };
    const interval = window.setInterval(refresh, 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const progress = donationProgress(summary.netRaisedCents, goalCents);
  return (
    <div className="mt-10 border border-[#333] bg-[#0d0d0d] p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <strong className="block text-3xl text-white sm:text-4xl">
            {centsToMoney(summary.netRaisedCents)}
          </strong>
          <span className="mt-2 block text-sm text-[#999]">
            raised of {centsToMoney(goalCents)} goal
          </span>
        </div>
        <div className="text-right">
          <strong className="text-xl text-[#fd7803]">
            {Math.round(progress)}%
          </strong>
          <span className="mt-1 block text-xs uppercase tracking-wider text-[#777]">
            funded
          </span>
        </div>
      </div>
      <div
        aria-label={`${Math.round(progress)} percent of donation goal reached`}
        className="mt-6 h-3 overflow-hidden bg-[#262626]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full bg-[linear-gradient(90deg,#fd7803,#ffad42)] transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-4 text-sm text-[#999]">
        {summary.confirmedCount === 0
          ? "Be the first supporter of this campaign."
          : `${summary.confirmedCount.toLocaleString()} confirmed ${summary.confirmedCount === 1 ? "donation" : "donations"}`}
      </p>
      <p className="mt-2 text-xs text-[#777]">
        {centsToMoney(summary.last30DaysCents)} received in the last 30 days
      </p>
      <p className="mt-3 text-[.65rem] uppercase tracking-wider text-[#555]">
        Live confirmed Stripe totals · refreshes automatically
      </p>
    </div>
  );
}
