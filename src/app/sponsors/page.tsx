import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { InquiryForm, InquiryModal } from "@/components/inquiry-form";
import { PageHero, SectionHeading } from "@/components/ui";
import { getPublicSponsors } from "@/lib/content";
import { getClub210Supporters } from "@/lib/donations";
import { sponsorTiers } from "@/lib/site-data";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Sponsors" };

export default async function Sponsors() {
  const [sponsors, content, club210Supporters] = await Promise.all([
    getPublicSponsors(),
    getWebsitePageContent("sponsors"),
    getClub210Supporters(),
  ]);
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        body={content.heroBody}
        image={content.heroImage}
      />
      <section className="section">
        <div className="shell">
          <SectionHeading eyebrow={content.partnersEyebrow} title={content.partnersTitle} />
          <div className="grid gap-px bg-[#2b2b2b] sm:grid-cols-3">
            {sponsors.map((sponsor) => (
              <article className="bg-[#0d0d0d] p-8" key={sponsor.id}>
                <div className="relative h-24">
                  <Image
                    src={sponsor.image}
                    alt={sponsor.name}
                    fill
                    sizes="250px"
                    className="object-contain"
                  />
                </div>
                <p className="mt-6 text-center font-mono text-[.65rem] uppercase tracking-wider text-[#888]">
                  {sponsor.sponsorship}
                </p>
                {sponsor.websiteUrl && (
                  <a
                    className="mt-3 block text-center text-xs text-[#fd7803] hover:text-white"
                    href={sponsor.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit {sponsor.name}
                  </a>
                )}
              </article>
            ))}
          </div>
          <div className="mt-10 border border-[#fd7803]/40 bg-[#171008] p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Club 210</p>
                <h2 className="mt-3 text-2xl font-bold text-white">Community supporters</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#aaa]">
                  Confirmed gifts of $210 or more are recognized here when the
                  supporter provides a public recognition name at checkout.
                </p>
              </div>
              <Link className="button shrink-0" href="/donate#donation-checkout">
                Join Club 210
              </Link>
            </div>
            {club210Supporters.length > 0 ? (
              <div className="mt-7 flex flex-wrap gap-3">
                {club210Supporters.map((supporter) => (
                  <span
                    className="border border-[#4a321d] bg-black px-4 py-3 text-sm font-bold text-[#ffd0a4]"
                    key={supporter.donorName}
                  >
                    {supporter.donorName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-7 border-t border-[#4a321d] pt-5 text-sm text-[#888]">
                Be the first supporter recognized in Club 210.
              </p>
            )}
          </div>
        </div>
      </section>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow={content.levelsEyebrow}
            title={content.levelsTitle}
            body={content.levelsBody}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {sponsorTiers.map((tier) => (
              <article className="card p-6" key={tier.name}>
                <p className="font-mono text-xs text-[#fd7803]">{tier.name}</p>
                <strong className="mt-5 block text-2xl">{tier.amount}</strong>
                <p className="mt-4 text-sm leading-6 text-[#888]">{tier.benefits}</p>
              </article>
            ))}
          </div>
          <div className="mt-9">
            <div className="flex flex-wrap gap-3">
              <Link className="button" href="/donate">Donate to 210</Link>
              <Link className="button secondary" href="/sponsor-portal">Sponsor self-service</Link>
              <InquiryModal kind="sponsor" label="Quick sponsor inquiry" className="button secondary" />
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="eyebrow">{content.contactEyebrow}</p>
            <h2 className="headline">{content.contactTitle}</h2>
            <p className="lede mt-6">{content.contactBody}</p>
          </div>
          <InquiryForm kind="sponsor" />
        </div>
      </section>
    </>
  );
}
