"use server";

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  availabilityPollResponses,
  availabilityPolls,
  members,
} from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { generateAvailabilitySlots } from "@/lib/availability";
import { publicRequestFingerprint } from "@/lib/public-fingerprint";

export type AvailabilityState = {
  status: "idle" | "success" | "error";
  message: string;
  saved?: boolean;
};

export async function submitAvailability(
  _previous: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  void _previous;
  try {
    const accessKey = z
      .string()
      .min(24)
      .max(80)
      .parse(formData.get("accessKey"));
    const submittedParticipantKey = z
      .uuid()
      .parse(formData.get("participantKey"));
    const member = await getCurrentMember();
    const activeMember = member?.status === "ACTIVE" ? member : null;
    const anonymousIdentity = activeMember
      ? null
      : z
          .object({
            name: z.string().trim().min(2).max(100),
            email: z.email().max(320),
          })
          .parse({ name: formData.get("name"), email: formData.get("email") });
    const name = activeMember?.displayName ?? anonymousIdentity!.name;
    const email = (
      activeMember?.email ?? anonymousIdentity!.email
    ).toLowerCase();
    let memberId: string | null = activeMember?.id ?? null;
    if (!memberId) {
      const [matched] = await getDb()
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.status, "ACTIVE"),
            sql`lower(${members.email}) = ${email}`,
          ),
        )
        .limit(1);
      memberId = matched?.id ?? null;
    }
    const [poll] = await getDb()
      .select()
      .from(availabilityPolls)
      .where(eq(availabilityPolls.accessKey, accessKey))
      .limit(1);
    if (!poll || poll.status !== "OPEN")
      return {
        status: "error",
        message: "This poll is not accepting availability.",
      };
    const allowed = new Set(generateAvailabilitySlots(poll));
    const slots = [...new Set(formData.getAll("slots").map(String))];
    if (slots.some((slot) => !allowed.has(slot)))
      return {
        status: "error",
        message: "One or more selected times are invalid.",
      };
    const fingerprint = await publicRequestFingerprint(accessKey);
    const recent = await getDb()
      .select({ id: availabilityPollResponses.id })
      .from(availabilityPollResponses)
      .where(
        and(
          eq(availabilityPollResponses.pollId, poll.id),
          eq(availabilityPollResponses.requestFingerprint, fingerprint),
          gt(
            availabilityPollResponses.updatedAt,
            new Date(Date.now() - 60_000),
          ),
        ),
      )
      .orderBy(desc(availabilityPollResponses.updatedAt))
      .limit(11);
    if (recent.length >= 10)
      return {
        status: "error",
        message: "Too many updates were sent. Wait a minute and try again.",
      };
    const [existing] = await getDb()
      .select({
        id: availabilityPollResponses.id,
        participantKey: availabilityPollResponses.participantKey,
      })
      .from(availabilityPollResponses)
      .where(
        and(
          eq(availabilityPollResponses.pollId, poll.id),
          activeMember
            ? or(
                eq(
                  availabilityPollResponses.submittedByMemberId,
                  activeMember.id,
                ),
                and(
                  isNull(availabilityPollResponses.submittedByMemberId),
                  sql`lower(${availabilityPollResponses.email}) = ${email}`,
                ),
              )
            : eq(
                availabilityPollResponses.participantKey,
                submittedParticipantKey,
              ),
        ),
      )
      .limit(1);
    const participantKey = existing?.participantKey ?? submittedParticipantKey;
    await getDb()
      .insert(availabilityPollResponses)
      .values({
        pollId: poll.id,
        participantKey,
        name,
        email,
        availableSlots: slots,
        submittedByMemberId: memberId,
        requestFingerprint: fingerprint,
      })
      .onConflictDoUpdate({
        target: [
          availabilityPollResponses.pollId,
          availabilityPollResponses.participantKey,
        ],
        set: {
          name,
          email,
          availableSlots: slots,
          submittedByMemberId: memberId,
          requestFingerprint: fingerprint,
          updatedAt: new Date(),
        },
      });
    if (!existing)
      await getDb()
        .update(availabilityPolls)
        .set({
          responseCount: sql`${availabilityPolls.responseCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(availabilityPolls.id, poll.id));
    revalidatePath(`/p/${accessKey}`);
    revalidatePath("/admin");
    revalidatePath("/portal");
    return {
      status: "success",
      message: existing
        ? "Your availability was updated."
        : "Your availability was saved.",
      saved: true,
    };
  } catch (error) {
    console.error("Availability submission failed", error);
    return {
      status: "error",
      message:
        "Your availability could not be saved. Check your name and email, then try again.",
    };
  }
}
