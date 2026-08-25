import type { Metadata } from "next";
import { CTA, MemberCard, PageHero, SectionHeading } from "@/components/ui";
import { getPublicPortalMembers, getRosterCards } from "@/lib/public-people";
import { getWebsitePageContent } from "@/lib/site-content";
export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

function rosterKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export default async function Team() {
  const [officerRows, contributorRows, advisorRows, portalMembers, content] = await Promise.all([
    getRosterCards("TEAM", "leadership"),
    getRosterCards("TEAM", "contributors"),
    getRosterCards("TEAM", "advisor"),
    getPublicPortalMembers(),
    getWebsitePageContent("team"),
  ]);
  const officers = officerRows.filter(
    (member, index, rows) =>
      rows.findIndex((candidate) => rosterKey(candidate.name) === rosterKey(member.name)) === index,
  );
  const usedNames = new Set(officers.map((member) => rosterKey(member.name)));
  const contributors = contributorRows.filter((member) => {
    const key = rosterKey(member.name);
    if (usedNames.has(key)) return false;
    usedNames.add(key);
    return true;
  });
  const advisors = advisorRows.filter((member) => {
    const key = rosterKey(member.name);
    if (usedNames.has(key)) return false;
    usedNames.add(key);
    return true;
  });
  const featuredNames = new Set(
    [...officers, ...contributors, ...advisors].map((member) => rosterKey(member.name)),
  );
  const directoryOnly = portalMembers.filter(
    (member) => !featuredNames.has(rosterKey(member.name)),
  );
  const mentors = directoryOnly.filter((member) => member.accessRole === "MENTOR");
  const members = directoryOnly.filter((member) => member.accessRole !== "MENTOR");
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
          <SectionHeading
            eyebrow={content.leadershipEyebrow}
            title={content.leadershipTitle}
            body={content.leadershipBody}
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
            eyebrow={content.contributorsEyebrow}
            title={content.contributorsTitle}
            body={content.contributorsBody}
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
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow={content.advisorsEyebrow}
            title={content.advisorsTitle}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {advisors.map((member) => <MemberCard key={member.id} member={member} />)}
          </div>
        </div>
      </section>
      <nav className="border-t border-[#282828] bg-[#0d0d0d]" aria-label="Team directory sections">
        <div className="shell flex flex-wrap gap-2 py-6">
          <a className="tag transition-colors hover:border-[#fd7803] hover:text-white" href="#members">Members</a>
          <a className="tag transition-colors hover:border-[#fd7803] hover:text-white" href="#mentors">Mentors</a>
        </div>
      </nav>
      <section id="members" className="section scroll-mt-24 bg-[#0d0d0d]">
        <div className="shell">
          <SectionHeading
            eyebrow={content.membersEyebrow}
            title={content.membersTitle}
            body={content.membersBody}
            action={{ label: "View member directory", href: "/members" }}
          />
          {members.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <div className="card flex items-center gap-4 p-5" key={member.id}>
                  <div>
                    <strong>{member.name}</strong>
                    <p className="mt-1 text-sm text-[#fd7803]">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="card p-6 text-sm text-[#999]">Approved public member profiles will appear here.</p>
          )}
        </div>
      </section>
      <section id="mentors" className="section scroll-mt-24 border-t border-[#282828]">
        <div className="shell">
          <SectionHeading
            eyebrow={content.mentorsEyebrow}
            title={content.mentorsTitle}
            body={content.mentorsBody}
          />
          {mentors.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {mentors.map((mentor) => <MemberCard key={mentor.id} member={mentor} />)}
            </div>
          ) : (
            <p className="card p-6 text-sm text-[#999]">Approved public mentor profiles will appear here.</p>
          )}
        </div>
      </section>
      <CTA />
    </>
  );
}
