"use server";

import { randomUUID } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  activityAttendance,
  attendanceTokens,
  auditEvents,
  members,
  teamActivities,
} from "@/db/schema";
import { buildAttendanceToken, hashAttendanceToken } from "@/lib/attendance";
import { requirePermission } from "@/lib/auth";

export type ActivityFormState = { status: "idle" | "success" | "error"; message: string };

const activitySchema = z.object({
  activityId: z.union([z.uuid(), z.literal("")]),
  title: z.string().trim().min(3).max(180),
  notes: z.string().trim().max(3000),
  type: z.enum(["EVENT", "WORKSHOP", "MEETING", "OUTREACH", "TRAINING"]),
  topic: z.string().trim().max(120),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function longLivedAttendanceExpiry() {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

function refreshActivityRoutes() {
  revalidatePath("/admin");
  revalidatePath("/portal");
  revalidatePath("/events");
  revalidatePath("/");
}

export async function saveActivity(
  _previous: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const actor = await requirePermission("events.manage");
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: "error", message: issue?.message || "Check the activity details and try again." };
  }
  const data = parsed.data;
  const db = getDb();
  let id = data.activityId;
  let createdActivityId = "";
  let generatedQr = false;
  try {
    if (id) {
      const [existing] = await db
        .select({ id: teamActivities.id })
        .from(teamActivities)
        .where(eq(teamActivities.id, id))
        .limit(1);
      if (!existing) return { status: "error", message: "Activity not found." };
      await db
        .update(teamActivities)
        .set({
          title: data.title,
          description: data.notes,
          type: data.type,
          topic: data.topic || null,
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(teamActivities.id, id));
    } else {
      const now = new Date();
      const baseSlug = slugify(data.title) || "activity";
      const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
      const [created] = await db
        .insert(teamActivities)
        .values({
          title: data.title,
          slug,
          description: data.notes,
          type: data.type,
          topic: data.topic || null,
          location: "",
          startsAt: now,
          endsAt: new Date(now.getTime() + 60 * 60 * 1000),
          isPublic: false,
          status: "SCHEDULED",
          attendanceOpenedAt: now,
          attendanceClosesAt: null,
          createdByMemberId: actor.id,
        })
        .returning({ id: teamActivities.id });
      id = created.id;
      createdActivityId = created.id;
      const tokenId = randomUUID();
      const signed = buildAttendanceToken(tokenId);
      await db.insert(attendanceTokens).values({
        id: tokenId,
        activityId: id,
        tokenHash: hashAttendanceToken(signed.token),
        expiresAt: longLivedAttendanceExpiry(),
        createdByMemberId: actor.id,
      });
      generatedQr = true;
    }
  } catch (error) {
    console.error("Activity save failed", error);
    if (createdActivityId) {
      try {
        await db.delete(teamActivities).where(eq(teamActivities.id, createdActivityId));
      } catch (cleanupError) {
        console.error("Incomplete activity cleanup failed", cleanupError);
      }
    }
    return { status: "error", message: "The activity could not be saved. Refresh and try again." };
  }
  await db.insert(auditEvents).values({
    actorMemberId: actor.id,
    action: data.activityId ? "activity.updated" : "activity.created",
    entityType: "team_activity",
    entityId: id,
    details: { type: data.type, topic: data.topic || null, generatedQr },
  });
  refreshActivityRoutes();
  return {
    status: "success",
    message: data.activityId
      ? "Activity saved."
      : "Activity created. Attendance is open and the QR code is ready.",
  };
}

export async function openAttendance(formData: FormData): Promise<ActivityFormState> {
  try {
    const actor = await requirePermission("events.manage");
    const activityId = z.uuid().parse(formData.get("activityId"));
    const [activity] = await getDb().select({ id: teamActivities.id }).from(teamActivities).where(eq(teamActivities.id, activityId)).limit(1);
    if (!activity) return { status: "error", message: "Activity not found." };
    const now = new Date();
    const expiresAt = longLivedAttendanceExpiry();
    await getDb().update(attendanceTokens).set({ revokedAt: now }).where(and(eq(attendanceTokens.activityId, activityId), isNull(attendanceTokens.revokedAt)));
    const id = randomUUID();
    const signed = buildAttendanceToken(id);
    await getDb().insert(attendanceTokens).values({ id, activityId, tokenHash: hashAttendanceToken(signed.token), expiresAt, createdByMemberId: actor.id });
    await getDb().update(teamActivities).set({ attendanceOpenedAt: now, attendanceClosesAt: null, updatedAt: now }).where(eq(teamActivities.id, activityId));
    await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "attendance.opened", entityType: "team_activity", entityId: activityId, details: { expiresAt: expiresAt.toISOString() } });
    refreshActivityRoutes();
    return { status: "success", message: "Attendance reopened and a new QR code was generated." };
  } catch (error) {
    console.error("Attendance open failed", error);
    return { status: "error", message: "Attendance could not be opened. Refresh and try again." };
  }
}

