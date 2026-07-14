import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { memberProjects, members as memberTable, projects } from "@/db/schema";
import { MemberCard, PageHero, SectionHeading } from "@/components/ui";
import { members as curated, type Member } from "@/lib/site-data";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";
export default async function MembersPage() {
  let directory: Member[] = curated;
  if (hasDatabase()) {
    const rows = await getDb()
      .select({ member: memberTable, projectName: projects.name })
      .from(memberTable)
      .leftJoin(memberProjects, eq(memberProjects.memberId, memberTable.id))
      .leftJoin(projects, eq(projects.id, memberProjects.projectId))
      .where(
        and(eq(memberTable.status, "ACTIVE"), eq(memberTable.isPublic, true)),
      )
      .orderBy(asc(memberTable.displayName));
    if (rows.length) {
      const merged = new Map(
        curated.map((member) => [member.name.toLowerCase(), { ...member }]),
      );
      const grouped = new Map<string, Member>();
      for (const row of rows) {
        if (!grouped.has(row.member.id)) {
          const curatedMatch = merged.get(row.member.displayName.toLowerCase());
          grouped.set(row.member.id, {
            id: curatedMatch?.id ?? row.member.id,
            name: row.member.displayName,
            role: row.member.organizationRole || "Member",
            projects: curatedMatch ? [...curatedMatch.projects] : [],
            image:
              row.member.photoUrl ||
              curatedMatch?.image ||
              "/media/brand/team-banner.jpg",
            bio: row.member.bio || curatedMatch?.bio || "",
            accessRole: row.member.accessRole,
          });
        }
        if (
          row.projectName &&
          ["VEX U", "SIDC", "RoboRowdy"].includes(row.projectName)
        ) {
          const profile = grouped.get(row.member.id)!;
          const projectName = row.projectName as Member["projects"][number];
          if (!profile.projects.includes(projectName))
            profile.projects.push(projectName);
        }
      }
      for (const profile of grouped.values())
        merged.set(profile.name.toLowerCase(), profile);
      directory = [...merged.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }
  }
  return (
    <>
      <PageHero
        eyebrow="Public member directory"
        title="The builders behind 210."
        body="This directory updates automatically from approved, active portal accounts and shows only public organization information."
      />
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Approved profiles"
            title={`${directory.length} active members.`}
            body="Names, organization titles, program groups, biographies, and approved photos are public. Emails, permissions, hours, and contribution records remain private."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {directory.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
