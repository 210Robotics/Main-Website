import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import {
  Metrics,
  NumberedList,
  SplitFeature,
} from "@/components/content-blocks";
import { members } from "@/lib/site-data";

export const metadata: Metadata = { title: "Siemens Design Challenge Winner" };
export default function Sidc() {
  const contributors = members.filter((member) =>
    member.projects.includes("SIDC"),
  );
  return (
    <>
      <PageHero
        eyebrow="Siemens Immersive Design Challenge · Global Winner"
        title="Design beyond the screen."
        body="210 Robotics won the Siemens Immersive Design Challenge by combining immersive design, digital twins, simulation, automation, and advanced manufacturing into a practical industrial solution."
        image="https://news.utsa.edu/wp-content/uploads/2026/07/robo-rowdy-detroit.jpg"
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
        eyebrow="The winning challenge"
        title="From bottleneck to autonomous flow."
        body="The team studied how additive-manufacturing farms lose valuable production time between prints. The answer became RoboRowdy: an autonomous assistant designed around the full operating workflow."
        image="/media/gallery/siemens/siemens-2.jpg"
      >
        <NumberedList
          items={[
            {
              title: "Discover",
              body: "Map operators, failure points, constraints, and the real production environment.",
            },
            {
              title: "Design",
              body: "Use collaborative CAD, simulation, and immersive review to evaluate concepts sooner.",
            },
            {
              title: "Demonstrate",
              body: "Communicate the technical system, business impact, sustainability value, and path to deployment.",
            },
          ]}
        />
      </SplitFeature>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow="Winning SIDC team"
            title="One system needed many disciplines."
            body="The official eight-student project roster is shown with each person’s RoboRowdy responsibility—not their organization officer title."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {contributors.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                role={member.sidcRole ?? "Project Contributor"}
              />
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}