export async function closeAttendance(formData: FormData): Promise<ActivityFormState> {
  try {
    const actor = await requirePermission("events.manage");
    const activityId = z.uuid().parse(formData.get("activityId"));
    const now = new Date();
    await Promise.all([
      getDb().update(attendanceTokens).set({ revokedAt: now }).where(and(eq(attendanceTokens.activityId, activityId), isNull(attendanceTokens.revokedAt))),
      getDb().update(teamActivities).set({ attendanceClosesAt: now, updatedAt: now }).where(eq(teamActivities.id, activityId)),
    ]);
    await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "attendance.closed", entityType: "team_activity", entityId: activityId });
    refreshActivityRoutes();
    return { status: "success", message: "Attendance closed." };
  } catch (error) {
    console.error("Attendance close failed", error);
    return { status: "error", message: "Attendance could not be closed. Refresh and try again." };
  }
}

export async function setManualAttendance(formData: FormData) {
  const actor = await requirePermission("events.manage");
  const data = z.object({ activityId: z.uuid(), memberId: z.uuid(), note: z.string().trim().max(500).default("") }).parse(Object.fromEntries(formData));
  const [member] = await getDb().select({ status: members.status }).from(members).where(eq(members.id, data.memberId)).limit(1);
  if (!member || member.status !== "ACTIVE") throw new Error("Only active members can be marked present.");
  await getDb().insert(activityAttendance).values({ activityId: data.activityId, memberId: data.memberId, method: "ADMIN", recordedByMemberId: actor.id, note: data.note })
    .onConflictDoUpdate({ target: [activityAttendance.activityId, activityAttendance.memberId], set: { status: "PRESENT", method: "ADMIN", recordedByMemberId: actor.id, note: data.note, voidedAt: null, checkedInAt: new Date(), updatedAt: new Date() } });
  await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "attendance.recorded", entityType: "team_activity", entityId: data.activityId, details: { memberId: data.memberId, method: "ADMIN" } });
  refreshActivityRoutes();
}

export async function voidAttendance(formData: FormData) {
  const actor = await requirePermission("events.manage");
  const id = z.uuid().parse(formData.get("attendanceId"));
  const [row] = await getDb().update(activityAttendance).set({ status: "VOID", voidedAt: new Date(), updatedAt: new Date() }).where(eq(activityAttendance.id, id)).returning({ activityId: activityAttendance.activityId, memberId: activityAttendance.memberId });
  if (row) await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "attendance.voided", entityType: "activity_attendance", entityId: id, details: row });
  refreshActivityRoutes();
}

export async function archiveActivity(formData: FormData) {
  const actor = await requirePermission("events.manage");
  const id = z.uuid().parse(formData.get("activityId"));
  await getDb().update(teamActivities).set({ archivedAt: new Date(), isPublic: false, updatedAt: new Date() }).where(eq(teamActivities.id, id));
  await getDb().insert(auditEvents).values({ actorMemberId: actor.id, action: "activity.archived", entityType: "team_activity", entityId: id });
  refreshActivityRoutes();
}

export async function deleteActivity(formData: FormData): Promise<ActivityFormState> {
  try {
    const actor = await requirePermission("events.manage");
    const id = z.uuid().parse(formData.get("activityId"));
    const db = getDb();
    const [activity] = await db
      .select({
        id: teamActivities.id,
        title: teamActivities.title,
        type: teamActivities.type,
        topic: teamActivities.topic,
        archivedAt: teamActivities.archivedAt,
      })
      .from(teamActivities)
      .where(eq(teamActivities.id, id))
      .limit(1);

    if (!activity) {
      return { status: "error", message: "Activity not found. It may have already been deleted." };
    }

    const [[attendanceSummary], [tokenSummary]] = await Promise.all([
      db
        .select({ total: count() })
        .from(activityAttendance)
        .where(eq(activityAttendance.activityId, id)),
      db.select({ total: count() }).from(attendanceTokens).where(eq(attendanceTokens.activityId, id)),
    ]);

    const [deleted] = await db
      .delete(teamActivities)
      .where(eq(teamActivities.id, id))
      .returning({ id: teamActivities.id });

    if (!deleted) {
      return { status: "error", message: "Activity not found. It may have already been deleted." };
    }

    await db.insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "activity.deleted",
      entityType: "team_activity",
      entityId: id,
      details: {
        title: activity.title,
        type: activity.type,
        topic: activity.topic,
        wasArchived: Boolean(activity.archivedAt),
        attendanceRecordsDeleted: attendanceSummary?.total ?? 0,
        qrTokensDeleted: tokenSummary?.total ?? 0,
      },
    });
    refreshActivityRoutes();
    return { status: "success", message: "Activity permanently deleted." };
  } catch (error) {
    console.error("Activity deletion failed", error);
    return {
      status: "error",
      message: "The activity could not be deleted. Refresh and try again.",
    };
  }
}
