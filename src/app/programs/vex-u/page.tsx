import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import {
  Metrics,
  NumberedList,
  SplitFeature,
} from "@/components/content-blocks";
import { timeline } from "@/lib/site-data";
import { getRosterCards } from "@/lib/public-people";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "VEX U" };
export const dynamic = "force-dynamic";
export default async function VexU() {
  const [people, content] = await Promise.all([
    getRosterCards("VEX_U"),
    getWebsitePageContent("vex-u"),
  ]);
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        body={content.heroBody}
        image={content.heroImage}
      />
      <Metrics
        items={[
          { value: "02", label: "Robots per alliance" },
          { value: "05", label: "Focused development phases" },
          { value: "2027", label: "Competition target" },
          { value: "210", label: "One organization" },
        ]}
      />
      <section className="section">
        <div className="shell grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow">{content.aboutEyebrow}</p>
            <h2 className="headline">{content.aboutTitle}</h2>
            <p className="lede mt-6">{content.aboutBody}</p>
            <p className="mt-5 text-sm leading-7 text-[#999]">{content.aboutDetail}</p>
            <a
              className="button secondary mt-7"
              href="https://www.vexrobotics.com/override-manual"
              target="_blank"
              rel="noreferrer"
            >
              Read the official game manual
            </a>
          </div>
          <div className="video-frame">
            <iframe
              src="https://www.youtube.com/embed/68NxYIAzbkY"
              title="VEX V5 Robotics Competition Override 2026–2027 game reveal"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </section>
      <SplitFeature
        eyebrow={content.workEyebrow}
        title={content.workTitle}
        body={content.workBody}
        image={content.workImage}
      >
        <NumberedList
          items={[
            {
              title: content.work1Title,
              body: content.work1Body,
            },
            {
              title: content.work2Title,
              body: content.work2Body,
            },
            {
              title: content.work3Title,
              body: content.work3Body,
            },
          ]}
        />
      </SplitFeature>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow={content.planEyebrow}
            title={content.planTitle}
          />
          <div className="grid gap-px bg-[#333] md:grid-cols-5">
            {timeline.map((item, index) => (
              <div key={item.month} className="bg-[#101010] p-6">
                <span className="font-mono text-xs text-[#fd7803]">
                  {item.month} / 0{index + 1}
                </span>
                <h3 className="mt-6 text-lg font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#888]">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow={content.teamEyebrow}
            title={content.teamTitle}
            body={content.teamBody}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {people.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                role={member.role === "Member" ? "Member" : member.role}
              />
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}
