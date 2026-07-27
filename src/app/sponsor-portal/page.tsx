import type { Metadata } from "next";
import Link from "next/link";
import { InquiryForm } from "@/components/inquiry-form";

export const metadata: Metadata = {
  title: "Sponsor Self-Service",
  description: "Start or manage a partnership with 210 Robotics.",
};

export default function SponsorPortalPage() {
  return (
    <main className="min-h-screen bg-[#090909] grid-bg">
      <section className="border-b border-[#292929] bg-[radial-gradient(circle_at_85%_15%,rgba(253,120,3,.2),transparent_34%)]">
        <div className="shell py-20 md:py-28">
          <p className="eyebrow">Sponsor self-service</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-[-.05em] md:text-7xl">A direct line to the team.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#aaa]">Start a partnership, update a contact, coordinate a benefit, request an impact update, or plan a renewal. Every request enters the sponsor team&apos;s tracked inbox.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
          <div className="grid content-start gap-4">
            <Info number="01" title="Choose your request" body="Tell us whether this is a new partnership, contact update, deliverable, renewal, visit, or payment question." />
            <Info number="02" title="Get confirmation" body="You receive a confirmation and the sponsor team receives a tracked request with your organization attached." />
            <Info number="03" title="Continue with one owner" body="A team officer follows up and keeps the next action, commitments, and renewal timing organized." />
            <Link className="button secondary mt-2 w-fit" href="/impact">View annual impact</Link>
          </div>
          <InquiryForm kind="sponsor" />
        </div>
      </section>
    </main>
  );
}

function Info({ number, title, body }: { number: string; title: string; body: string }) {
  return <article className="card p-6"><span className="font-mono text-xs text-[#fd7803]">{number}</span><h2 className="mt-3 text-xl font-bold">{title}</h2><p className="mt-3 text-sm leading-6 text-[#888]">{body}</p></article>;
}
