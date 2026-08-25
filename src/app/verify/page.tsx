import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { VerificationProfileForm } from "@/components/verification-profile-form";
import {
  getCurrentMember,
  synchronizeCurrentMemberIdentity,
} from "@/lib/auth";
import { reconcileMemberMembership } from "@/lib/membership-access-server";
import { refreshUniversityVerification } from "@/app/verify/actions";

export const metadata: Metadata = { title: "Verify Membership" };
export const dynamic = "force-dynamic";

function Check({ complete, children }: { complete: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-[#292929] py-3 last:border-0">
      <span aria-hidden="true" className={complete ? "text-emerald-300" : "text-[#777]"}>
        {complete ? "✓" : "○"}
      </span>
      <span>{children}</span>
    </li>
  );
}

export default async function VerifyMembershipPage() {
  const existing = await getCurrentMember();
  if (!existing) redirect("/sign-in?redirect_url=/verify");
  const member = (await synchronizeCurrentMemberIdentity()) ?? existing;
  const snapshot = await reconcileMemberMembership(member.id);
  if (!snapshot) throw new Error("Membership verification could not be loaded.");
  return (
    <section className="grid-bg min-h-[calc(100dvh-74px)] py-10 sm:py-16">
      <div className="shell grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card overflow-hidden">
          <div className="border-b border-[#34302d] bg-[#15100c] p-6 sm:p-9">
            <p className="eyebrow">Secure member onboarding</p>
            <h1 className="mt-4 text-3xl font-bold tracking-[-.04em] sm:text-5xl">Verify your 210 Robotics membership.</h1>
            <p className="mt-5 max-w-3xl leading-7 text-[#bbb]">
              Team designs, programming, and competition strategy are available after identity, profile, Discord, and membership checks are complete.
            </p>
          </div>
          <div className="p-6 sm:p-9">
            <VerificationProfileForm member={member} />
          </div>
        </div>
        <aside className="grid content-start gap-5">
          <div className="card p-6">
            <p className="eyebrow">Verification progress</p>
            <ol className="mt-4 text-sm leading-6 text-[#ccc]">
              <Check complete={snapshot.universityVerified}>Verified @my.utsa.edu email</Check>
              <Check complete={snapshot.profileComplete}>Member profile complete</Check>
              <Check complete={snapshot.discordLinked}>Discord connected</Check>
              <Check complete={["PAID", "WAIVED", "WAIVED_FUNDRAISING"].includes(snapshot.duesStatus)}>2026–27 dues satisfied</Check>
              <Check complete={snapshot.entitled}>Member access enabled</Check>
            </ol>
            <p className="mt-5 rounded-sm border border-[#343434] bg-[#0b0b0b] p-4 text-sm leading-6 text-[#aaa]">
              {snapshot.reason}
            </p>
          </div>
          {!snapshot.universityVerified && (
            <div className="card p-6">
              <h2 className="text-lg font-bold">Verify your UTSA email</h2>
              <p className="mt-3 text-sm leading-6 text-[#aaa]">Add and verify your @my.utsa.edu address in the account menu, then refresh this check.</p>
              <form action={refreshUniversityVerification}>
                <button className="button secondary mt-5 w-full">Refresh email verification</button>
              </form>
            </div>
          )}
          {!snapshot.discordLinked && (
            <Link className="button justify-center" href="/api/discord/oauth/start">Connect Discord securely</Link>
          )}
          <Link className="button secondary justify-center" href="/portal?tab=dues">View dues and fundraising</Link>
        </aside>
      </div>
    </section>
  );
}
