import { NextResponse } from "next/server";
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  docPages,
  engineeringParts,
  engineeringProjects,
  internalDocuments,
  members,
  operationsHubRecords,
} from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  const actor = await getCurrentMember();
  if (!actor || actor.status !== "ACTIVE")
    return NextResponse.json({ items: [] }, { status: 401 });
  const query =
    new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (!query)
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  const pattern = `%${query}%`;
  const canManageDocuments = hasPermission(
    actor.accessRole,
    "documents.manage",
    actor.permissionOverrides,
  );
  const db = getDb();
  const [people, projects, parts, pages, files, hub] = await Promise.all([
    db
      .select({
        id: members.id,
        title: members.displayName,
        subtitle: members.organizationRole,
      })
      .from(members)
      .where(
        and(
          eq(members.status, "ACTIVE"),
          or(
            ilike(members.displayName, pattern),
            ilike(members.organizationRole, pattern),
          ),
        ),
      )
      .orderBy(asc(members.displayName))
      .limit(12),
    db
      .select({
        id: engineeringProjects.id,
        title: engineeringProjects.name,
        subtitle: engineeringProjects.code,
      })
      .from(engineeringProjects)
      .where(
        or(
          ilike(engineeringProjects.name, pattern),
          ilike(engineeringProjects.code, pattern),
        ),
      )
      .orderBy(asc(engineeringProjects.code))
      .limit(12),
    db
      .select({
        id: engineeringParts.id,
        title: engineeringParts.name,
        subtitle: engineeringParts.partNumber,
      })
      .from(engineeringParts)
      .where(
        and(
          ne(engineeringParts.lifecycleStatus, "OBSOLETE"),
          or(
            ilike(engineeringParts.name, pattern),
            ilike(engineeringParts.partNumber, pattern),
            ilike(engineeringParts.project, pattern),
          ),
        ),
      )
      .orderBy(desc(engineeringParts.updatedAt))
      .limit(12),
    db
      .select({
        id: docPages.id,
        title: docPages.title,
        subtitle: docPages.summary,
        path: docPages.path,
      })
      .from(docPages)
      .where(
        and(
          isNull(docPages.archivedAt),
          eq(docPages.status, "PUBLISHED"),
          inArray(docPages.visibility, ["PUBLIC", "MEMBERS_ONLY"]),
          or(
            ilike(docPages.title, pattern),
            ilike(docPages.summary, pattern),
            ilike(docPages.searchText, pattern),
          ),
        ),
      )
      .orderBy(desc(docPages.updatedAt))
      .limit(12),
    canManageDocuments
      ? db
      .select({
        id: internalDocuments.id,
        title: internalDocuments.title,
        subtitle: internalDocuments.originalFilename,
      })
      .from(internalDocuments)
      .where(
        and(
          isNull(internalDocuments.archivedAt),
          or(
            ilike(internalDocuments.title, pattern),
            ilike(internalDocuments.originalFilename, pattern),
            ilike(internalDocuments.description, pattern),
          ),
        ),
      )
      .orderBy(desc(internalDocuments.updatedAt))
      .limit(12)
      : Promise.resolve([]),
    db
      .select({
        id: operationsHubRecords.id,
        title: operationsHubRecords.title,
        subtitle: operationsHubRecords.kind,
      })
      .from(operationsHubRecords)
      .where(
        and(
          isNull(operationsHubRecords.archivedAt),
          or(
            eq(operationsHubRecords.ownerMemberId, actor.id),
            eq(operationsHubRecords.subjectMemberId, actor.id),
            eq(operationsHubRecords.kind, "TEMPLATE"),
          ),
          or(
            ilike(operationsHubRecords.title, pattern),
            ilike(operationsHubRecords.description, pattern),
            ilike(operationsHubRecords.kind, pattern),
          ),
        ),
      )
      .orderBy(desc(operationsHubRecords.updatedAt))
      .limit(12),
  ]);
  const items = [
    ...projects.map((item) => ({
      ...item,
      type: "Project",
      href: "/admin/operations?tool=structure",
    })),
    ...people.map((item) => ({
      ...item,
      type: "Member",
      href: `/admin/control-center?tab=people&member=${item.id}`,
    })),
    ...parts.map((item) => ({
      ...item,
      type: "Part",
      href: `/parts/${item.id}`,
    })),
    ...pages.map((item) => ({
      ...item,
      type: "Documentation",
      href: `/docs/${item.path}`,
    })),
    ...files.map((item) => ({
      ...item,
      type: "Internal document",
      href: "/admin?tab=documents",
    })),
    ...hub.map((item) => ({
      ...item,
      type: item.subtitle,
      href: `/admin/control-center?tab=${hubTab(item.subtitle)}`,
    })),
  ];
  return NextResponse.json(
    { items: items.slice(0, 40) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

function hubTab(kind: string) {
  if (kind === "RECOGNITION") return "people";
  if (kind === "DECISION_MATRIX" || kind === "ISSUE") return "decisions";
  if (kind === "RACI") return "responsibility";
  if (kind === "TEMPLATE") return "templates";
  if (kind === "SPONSOR_ENGAGEMENT") return "sponsors";
  return "automation";
}
