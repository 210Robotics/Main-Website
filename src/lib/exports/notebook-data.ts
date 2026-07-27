import "server-only";

import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db";
import {
  designChanges,
  engineeringNotebookEntries,
  engineeringParts,
  engineeringProjects,
  engineeringSeasons,
  engineeringSubsystems,
  financeEntries,
  financePlans,
  financeSponsorCommitments,
  hourEntries,
  inventoryItems,
  manufacturingSteps,
  meetingDecisions,
  meetingNotes,
  members,
  memberTasks,
  purchaseRequests,
  scoutingMatches,
} from "@/db/schema";
import type { NotebookPdfInput } from "@/lib/exports/notebook-pdf";

function enabled(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value === "on" || value === "true" || value === "1";
}

export async function loadNotebookExportData(params: URLSearchParams) {
  const [seasonRows, projectRows] = await Promise.all([
    getDb()
      .select()
      .from(engineeringSeasons)
      .orderBy(
        desc(engineeringSeasons.isDefault),
        desc(engineeringSeasons.startsAt),
      ),
    getDb()
      .select()
      .from(engineeringProjects)
      .orderBy(asc(engineeringProjects.code)),
  ]);
  const season =
    seasonRows.find((row) => row.id === params.get("seasonId")) ||
    seasonRows[0];
  if (!season)
    throw new Error(
      "Create an engineering season before compiling the notebook.",
    );
  const requestedProjectId = params.get("projectId");
  const project = requestedProjectId
    ? projectRows.find(
        (row) =>
          row.id === requestedProjectId && row.seasonId === season.id,
      ) || null
    : null;

  const [
    subsystemRows,
    notebookRows,
    partRows,
    stepRows,
    inventoryRows,
    purchaseRows,
    changeRows,
    planRows,
    financeRows,
    sponsorRows,
    meetingRows,
    decisionRows,
    taskRows,
    hourRows,
    scoutingRows,
    memberRows,
  ] = await Promise.all([
    getDb()
      .select()
      .from(engineeringSubsystems)
      .orderBy(asc(engineeringSubsystems.code)),
    getDb()
      .select()
      .from(engineeringNotebookEntries)
      .orderBy(
        asc(engineeringNotebookEntries.sortOrder),
        asc(engineeringNotebookEntries.entryDate),
      ),
    getDb()
      .select()
      .from(engineeringParts)
      .orderBy(asc(engineeringParts.partNumber)),
    getDb()
      .select()
      .from(manufacturingSteps)
      .orderBy(asc(manufacturingSteps.sequence)),
    getDb().select().from(inventoryItems).orderBy(asc(inventoryItems.name)),
    getDb()
      .select()
      .from(purchaseRequests)
      .orderBy(desc(purchaseRequests.createdAt)),
    getDb()
      .select()
      .from(designChanges)
      .orderBy(desc(designChanges.updatedAt)),
    getDb()
      .select()
      .from(financePlans)
      .orderBy(desc(financePlans.fiscalYear), asc(financePlans.name)),
    getDb()
      .select()
      .from(financeEntries)
      .orderBy(desc(financeEntries.occurredAt)),
    getDb()
      .select()
      .from(financeSponsorCommitments)
      .orderBy(asc(financeSponsorCommitments.sponsorName)),
    getDb().select().from(meetingNotes).orderBy(desc(meetingNotes.heldAt)),
    getDb()
      .select()
      .from(meetingDecisions)
      .orderBy(asc(meetingDecisions.createdAt)),
    getDb().select().from(memberTasks).orderBy(desc(memberTasks.createdAt)),
    getDb().select().from(hourEntries).orderBy(desc(hourEntries.workDate)),
    getDb()
      .select()
      .from(scoutingMatches)
      .orderBy(desc(scoutingMatches.createdAt)),
    getDb()
      .select({ id: members.id, name: members.displayName })
      .from(members),
  ]);

  const scopedProjects = project
    ? [project]
    : projectRows.filter((row) => row.seasonId === season.id);
  const projectIds = new Set(scopedProjects.map((row) => row.id));
  const inScope = (seasonId: string | null, projectId: string | null) =>
    (seasonId === null || seasonId === season.id) &&
    (!project || projectId === null || projectId === project.id);
  const scopedEntries = notebookRows.filter(
    (entry) =>
      entry.seasonId === season.id &&
      (!project || entry.projectId === project.id),
  );
  const scopedParts = partRows.filter((row) =>
    inScope(row.seasonId, row.engineeringProjectId),
  );
  const scopedPartIds = new Set(scopedParts.map((row) => row.id));
  const scopedPlans = planRows.filter((row) =>
    inScope(row.seasonId, row.engineeringProjectId),
  );
  const scopedPlanIds = new Set(scopedPlans.map((row) => row.id));
  const fromSeason = (date: Date) =>
    date >= season.startsAt && date <= season.endsAt;
  const options = {
    includeEngineering: enabled(params, "includeEngineering"),
    includeTesting: enabled(params, "includeTesting"),
    includeLogistics: enabled(params, "includeLogistics"),
    includeChanges: enabled(params, "includeChanges"),
    includeFinance: enabled(params, "includeFinance"),
    includeOperations: enabled(params, "includeOperations"),
    includeScouting: enabled(params, "includeScouting"),
  };
  const names = new Map(memberRows.map((row) => [row.id, row.name]));
  const data: NotebookPdfInput = {
    season,
    project,
    projects: scopedProjects,
    subsystems: subsystemRows.filter((row) => projectIds.has(row.projectId)),
    entries: scopedEntries,
    parts: scopedParts,
    steps: stepRows.filter((row) => scopedPartIds.has(row.partId)),
    inventory: inventoryRows.filter((row) =>
      inScope(row.seasonId, row.projectId),
    ),
    purchases: purchaseRows.filter((row) =>
      inScope(row.seasonId, row.projectId),
    ),
    changes: changeRows.filter((row) =>
      inScope(row.seasonId, row.projectId),
    ),
    financePlans: scopedPlans,
    financeEntries: financeRows.filter(
      (row) => row.planId === null || scopedPlanIds.has(row.planId),
    ),
    sponsors: sponsorRows.filter(
      (row) => row.planId === null || scopedPlanIds.has(row.planId),
    ),
    meetings: meetingRows.filter((row) => fromSeason(row.heldAt)),
    decisions: decisionRows,
    tasks: taskRows.filter(
      (row) =>
        !row.archivedAt &&
        (!project ||
          row.engineeringProjectId === null ||
          row.engineeringProjectId === project.id),
    ),
    hours: hourRows.filter(
      (row) => row.deletedAt === null && fromSeason(row.workDate),
    ),
    scouting: scoutingRows.filter(
      (row) => row.seasonId === null || row.seasonId === season.id,
    ),
    names,
    options,
  };
  const scope = project ? project.code : season.name;
  const safeScope =
    scope.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") ||
    "Season";
  return { data, safeScope };
}
