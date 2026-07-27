import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import {
  Metrics,
  NumberedList,
  SplitFeature,
} from "@/components/content-blocks";
import { getRosterCards } from "@/lib/public-people";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Siemens Design Challenge Winner" };
export const dynamic = "force-dynamic";
export default async function Sidc() {
  const [contributors, content] = await Promise.all([
    getRosterCards("SIDC"),
    getWebsitePageContent("sidc"),
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
          { value: "WIN", label: "Global challenge" },
          { value: "XR", label: "Immersive workflow" },
          { value: "01", label: "Connected system" },
          { value: "∞", label: "Room to iterate" },
        ]}
      />
      <SplitFeature
        eyebrow={content.challengeEyebrow}
        title={content.challengeTitle}
        body={content.challengeBody}
        image={content.challengeImage}
      >
        <NumberedList
          items={[
            {
              title: content.step1Title,
              body: content.step1Body,
            },
            {
              title: content.step2Title,
              body: content.step2Body,
            },
            {
              title: content.step3Title,
              body: content.step3Body,
            },
          ]}
        />
      </SplitFeature>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow={content.teamEyebrow}
            title={content.teamTitle}
            body={content.teamBody}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {contributors.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                role={member.role}
              />
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}
