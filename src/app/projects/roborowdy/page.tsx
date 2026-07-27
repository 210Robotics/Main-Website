import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import {
  Metrics,
  NumberedList,
  SplitFeature,
} from "@/components/content-blocks";
import { getRosterCards } from "@/lib/public-people";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "RoboRowdy" };
export const dynamic = "force-dynamic";
export default async function RoboRowdy() {
  const [team, content] = await Promise.all([
    getRosterCards("ROBOROWDY"),
    getWebsitePageContent("roborowdy"),
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
          { value: "24/7", label: "Production vision" },
          { value: "03", label: "Core workflow steps" },
          { value: "↓", label: "Operator downtime" },
          { value: "↑", label: "Farm throughput" },
        ]}
      />
      <SplitFeature
        eyebrow={content.whyEyebrow}
        title={content.whyTitle}
        body={content.whyBody}
        image={content.whyImage}
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
            eyebrow={content.storyEyebrow}
            title={content.storyTitle}
            body={content.storyBody}
          />
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                t: content.story1Title,
                b: content.story1Body,
              },
              {
                t: content.story2Title,
                b: content.story2Body,
              },
              {
                t: content.story3Title,
                b: content.story3Body,
              },
            ].map((x, index) => (
              <div className="card interactive-card p-7" key={`${index}-${x.t}`}>
                <h3 className="text-2xl font-bold">{x.t}</h3>
                <p className="mt-4 text-sm leading-7 text-[#999]">{x.b}</p>
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
            {team.map((member) => (
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
