import type { Metadata } from "next";
import { MemberCard, PageHero, SectionHeading } from "@/components/ui";
import { getPublicPortalMembers } from "@/lib/public-people";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [directory, content] = await Promise.all([
    getPublicPortalMembers(),
    getWebsitePageContent("members"),
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
          <SectionHeading
            eyebrow={content.directoryEyebrow}
            title={`${directory.length} active members.`}
            body={content.directoryBody}
          />
          {directory.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {directory.map((member) => <MemberCard key={member.id} member={member} />)}
            </div>
          ) : (
            <p className="card p-7 text-sm text-[#999]">Approved public profiles will appear here.</p>
          )}
        </div>
      </section>
    </>
  );
}
