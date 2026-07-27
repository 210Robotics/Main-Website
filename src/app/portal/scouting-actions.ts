"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { auditEvents, scoutingMatches } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import {
  scoutingAwpEligible,
  scoutingMatchTypes,
  scoutingResults,
} from "@/lib/engineering-operations";
import { hasPermission } from "@/lib/permissions";
import { textValue } from "@/lib/operations";

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function count(formData: FormData, key: string, maximum = 10000) {
  const value = Number(textValue(formData, key) || "0");
  if (!Number.isInteger(value) || value < 0 || value > maximum)
    throw new Error(`${key} must be a whole number from 0 to ${maximum}.`);
  return value;
}

function rating(formData: FormData, key: string) {
  return count(formData, key, 5) || 1;
}

function allowed(value: string, options: readonly string[], label: string) {
  if (!options.includes(value)) throw new Error(`Choose a valid ${label}.`);
  return value;
}

function refresh() {
  revalidatePath("/portal");
  revalidatePath("/admin/operations");
}

export async function saveScoutingMatch(formData: FormData) {
  const actor = await requireActiveMember();
  const id = textValue(formData, "id");
  const autoFields = {
    autoPinsScored: count(formData, "autoPinsScored", 100),
    autoGoalsWithTwoPins: count(formData, "autoGoalsWithTwoPins", 9),
    autoRobotsMidfield: count(formData, "autoRobotsMidfield", 2),
    autoContactedPerimeter: checked(formData, "autoContactedPerimeter"),
    autoViolation: checked(formData, "autoViolation"),
  };
  const values = {
    seasonId: textValue(formData, "seasonId") || null,
    eventName: textValue(formData, "eventName", true),
    matchType: allowed(
      textValue(formData, "matchType") || "QUALIFICATION",
      scoutingMatchTypes,
      "match type",
    ),
    matchNumber: textValue(formData, "matchNumber", true),
    observedTeam: textValue(formData, "observedTeam", true).toUpperCase(),
    allianceColor: allowed(
      textValue(formData, "allianceColor") || "RED",
      ["RED", "BLUE"],
      "alliance color",
    ),
    result: allowed(
      textValue(formData, "result") || "UNKNOWN",
      scoutingResults,
      "result",
    ),
    score: count(formData, "score", 10000),
    opponentScore: count(formData, "opponentScore", 10000),
    autonomousScore: count(formData, "autonomousScore", 10000),
    autonomousWon: checked(formData, "autonomousWon"),
    autonomousWinPoint: scoutingAwpEligible(autoFields),
    ...autoFields,
    alliancePinsScored: count(formData, "alliancePinsScored", 200),
    yellowPinsOwned: count(formData, "yellowPinsOwned", 200),
    goalsUsed: count(formData, "goalsUsed", 9),
    maxStackHeight: count(formData, "maxStackHeight", 200),
    cupsUsed: count(formData, "cupsUsed", 200),
    togglesOwned: count(formData, "togglesOwned", 4),
    robotsMidfield: count(formData, "robotsMidfield", 2),
    loaderPins: count(formData, "loaderPins", 200),
    loaderCups: count(formData, "loaderCups", 200),
    successfulCycles: count(formData, "successfulCycles", 500),
    failedCycles: count(formData, "failedCycles", 500),
    averageCycleSeconds: count(formData, "averageCycleSeconds", 120),
    descores: count(formData, "descores", 200),
    penalties: count(formData, "penalties", 10000),
    breakdowns: count(formData, "breakdowns", 100),
    offensiveRating: rating(formData, "offensiveRating"),
    defensiveRating: rating(formData, "defensiveRating"),
    coordinationRating: rating(formData, "coordinationRating"),
    reliabilityRating: rating(formData, "reliabilityRating"),
    largeRobotRole: textValue(formData, "largeRobotRole"),
    smallRobotRole: textValue(formData, "smallRobotRole"),
    scoringPattern: textValue(formData, "scoringPattern"),
    strengths: textValue(formData, "strengths"),
    weaknesses: textValue(formData, "weaknesses"),
    notes: textValue(formData, "notes"),
    updatedAt: new Date(),
  };
  if (id) {
    const [existing] = await getDb()
      .select()
      .from(scoutingMatches)
      .where(eq(scoutingMatches.id, id))
      .limit(1);
    const canManage = hasPermission(
      actor.accessRole,
      "scouting.manage",
      actor.permissionOverrides,
    );
    if (!existing || (existing.submittedByMemberId !== actor.id && !canManage))
      throw new Error("You can only edit your own scouting entries.");
    await getDb()
      .update(scoutingMatches)
      .set(values)
      .where(eq(scoutingMatches.id, id));
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "scouting.match_updated",
      entityType: "scouting_match",
      entityId: id,
      details: { team: values.observedTeam, match: values.matchNumber },
    });
  } else {
    const [row] = await getDb()
      .insert(scoutingMatches)
      .values({ ...values, submittedByMemberId: actor.id })
      .returning();
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "scouting.match_created",
      entityType: "scouting_match",
      entityId: row.id,
      details: { team: values.observedTeam, match: values.matchNumber },
    });
  }
  refresh();
}

export async function deleteScoutingMatch(formData: FormData) {
  const actor = await requireActiveMember();
  const id = textValue(formData, "id", true);
  const [existing] = await getDb()
    .select()
    .from(scoutingMatches)
    .where(eq(scoutingMatches.id, id))
    .limit(1);
  const canManage = hasPermission(
    actor.accessRole,
    "scouting.manage",
    actor.permissionOverrides,
  );
  if (!existing || (existing.submittedByMemberId !== actor.id && !canManage))
    throw new Error("You can only delete your own scouting entries.");
  await getDb().delete(scoutingMatches).where(eq(scoutingMatches.id, id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "scouting.match_deleted",
    entityType: "scouting_match",
    entityId: id,
    details: { team: existing.observedTeam, match: existing.matchNumber },
  });
  refresh();
}
