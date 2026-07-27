import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activityAttendance,
  meetingDecisions,
  meetingNotes,
  members,
  memberTasks,
} from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { buildMeetingDocument } from "@/lib/exports/meeting-document";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await getCurrentMember();
  if (!member)
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  if (
    !hasPermission(
      member.accessRole,
      "meetings.manage",
      member.permissionOverrides,
    )
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const [meeting] = await getDb()
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id))
    .limit(1);
  if (!meeting)
    return Response.json({ error: "Meeting not found." }, { status: 404 });
  const [decisions, tasks, people, attendance] = await Promise.all([
    getDb()
      .select()
      .from(meetingDecisions)
      .where(eq(meetingDecisions.meetingId, id))
      .orderBy(asc(meetingDecisions.createdAt)),
    getDb()
      .select()
      .from(memberTasks)
      .where(eq(memberTasks.meetingId, id))
      .orderBy(memberTasks.dueAt),
    getDb().select({ id: members.id, name: members.displayName }).from(members),
    meeting.activityId
      ? getDb()
          .select({ memberId: activityAttendance.memberId })
          .from(activityAttendance)
          .where(
            and(
              eq(activityAttendance.activityId, meeting.activityId),
              eq(activityAttendance.status, "PRESENT"),
            ),
          )
      : Promise.resolve([]),
  ]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  const buffer = await buildMeetingDocument({
    meeting,
    decisions,
    tasks,
    memberNames: names,
    attendees: attendance.map(
      (row) => names.get(row.memberId) ?? "Team member",
    ),
  });
  const safeTitle =
    meeting.title
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "Meeting";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="210-Robotics-${safeTitle}.docx"`,
      "cache-control": "private, no-store",
    },
  });
}
