"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { auditEvents, memberTasks, taskComments } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { memberTaskStatuses, textValue } from "@/lib/operations";

async function authorizedTask(taskId: string) {
  const member = await requireActiveMember();
  const [task] = await getDb()
    .select()
    .from(memberTasks)
    .where(and(eq(memberTasks.id, taskId), isNull(memberTasks.archivedAt)))
    .limit(1);
  const manages = hasPermission(
    member.accessRole,
    "tasks.manage",
    member.permissionOverrides,
  );
  if (!task || (task.assignedToMemberId !== member.id && !manages))
    throw new Error("You cannot update this task.");
  return { member, task };
}

export async function updateMyTaskStatus(formData: FormData) {
  const taskId = textValue(formData, "taskId", true);
  const status = textValue(formData, "status", true);
  if (!(memberTaskStatuses as readonly string[]).includes(status))
    throw new Error("Invalid task status.");
  const { member, task } = await authorizedTask(taskId);
  if (task.status === "DONE")
    throw new Error("An approved task cannot be reopened by its assignee.");
  const requestingReview = status === "IN_REVIEW";
  await getDb()
    .update(memberTasks)
    .set({
      status,
      completedAt: null,
      completionRequestedAt: requestingReview ? new Date() : null,
      completionRequestedByMemberId: requestingReview ? member.id : null,
      approvedAt: null,
      approvedByMemberId: null,
      approvalNote: "",
      updatedAt: new Date(),
    })
    .where(eq(memberTasks.id, taskId));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: requestingReview
        ? "task.completion_requested"
        : "task.status_updated",
      entityType: "member_task",
      entityId: taskId,
      details: { status },
    });
  revalidatePath("/portal");
  revalidatePath("/admin/operations");
}

export async function addTaskUpdate(formData: FormData) {
  const taskId = textValue(formData, "taskId", true);
  const { member } = await authorizedTask(taskId);
  const body = textValue(formData, "body");
  const attachmentUrl = textValue(formData, "attachmentUrl");
  if (!body && !attachmentUrl) throw new Error("Add a comment or attachment.");
  let safeUrl: string | null = null;
  const attachmentPathname = textValue(formData, "attachmentPathname");
  if (attachmentUrl) {
    const url = new URL(attachmentUrl);
    if (!url.hostname.endsWith(".public.blob.vercel-storage.com"))
      throw new Error("Attachment could not be verified.");
    if (
      !attachmentPathname.startsWith(
        `uploads/task-attachment/${taskId}/${member.id}/`,
      )
    )
      throw new Error("Attachment path could not be verified.");
    safeUrl = url.toString();
  }
  const bytes = Number(textValue(formData, "attachmentBytes") || "0");
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > 10 * 1024 * 1024)
    throw new Error("Attachment size is invalid.");
  const [comment] = await getDb()
    .insert(taskComments)
    .values({
      taskId,
      memberId: member.id,
      body,
      isDeliverable: formData.get("isDeliverable") === "on",
      attachmentUrl: safeUrl,
      attachmentPathname: attachmentPathname || null,
      attachmentName: textValue(formData, "attachmentName") || null,
      attachmentMimeType: textValue(formData, "attachmentMimeType") || null,
      attachmentBytes: bytes || null,
    })
    .returning({ id: taskComments.id });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "task.update_added",
      entityType: "task_comment",
      entityId: comment.id,
      details: { taskId, hasAttachment: Boolean(safeUrl) },
    });
  revalidatePath("/portal");
  revalidatePath("/admin/operations");
}
