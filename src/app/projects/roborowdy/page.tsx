import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import {
  Metrics,
  NumberedList,
  SplitFeature,
} from "@/components/content-blocks";
import { members } from "@/lib/site-data";

export const metadata: Metadata = { title: "RoboRowdy" };
export default function RoboRowdy() {
  const team = members.filter((member) =>
    member.projects.includes("RoboRowdy"),
  );
  return (
    <>
      <PageHero
        eyebrow="Autonomous production"
        title="Meet RoboRowdy."
        body="The global-winning autonomous print-farm assistant designed to remove finished parts, clean and reset build plates, and start the next job with less human intervention."
        image="/media/gallery/siemens/siemens-2.jpg"
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
        eyebrow="Why it matters"
        title="The printer is fast. The handoff is not."
        body="In a print farm, every completed part can wait for an operator to unload it, prepare the surface, and begin again. RoboRowdy explores how autonomy can make the gaps between jobs shorter, safer, and more consistent."
        image="/media/gallery/siemens/siemens-3.jpg"
      >
        <NumberedList
          items={[
            {
              title: "Remove",
              body: "Identify a completed job and safely separate the part from the build surface.",
            },
            {
              title: "Reset",
              body: "Clear debris and prepare the plate for consistent first-layer performance.",
            },
            {
              title: "Restart",
              body: "Coordinate with the production queue so the next approved job can begin.",
            },
          ]}
        />
      </SplitFeature>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow="Development story"
            title="A workflow, not just a robot."
            body="The strongest concept connects physical automation to human supervision, software orchestration, safety, maintenance, and measurable production value."
          />
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                t: "Human-centered",
                b: "Operators stay in control of exceptions, scheduling, maintenance, and quality decisions.",
              },
              {
                t: "Sustainable",
                b: "Better utilization reduces idle energy, failed restarts, and wasted production capacity.",
              },
              {
                t: "Scalable",
                b: "A modular workflow can grow from one printer cell to a connected fleet.",
              },
            ].map((x) => (
              <div className="card interactive-card p-7" key={x.t}>
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
            eyebrow="RoboRowdy team"
            title="The people behind the system."
            body="Project responsibilities are shown here instead of organization-wide officer titles."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
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
