"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditEvents,
  contributions,
  hourEntries,
  members,
  timeSessions,
} from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";

const hourSchema = z.object({
  date: z.string().date(),
  hours: z.coerce.number().positive().max(24),
  project: z.string().min(2).max(100),
  category: z.string().min(2).max(100),
  description: z.string().trim().min(5).max(1000),
});
const contributionSchema = z.object({
  date: z.string().date(),
  title: z.string().trim().min(3).max(160),
  project: z.string().min(2).max(100),
  category: z.string().min(2).max(100),
  description: z.string().trim().min(5).max(2000),
  link: z.union([z.url(), z.literal("")]).default(""),
});
const clockSchema = z.object({
  project: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(3).max(1000),
});

export async function clockIn(formData: FormData) {
  const member = await requireActiveMember();
  const parsed = clockSchema.parse(Object.fromEntries(formData));
  const [active] = await getDb()
    .select({ id: timeSessions.id })
    .from(timeSessions)
    .where(
      and(eq(timeSessions.memberId, member.id), isNull(timeSessions.clockOut)),
    )
    .limit(1);
  if (active) return;
  const [session] = await getDb()
    .insert(timeSessions)
    .values({
      memberId: member.id,
      project: parsed.project,
      category: parsed.category,
      description: parsed.description,
    })
    .returning({ id: timeSessions.id });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "time.clock_in",
      entityType: "time_session",
      entityId: session.id,
    });
  revalidatePath("/portal");
}

export async function clockOut() {
  const member = await requireActiveMember();
  const [active] = await getDb()
    .select()
    .from(timeSessions)
    .where(
      and(eq(timeSessions.memberId, member.id), isNull(timeSessions.clockOut)),
    )
    .orderBy(desc(timeSessions.clockIn))
    .limit(1);
  if (!active) return;
  const endedAt = new Date();
  const minutes = Math.max(
    1,
    Math.round((endedAt.getTime() - active.clockIn.getTime()) / 60000),
  );
  const [closed] = await getDb()
    .update(timeSessions)
    .set({ clockOut: endedAt, updatedAt: endedAt })
    .where(and(eq(timeSessions.id, active.id), isNull(timeSessions.clockOut)))
    .returning({ id: timeSessions.id });
  if (!closed) return;
  const [entry] = await getDb()
    .insert(hourEntries)
    .values({
      memberId: member.id,
      workDate: active.clockIn,
      minutes,
      project: active.project,
      category: active.category,
      description: active.description,
      eventId: `clock:${active.id}`,
    })
    .returning({ id: hourEntries.id });
  await getDb()
    .update(timeSessions)
    .set({ hourEntryId: entry.id, updatedAt: new Date() })
    .where(eq(timeSessions.id, active.id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "time.clock_out",
      entityType: "time_session",
      entityId: active.id,
      details: { hourEntryId: entry.id, minutes },
    });
  revalidatePath("/portal");
}

export async function addHour(formData: FormData) {
  const member = await requireActiveMember();
  const parsed = hourSchema.parse(Object.fromEntries(formData));
  const [entry] = await getDb()
    .insert(hourEntries)
    .values({
      memberId: member.id,
      workDate: new Date(`${parsed.date}T12:00:00Z`),
      minutes: Math.round(parsed.hours * 60),
      project: parsed.project,
      category: parsed.category,
      description: parsed.description,
    })
    .returning({ id: hourEntries.id });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "hour.created",
      entityType: "hour_entry",
      entityId: entry.id,
    });
  revalidatePath("/portal");
}

export async function addContribution(formData: FormData) {
  const member = await requireActiveMember();
  const parsed = contributionSchema.parse(Object.fromEntries(formData));
  const [entry] = await getDb()
    .insert(contributions)
    .values({
      memberId: member.id,
      contributionDate: new Date(`${parsed.date}T12:00:00Z`),
      title: parsed.title,
      project: parsed.project,
      category: parsed.category,
      description: parsed.description,
      evidenceUrl: parsed.link || null,
    })
    .returning({ id: contributions.id });
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "contribution.created",
      entityType: "contribution",
      entityId: entry.id,
    });
  revalidatePath("/portal");
}

export async function deleteHour(id: string) {
  const member = await requireActiveMember();
  await getDb()
    .update(hourEntries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(hourEntries.id, id), eq(hourEntries.memberId, member.id)));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "hour.deleted",
      entityType: "hour_entry",
      entityId: id,
    });
  revalidatePath("/portal");
}

export async function deleteContribution(id: string) {
  const member = await requireActiveMember();
  await getDb()
    .update(contributions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(contributions.id, id), eq(contributions.memberId, member.id)),
    );
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "contribution.deleted",
      entityType: "contribution",
      entityId: id,
    });
  revalidatePath("/portal");
}

export async function updateProfile(formData: FormData) {
  const member = await requireActiveMember();
  const parsed = z
    .object({
      displayName: z.string().trim().min(2).max(100),
      bio: z.string().trim().max(700),
      photoUrl: z.union([z.url(), z.literal("")]),
    })
    .parse(Object.fromEntries(formData));
  await getDb()
    .update(members)
    .set({
      displayName: parsed.displayName,
      bio: parsed.bio,
      photoUrl: parsed.photoUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(members.id, member.id));
  await getDb()
    .insert(auditEvents)
    .values({
      actorMemberId: member.id,
      action: "profile.updated",
      entityType: "member",
      entityId: member.id,
    });
  revalidatePath("/portal");
  revalidatePath("/members");
}
