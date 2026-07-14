import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import {
  Metrics,
  NumberedList,
  SplitFeature,
} from "@/components/content-blocks";
import { members, timeline } from "@/lib/site-data";

export const metadata: Metadata = { title: "VEX U" };
export default function VexU() {
  const people = members.filter(
    (member) => member.role !== "Member" || member.projects.includes("VEX U"),
  );
  return (
    <>
      <PageHero
        eyebrow="Competition engineering"
        title="VEX U, at full speed."
        body="A student-run engineering program where strategy becomes CAD, CAD becomes hardware, and hardware has to perform under pressure."
        image="/media/gallery/vexu/vexu-2.jpg"
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
            <p className="eyebrow">About VEX U</p>
            <h2 className="headline">
              College robotics, engineered under pressure.
            </h2>
            <p className="lede mt-6">
              VEX U is the university division of the VEX Robotics Competition.
              Student teams design, build, program, and drive advanced V5 robots
              through a new game every season, balancing autonomous performance,
              match strategy, reliability, and rapid iteration.
            </p>
            <p className="mt-5 text-sm leading-7 text-[#999]">
              For 2026–27, that game is{" "}
              <strong className="text-white">Override</strong>. Alliances score
              by stacking Pins and Cups on Goals, controlling field Toggles, and
              finishing in the contested Midfield. Each match opens with a
              15-second autonomous period before 1:45 of driver-controlled play.
            </p>
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
        eyebrow="The work"
        title="A full engineering lifecycle."
        body="Members learn to navigate requirements, concept selection, prototype evidence, integration, controls, autonomous behavior, reliability, and driver practice."
        image="/media/gallery/vexu/vexu-5.jpg"
      >
        <NumberedList
          items={[
            {
              title: "Mechanical systems",
              body: "CAD, fabrication, assembly, testing, serviceability, and spares.",
            },
            {
              title: "Controls and autonomy",
              body: "Sensors, electrical architecture, motion control, software, and autonomous routines.",
            },
            {
              title: "Strategy and competition",
              body: "Game analysis, scouting, logistics, documentation, and competition execution.",
            },
          ]}
        />
      </SplitFeature>
      <section className="section border-y border-[#282828] bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow="2026–27 build plan"
            title="A focused path to competition readiness."
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
            eyebrow="Organization team"
            title="Every officer. Every builder."
            body="Officers lead the whole organization, so all organization officers appear here with only their officer title. Other VEX U participants appear as members."
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
