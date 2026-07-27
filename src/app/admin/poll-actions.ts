"use server";

import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  availabilityPollResponses,
  availabilityPolls,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import {
  availabilityDefinitionSchema,
  defaultAvailabilityPollSchedule,
  generateAvailabilitySlots,
} from "@/lib/availability";

export type PollManagerState = {
  status: "idle" | "success" | "error";
  message: string;
  pollId?: string;
  savedPoll?: {
    id: string;
    title: string;
    description: string;
    timezone: string;
    dates: string[];
    startTime: string;
    endTime: string;
    slotMinutes: number;
    status: "DRAFT" | "OPEN" | "CLOSED";
    updatedAt: string;
  };
};
const idle: PollManagerState = { status: "idle", message: "" };

const pollSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(2000),
    timezone: z.string().trim().min(2).max(80),
    status: z.enum(["DRAFT", "OPEN", "CLOSED"]),
  })
  .and(availabilityDefinitionSchema);

function accessKey() {
  return randomBytes(24).toString("base64url");
}
function refresh(key?: string) {
  revalidatePath("/admin");
  if (key) revalidatePath(`/p/${key}`);
}

export async function createAvailabilityPoll(
  _previous: PollManagerState = idle,
  formData: FormData,
): Promise<PollManagerState> {
  void _previous;
  try {
    const actor = await requirePermission("forms.manage");
    const title = z
      .string()
      .trim()
      .min(2)
      .max(180)
      .parse(formData.get("title"));
    const schedule = defaultAvailabilityPollSchedule();
    const [poll] = await getDb()
      .insert(availabilityPolls)
      .values({
        title,
        accessKey: accessKey(),
        ...schedule,
        createdByMemberId: actor.id,
        lastEditorMemberId: actor.id,
      })
      .returning({
        id: availabilityPolls.id,
        accessKey: availabilityPolls.accessKey,
      });
    await getDb()
      .insert(auditEvents)
      .values({
        actorMemberId: actor.id,
        action: "availability_poll.created",
        entityType: "availability_poll",
        entityId: poll.id,
      });
    refresh(poll.accessKey);
    return {
      status: "success",
      message: "Availability poll created and open for responses.",
      pollId: poll.id,
    };
  } catch (error) {
    console.error("Poll creation failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? `The poll could not be created: ${error.message}`
          : "The poll could not be created.",
    };
  }
}

export async function saveAvailabilityPoll(
  input: unknown,
): Promise<PollManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const data = pollSchema.parse(input);
    generateAvailabilitySlots(data);
    const [existing] = await getDb()
      .select()
      .from(availabilityPolls)
      .where(eq(availabilityPolls.id, data.id))
      .limit(1);
    if (!existing) return { status: "error", message: "Poll not found." };
    const now = new Date();
    const [saved] = await getDb()
      .update(availabilityPolls)
      .set({
        title: data.title,
        description: data.description,
        timezone: data.timezone,
        dates: [...new Set(data.dates)].sort(),
        startTime: data.startTime,
        endTime: data.endTime,
        slotMinutes: data.slotMinutes,
        status: data.status,
        openedAt:
          data.status === "OPEN" && existing.status !== "OPEN"
            ? now
            : existing.openedAt,
        closedAt:
          data.status === "CLOSED"
            ? now
            : data.status === "OPEN"
              ? null
              : existing.closedAt,
        lastEditorMemberId: actor.id,
        updatedAt: now,
      })
      .where(eq(availabilityPolls.id, data.id))
      .returning({
        id: availabilityPolls.id,
        title: availabilityPolls.title,
        description: availabilityPolls.description,
        timezone: availabilityPolls.timezone,
        dates: availabilityPolls.dates,
        startTime: availabilityPolls.startTime,
        endTime: availabilityPolls.endTime,
        slotMinutes: availabilityPolls.slotMinutes,
        status: availabilityPolls.status,
        updatedAt: availabilityPolls.updatedAt,
      });
    if (!saved) return { status: "error", message: "Poll not found." };
    await getDb()
      .insert(auditEvents)
      .values({
        actorMemberId: actor.id,
        action: "availability_poll.updated",
        entityType: "availability_poll",
        entityId: data.id,
        details: {
          title: data.title,
          status: data.status,
          dateCount: data.dates.length,
        },
      });
    refresh(existing.accessKey);
    return {
      status: "success",
      message:
        data.status === "OPEN"
          ? "Poll saved and open for availability."
          : "Poll saved.",
      savedPoll: { ...saved, updatedAt: saved.updatedAt.toISOString() },
    };
  } catch (error) {
    console.error("Poll save failed", error);
    return {
      status: "error",
      message:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Check the poll settings.")
          : "The poll could not be saved.",
    };
  }
}

