"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { activityAttendance, attendanceTokens, auditEvents, teamActivities } from "@/db/schema";
import { attendanceIsOpen, verifyAttendanceToken } from "@/lib/attendance";
import { requireActiveMember } from "@/lib/auth";

export type CheckInState = {
  status: "idle" | "success" | "error";
  message: string;
  activity?: string;
  checkedInAt?: string;
};

export async function recordSelfAttendance(
  _previous: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const member = await requireActiveMember();
  const token = z.string().min(50).max(300).parse(formData.get("token"));
  const method = z.enum(["QR_CAMERA", "QR_LINK"]).catch("QR_LINK").parse(formData.get("method"));
  const verified = verifyAttendanceToken(token);
  if (!verified) return { status: "error", message: "This attendance code is invalid." };
  const [resolved] = await getDb()
    .select({ token: attendanceTokens, activity: teamActivities })
    .from(attendanceTokens)
    .innerJoin(teamActivities, eq(teamActivities.id, attendanceTokens.activityId))
    .where(and(eq(attendanceTokens.id, verified.id), eq(attendanceTokens.tokenHash, verified.tokenHash), isNull(teamActivities.archivedAt)))
    .limit(1);
  if (!resolved || resolved.activity.status === "CANCELED")
    return { status: "error", message: "This attendance code is no longer available." };
  if (!attendanceIsOpen({
    openedAt: resolved.activity.attendanceOpenedAt,
    closesAt: resolved.activity.attendanceClosesAt,
    tokenExpiresAt: resolved.token.expiresAt,
    tokenRevokedAt: resolved.token.revokedAt,
  })) return { status: "error", message: "Attendance is closed for this activity." };
  const [existing] = await getDb().select().from(activityAttendance)
    .where(and(eq(activityAttendance.activityId, resolved.activity.id), eq(activityAttendance.memberId, member.id)))
    .limit(1);
  if (existing?.status === "PRESENT") return {
    status: "success",
    message: "You were already checked in.",
    activity: resolved.activity.title,
    checkedInAt: existing.checkedInAt.toISOString(),
  };
  const now = new Date();
  await getDb().insert(activityAttendance).values({
    activityId: resolved.activity.id,
    memberId: member.id,
    method,
    recordedByMemberId: member.id,
    checkedInAt: now,
  }).onConflictDoUpdate({
    target: [activityAttendance.activityId, activityAttendance.memberId],
    set: { status: "PRESENT", method, recordedByMemberId: member.id, checkedInAt: now, voidedAt: null, updatedAt: now },
  });
  await getDb().insert(auditEvents).values({ actorMemberId: member.id, action: "attendance.checked_in", entityType: "team_activity", entityId: resolved.activity.id, details: { method } });
  revalidatePath("/portal");
  revalidatePath("/admin");
  return { status: "success", message: "Attendance recorded.", activity: resolved.activity.title, checkedInAt: now.toISOString() };
}

