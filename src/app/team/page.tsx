import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import { facultyAdvisor, members } from "@/lib/site-data";
export const metadata: Metadata = { title: "Team" };
export default function Team() {
  const officers = members.filter((member) => member.role !== "Member");
  const contributors = members.filter((member) =>
    member.projects.includes("SIDC"),
  );
  return (
    <>
      <PageHero
        eyebrow="The people of 210"
        title="Every machine is a team effort."
        body="Officers set organization-wide direction. Members bring the curiosity and craft that make every system work."
        image="/media/brand/siemens-team.png"
      />
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Organization leadership"
            title="Built and led by students."
            body="These titles apply across all of 210 Robotics—not to a separate branch."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {officers.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      </section>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow="Winning project"
            title="RoboRowdy contributors."
            body="People who also serve as organization officers appear again here with their SIDC project responsibility."
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
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Faculty support"
            title="Guidance that helps the team grow."
          />
          <div className="max-w-sm">
            <MemberCard member={facultyAdvisor} />
          </div>
        </div>
      </section>
      <CTA />
    </>
  );
}