export async function duplicateAvailabilityPoll(
  value: string,
): Promise<PollManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const id = z.uuid().parse(value);
    const [source] = await getDb()
      .select()
      .from(availabilityPolls)
      .where(eq(availabilityPolls.id, id))
      .limit(1);
    if (!source) return { status: "error", message: "Poll not found." };
    const [copy] = await getDb()
      .insert(availabilityPolls)
      .values({
        accessKey: accessKey(),
        title: `${source.title} (copy)`,
        description: source.description,
        timezone: source.timezone,
        dates: source.dates,
        startTime: source.startTime,
        endTime: source.endTime,
        slotMinutes: source.slotMinutes,
        status: "OPEN",
        openedAt: new Date(),
        createdByMemberId: actor.id,
        lastEditorMemberId: actor.id,
      })
      .returning({
        id: availabilityPolls.id,
        accessKey: availabilityPolls.accessKey,
      });
    refresh(copy.accessKey);
    return {
      status: "success",
      message: "Poll duplicated and opened for responses.",
      pollId: copy.id,
    };
  } catch (error) {
    console.error("Poll duplication failed", error);
    return { status: "error", message: "The poll could not be duplicated." };
  }
}

export async function deleteAvailabilityPoll(
  value: string,
): Promise<PollManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const id = z.uuid().parse(value);
    const [poll] = await getDb()
      .delete(availabilityPolls)
      .where(eq(availabilityPolls.id, id))
      .returning({
        accessKey: availabilityPolls.accessKey,
        title: availabilityPolls.title,
      });
    if (!poll) return { status: "error", message: "Poll not found." };
    await getDb()
      .insert(auditEvents)
      .values({
        actorMemberId: actor.id,
        action: "availability_poll.deleted",
        entityType: "availability_poll",
        entityId: id,
        details: { title: poll.title },
      });
    refresh(poll.accessKey);
    return {
      status: "success",
      message: "Poll and availability responses deleted.",
    };
  } catch (error) {
    console.error("Poll deletion failed", error);
    return { status: "error", message: "The poll could not be deleted." };
  }
}

export async function deleteAvailabilityResponse(
  value: string,
): Promise<PollManagerState> {
  try {
    const actor = await requirePermission("forms.manage");
    const id = z.uuid().parse(value);
    const [response] = await getDb()
      .delete(availabilityPollResponses)
      .where(eq(availabilityPollResponses.id, id))
      .returning({ pollId: availabilityPollResponses.pollId });
    if (!response)
      return { status: "error", message: "Availability response not found." };
    await getDb()
      .update(availabilityPolls)
      .set({
        responseCount: sql`greatest(0, ${availabilityPolls.responseCount} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(availabilityPolls.id, response.pollId));
    await getDb()
      .insert(auditEvents)
      .values({
        actorMemberId: actor.id,
        action: "availability_poll.response_deleted",
        entityType: "availability_poll_response",
        entityId: id,
        details: { pollId: response.pollId },
      });
    refresh();
    return { status: "success", message: "Availability response deleted." };
  } catch (error) {
    console.error("Poll response deletion failed", error);
    return { status: "error", message: "The response could not be deleted." };
  }
}
