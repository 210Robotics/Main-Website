import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  HeartHandshake,
  Lightbulb,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { DonationForm } from "@/components/donation-form";
import { DonationProgress } from "@/components/donation-progress";
import {
  getDonationCampaign,
  getDonationRecognition,
  getDonationSummary,
} from "@/lib/donations";
import { getPublicPortalMembers } from "@/lib/public-people";
import { centsToMoney } from "@/lib/operations";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support 210 Robotics students, competition robots, travel, tools, and outreach.",
};

export const dynamic = "force-dynamic";

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; amount?: string }>;
}) {
  const [
    { canceled, amount },
    campaign,
    summary,
    recognition,
    memberRows,
    pageContent,
  ] = await Promise.all([
    searchParams,
    getDonationCampaign(),
    getDonationSummary(),
    getDonationRecognition(),
    getPublicPortalMembers(),
    getWebsitePageContent("donate"),
  ]);
  const attributionMembers = memberRows.map((member) => ({
    id: member.id,
    name: member.name,
  }));
  return (
    <div className="min-h-[calc(100vh-74px)] grid-bg">
      <section className="border-y border-[#fd7803]/55 bg-[radial-gradient(circle_at_82%_10%,rgba(253,120,3,.18),transparent_34%),linear-gradient(120deg,#080808,#17120e)] text-white">
        <div className="shell grid items-center gap-6 py-6 lg:grid-cols-[1fr_auto] lg:py-8">
          <div className="flex items-start gap-4 sm:items-center sm:gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center border border-[#fd7803] bg-[#fd7803]/10 text-lg font-black text-[#fd7803] shadow-[0_0_35px_rgba(253,120,3,.14)] sm:h-16 sm:w-16 sm:text-xl">
              210
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[.65rem] font-black uppercase tracking-[.2em] text-[#fd7803]">
                Club 210 · Featured supporter tier
              </p>
              <p className="mt-2 text-xl font-black tracking-tight sm:text-2xl lg:text-3xl">
                Join the people powering our next build.
              </p>
              <p className="mt-2 text-xs font-semibold text-[#aaa] sm:text-sm">
                Team T-shirt · Competition invitations · Website recognition
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 border-l-2 border-[#fd7803] pl-5 lg:items-end lg:border-l-0 lg:pl-0">
            <p className="font-mono text-[.62rem] font-bold uppercase tracking-[.18em] text-[#888]">
              Membership starts at <strong className="text-[#fd7803]">$210</strong>
            </p>
            <Link
              className="button !min-h-12 !px-7 !text-sm"
              href="/donate?amount=210#donation-checkout"
            >
              Join Club 210
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="donation-opening py-8 sm:py-12 lg:py-16">
        <div className="shell grid items-start gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 xl:gap-16">
          <div className="order-2 min-w-0">
            <div className="relative aspect-[16/10] min-h-64 overflow-hidden border border-[#393939] bg-[#111] sm:min-h-80">
              <Image
                src={pageContent.teamImage}
                alt={pageContent.teamImageAlt}
                fill
                priority
                sizes="(max-width: 1023px) calc(100vw - 28px), 46vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,.9))]" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <p className="font-mono text-[.62rem] font-bold uppercase tracking-[.18em] text-[#fd7803]">
                  The people behind the build
                </p>
                <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white sm:text-base">
                  Your support gives students the room, tools, and confidence to
                  turn an ambitious idea into something real.
                </p>
              </div>
            </div>
            <div className="pt-8 sm:pt-10">
            <p className="eyebrow">Fund student-built engineering</p>
            <h1 className="headline mt-4 max-w-4xl">
              {campaign.title} <span className="accent">Together.</span>
            </h1>
            <p className="lede mt-6 max-w-2xl">{campaign.description}</p>
            <blockquote className="mt-7 border-l-2 border-[#fd7803] pl-5 text-base leading-8 text-[#ddd]">
              {pageContent.impactMessage}
            </blockquote>

            <DonationProgress
              goalCents={campaign.goalCents}
              initialSummary={summary}
            />

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                [Wrench, "Parts & prototyping"],
                [Sparkles, "Competition experience"],
                [HeartHandshake, "Student opportunity"],
              ].map(([Icon, label]) => (
                <div className="card flex items-center gap-3 p-4" key={String(label)}>
                  <Icon className="shrink-0 text-[#fd7803]" size={19} />
                  <span className="text-xs font-semibold leading-5 text-[#ccc]">
                    {String(label)}
                  </span>
                </div>
              ))}
            </div>
            </div>
          </div>

          <aside id="donation-checkout" className="order-1 min-w-0 border border-[#fd7803]/55 bg-[#0c0c0c] p-5 shadow-[0_28px_100px_rgba(0,0,0,.38)] sm:p-8 lg:sticky lg:top-24 lg:p-10">
            <div className="mb-7 flex items-center gap-3 border-b border-[#333] pb-6">
              <span className="grid h-11 w-11 place-items-center bg-[#fd7803] text-black">
                <Heart aria-hidden="true" size={21} />
              </span>
              <div>
                <p className="font-mono text-[.62rem] font-bold uppercase tracking-[.16em] text-[#fd7803]">
                  Secure giving
                </p>
                <h2 className="mt-1 text-xl font-bold">Choose your impact</h2>
                <p className="mt-1 text-xs text-[#888]">
                  {amount === "210"
                    ? "Club 210 amount selected"
                    : "Every amount moves the team forward"}
                </p>
              </div>
            </div>
            {canceled && (
              <p className="mb-5 border border-[#664725] bg-[#24190d] p-3 text-sm text-[#ffc47c]">
                Checkout was canceled. No payment was made.
              </p>
            )}
            {campaign.isActive ? (
              <DonationForm
                defaultAmount={amount === "210" ? 210 : 5}
                suggestedAmounts={campaign.suggestedAmountsCents}
                publishableKey={process.env.STRIPE_PUBLISHABLE_KEY ?? ""}
                members={attributionMembers}
              />
            ) : (
              <p className="text-sm leading-7 text-[#aaa]">
                Online donations are temporarily paused. Please check back soon.
              </p>
            )}
            <div className="mt-7 border-t border-[#333] pt-6">
              <p className="flex gap-3 text-xs leading-6 text-[#888]">
                <ShieldCheck className="mt-1 shrink-0 text-[#fd7803]" size={17} />
                Your card details are handled securely by Stripe and are never
                stored on the 210 Robotics website.
              </p>
              <Link className="mt-4 block text-xs text-[#fd7803] hover:text-white" href="/contact">
                Questions about giving? Contact 210 Robotics →
              </Link>
            </div>
          </aside>
        </div>
      </section>
      <section className="section border-t border-[#282828] bg-[#111]">
        <div className="shell">
          <div className="overflow-hidden border border-[#fd7803]/50 bg-[linear-gradient(135deg,#271406_0%,#111_52%,#18120d_100%)] p-7 sm:p-10 lg:p-12">
            <div className="grid items-center gap-10 lg:grid-cols-[.85fr_1.15fr]">
              <div>
                <p className="eyebrow">Club 210</p>
                <h2 className="headline mt-4">Give $210. Join the build.</h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-[#bbb]">
                  Every gift of $210 or more qualifies for Club 210, a community
                  of supporters helping students design, build, and compete.
                </p>
                <Link className="button mt-7 min-h-14 px-7 text-base" href="/donate?amount=210#donation-checkout">
                  Join Club 210
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Team T-shirt", "Choose your size during secure checkout."],
                  ["Competition invitations", "Join us at competitions. Travel and lodging are not provided."],
                  ["Website recognition", "Provide a public recognition name to be listed with our sponsors."],
                ].map(([title, body]) => (
                  <article className="border border-[#4d321c] bg-black/35 p-5" key={title}>
                    <CheckCircle2 className="text-[#fd7803]" size={23} />
                    <h3 className="mt-4 font-bold text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-[#aaa]">{body}</p>
                  </article>
                ))}
              </div>
            </div>
            <p className="mt-8 border-t border-[#4d321c] pt-5 text-xs leading-6 text-[#a99785]">
              Donations above $500 are considered sponsor or benefactor contributions.
              Club 210 benefits are subject to team availability and event access rules.
            </p>
          </div>
        </div>
      </section>
      <section className="section border-t border-[#282828] bg-[#0c0c0c]">
        <div className="shell grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
          <div>
            <p className="eyebrow">Our mission</p>
            <h2 className="headline mt-4">Build capable engineers, not just capable robots.</h2>
            <p className="mt-6 text-sm leading-7 text-[#aaa]">
              210 Robotics gives UT San Antonio students a place to turn ideas
              into real machines. Members learn by designing, manufacturing,
              programming, testing, competing, and sharing engineering with the
              wider community.
            </p>
            <div className="mt-7 flex gap-4 border border-[#3a3028] bg-[#17120e] p-5">
              <Lightbulb className="mt-1 shrink-0 text-[#fd7803]" size={23} />
              <p className="text-sm leading-7 text-[#d1c8be]">
                The robot is visible. The lasting result is a student learning
                to solve a hard problem, trust a teammate, and keep going after
                the first idea fails.
              </p>
            </div>
          </div>
          <div>
            <p className="eyebrow">Why donate</p>
            <div className="mt-5 grid gap-px bg-[#2b2b2b] sm:grid-cols-2">
              {[
                ["Build", "Motors, electronics, raw material, fasteners, prototypes, and replacement parts."],
                ["Compete", "Registration, transportation, lodging, and the field equipment needed to prepare."],
                ["Learn", "Shop tools, safety equipment, software, and hands-on technical training."],
                ["Reach out", "Demonstrations, student events, community programs, and team communication materials."],
              ].map(([title, body]) => (
                <article className="bg-[#101010] p-6" key={title}>
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#888]">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="section border-t border-[#282828] bg-[#111]">
        <div className="shell">
          <div className="max-w-3xl">
            <p className="eyebrow">Giving leaderboard</p>
            <h2 className="headline mt-4">
              The supporters moving 210 forward.
            </h2>
            <p className="mt-5 text-sm leading-7 text-[#999]">
              Public recognition names are grouped across confirmed gifts.
              Member totals show the donations each active member helped bring
              to the team.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="border border-[#fd7803]/55 bg-[linear-gradient(145deg,#241305,#0d0d0d_58%)] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center bg-[#fd7803] text-black">
                  <Trophy aria-hidden="true" size={23} />
                </span>
                <div>
                  <p className="font-mono text-[.62rem] font-bold uppercase tracking-[.18em] text-[#fd7803]">
                    Top supporters
                  </p>
                  <h3 className="mt-1 text-xl font-bold">Donor leaderboard</h3>
                </div>
              </div>
              <LeaderboardRows
                rows={recognition.topDonors.map((donor) => ({
                  name: donor.name,
                  amountCents: donor.amountCents,
                  detail: `${donor.giftCount} confirmed gift${donor.giftCount === 1 ? "" : "s"}`,
                }))}
                empty="No publicly recognized donors yet."
              />
            </article>

            <article className="border border-[#3a3a3a] bg-[#0d0d0d] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center border border-[#fd7803] text-[#fd7803]">
                  <Users aria-hidden="true" size={23} />
                </span>
                <div>
                  <p className="font-mono text-[.62rem] font-bold uppercase tracking-[.18em] text-[#fd7803]">
                    Member impact
                  </p>
                  <h3 className="mt-1 text-xl font-bold">
                    Fundraising leaderboard
                  </h3>
                </div>
              </div>
              <LeaderboardRows
                rows={recognition.memberFundraisers.map((member) => ({
                  name: member.name,
                  amountCents: member.amountCents,
                  detail: `${member.giftCount} attributed gift${member.giftCount === 1 ? "" : "s"}`,
                }))}
                empty="No gifts have been attributed to a member yet."
              />
            </article>
          </div>

          <div className="mt-12 border border-[#333] bg-[#0b0b0b]">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#333] p-6 sm:p-8">
              <div>
                <p className="eyebrow">Thank you</p>
                <h3 className="mt-3 text-2xl font-bold">Recent donors</h3>
              </div>
              <span className="tag">
                {recognition.recentDonors.length} recent gifts
              </span>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3">
              {recognition.recentDonors.map((donor) => (
                <article
                  className="border-b border-[#292929] p-5 sm:border-r sm:p-6"
                  key={donor.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <strong className="block text-white">{donor.name}</strong>
                      <span className="mt-1 block text-xs text-[#777]">
                        {donor.paidAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <strong className="text-[#fd7803]">
                      {centsToMoney(donor.amountCents)}
                    </strong>
                  </div>
                  {donor.attributedMemberName && (
                    <p className="mt-4 border-l-2 border-[#fd7803] pl-3 text-xs text-[#999]">
                      Introduced by {donor.attributedMemberName}
                    </p>
                  )}
                </article>
              ))}
              {!recognition.recentDonors.length && (
                <p className="p-8 text-sm text-[#777]">
                  Confirmed donations will be recognized here.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LeaderboardRows({
  rows,
  empty,
}: {
  rows: Array<{ name: string; amountCents: number; detail: string }>;
  empty: string;
}) {
  if (!rows.length) return <p className="mt-8 text-sm text-[#777]">{empty}</p>;
  return (
    <ol className="mt-7">
      {rows.map((row, index) => (
        <li
          className="flex items-center gap-4 border-t border-[#333] py-4 first:border-t-0"
          key={`${row.name}-${index}`}
        >
          <span
            className={`grid size-9 shrink-0 place-items-center font-mono text-xs font-black ${
              index === 0
                ? "bg-[#fd7803] text-black"
                : "border border-[#3b3b3b] text-[#888]"
            }`}
          >
            {index === 0 ? <Medal aria-hidden="true" size={17} /> : index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <strong className="truncate text-sm text-white">{row.name}</strong>
            <span className="mt-1 block text-xs text-[#777]">{row.detail}</span>
          </div>
          <strong className="text-sm text-[#fd7803]">
            {centsToMoney(row.amountCents)}
          </strong>
        </li>
      ))}
    </ol>
  );
}
