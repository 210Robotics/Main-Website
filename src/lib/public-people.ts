import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  mediaAssets,
  memberProjects,
  members as memberTable,
  projects,
  publicProfileCards,
} from "@/db/schema";
import {
  facultyAdvisor,
  members as curatedMembers,
  type Member,
} from "@/lib/site-data";

export type RosterPage = "TEAM" | "VEX_U" | "SIDC" | "ROBOROWDY";

function staticRoster(page: RosterPage, section?: string): Member[] {
  if (page === "TEAM") {
    if (section === "leadership")
      return curatedMembers.filter((member) => member.role !== "Member");
    if (section === "contributors")
      return curatedMembers
        .filter((member) => member.projects.includes("SIDC"))
        .map((member) => ({
          ...member,
          role: member.sidcRole ?? "Project Contributor",
        }));
    if (section === "advisor") return [facultyAdvisor];
    return [];
  }
  if (page === "VEX_U")
    return curatedMembers.filter(
      (member) =>
        member.role !== "Member" || member.projects.includes("VEX U"),
    );
  const project = page === "SIDC" ? "SIDC" : "RoboRowdy";
  return curatedMembers
    .filter((member) => member.projects.includes(project))
    .map((member) => ({
      ...member,
      role: member.sidcRole ?? "Project Contributor",
    }));
}

export async function getRosterCards(
  page: RosterPage,
  section = "people",
): Promise<Member[]> {
  if (!hasDatabase()) return staticRoster(page, section);
  const rows = await getDb()
    .select({ card: publicProfileCards, blobUrl: mediaAssets.blobUrl })
    .from(publicProfileCards)
    .leftJoin(mediaAssets, eq(mediaAssets.id, publicProfileCards.photoMediaId))
    .where(
      and(
        eq(publicProfileCards.page, page),
        eq(publicProfileCards.section, section),
        eq(publicProfileCards.published, true),
        isNull(publicProfileCards.archivedAt),
      ),
    )
    .orderBy(asc(publicProfileCards.sortOrder), asc(publicProfileCards.name));
  return rows.map(({ card, blobUrl }) => ({
    id: card.id,
    name: card.name,
    role: card.title,
    projects: [],
    image: blobUrl ?? card.photoUrl ?? undefined,
    bio: card.bio,
    accessRole: "MEMBER",
  }));
}

export async function getPublicPortalMembers(): Promise<Member[]> {
  if (!hasDatabase()) return [];
  const rows = await getDb()
    .select({
      member: memberTable,
      projectName: projects.name,
      blobUrl: mediaAssets.blobUrl,
    })
    .from(memberTable)
    .leftJoin(memberProjects, eq(memberProjects.memberId, memberTable.id))
    .leftJoin(projects, eq(projects.id, memberProjects.projectId))
    .leftJoin(mediaAssets, eq(mediaAssets.id, memberTable.photoMediaId))
    .where(
      and(eq(memberTable.status, "ACTIVE"), eq(memberTable.isPublic, true)),
    )
    .orderBy(asc(memberTable.displayName));
  const grouped = new Map<string, Member & { identityKey: string; quality: number }>();
  for (const row of rows) {
    const localEmail = row.member.email.split("@", 1)[0]?.toLowerCase() || "";
    const isSystemProfile =
      row.member.accessRole === "SUPER_ADMIN" &&
      ["admin", "administrator", "system", "test"].includes(localEmail);
    if (isSystemProfile || ["SUSPENDED", "EXPIRED"].includes(row.member.accessState)) continue;
    const identityKey =
      row.member.normalizedUniversityEmail ||
      row.member.clerkUserId ||
      row.member.displayName.trim().toLowerCase().replace(/\s+/g, " ");
    const quality =
      Number(Boolean(row.member.profileCompletedAt)) * 4 +
      Number(Boolean(row.blobUrl || row.member.photoUrl)) * 2 +
      Number(Boolean(row.member.bio));
    if (!grouped.has(row.member.id)) {
      grouped.set(row.member.id, {
        id: row.member.id,
        name: row.member.displayName,
        role: titleCase(row.member.organizationRole || "Member"),
        projects: [],
        image: row.blobUrl ?? row.member.photoUrl ?? undefined,
        bio: row.member.bio,
        accessRole: row.member.accessRole,
        identityKey,
        quality,
      });
    }
    if (
      row.projectName &&
      ["VEX U", "SIDC", "RoboRowdy"].includes(row.projectName)
    ) {
      const member = grouped.get(row.member.id)!;
      const project = row.projectName as Member["projects"][number];
      if (!member.projects.includes(project)) member.projects.push(project);
    }
  }
  const canonical = new Map<string, Member & { identityKey: string; quality: number }>();
  for (const candidate of grouped.values()) {
    const existing = canonical.get(candidate.identityKey);
    if (!existing || candidate.quality > existing.quality) {
      canonical.set(candidate.identityKey, candidate);
    }
  }
  return [...canonical.values()].map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    role: candidate.role,
    projects: candidate.projects,
    image: candidate.image,
    bio: candidate.bio,
    accessRole: candidate.accessRole,
  }));
}

function titleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\b(Cad|Cam|Cae|Vex|Utsa)\b/g, (word) => word.toUpperCase());
}
