import { CTA, PageHero, SectionHeading } from "@/components/ui";
import {
  Metrics,
  NumberedList,
  SplitFeature,
} from "@/components/content-blocks";
import { getWebsitePageContent } from "@/lib/site-content";

export default async function About() {
  const content = await getWebsitePageContent("about");
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
          { value: "2026", label: "Founding year" },
          { value: "03", label: "Connected programs" },
          { value: "0", label: "Membership dues" },
          { value: "1", label: "Student-led mission" },
        ]}
      />
      <SplitFeature
        eyebrow={content.missionEyebrow}
        title={content.missionTitle}
        body={content.missionBody}
        image={content.missionImage}
      >
        <NumberedList
          items={[
            {
              title: content.value1Title,
              body: content.value1Body,
            },
            {
              title: content.value2Title,
              body: content.value2Body,
            },
            {
              title: content.value3Title,
              body: content.value3Body,
            },
          ]}
        />
      </SplitFeature>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow={content.programsEyebrow}
            title={content.programsTitle}
          />
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                n: "01",
                t: content.program1Title,
                b: content.program1Body,
              },
              {
                n: "02",
                t: content.program2Title,
                b: content.program2Body,
              },
              {
                n: "03",
                t: content.program3Title,
                b: content.program3Body,
              },
            ].map((x) => (
              <div className="card interactive-card p-7" key={x.t}>
                <span className="font-mono text-xs text-[#fd7803]">{x.n}</span>
                <h3 className="mt-7 text-2xl font-bold">{x.t}</h3>
                <p className="mt-4 text-sm leading-7 text-[#999]">{x.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}
