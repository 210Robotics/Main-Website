"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { auditEvents, contributions, hourEntries, members } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";

const hourSchema = z.object({ date: z.string().date(), hours: z.coerce.number().positive().max(24), project: z.string().min(2).max(100), category: z.string().min(2).max(100), description: z.string().trim().min(5).max(1000) });
const contributionSchema = z.object({ date: z.string().date(), title: z.string().trim().min(3).max(160), project: z.string().min(2).max(100), category: z.string().min(2).max(100), description: z.string().trim().min(5).max(2000), link: z.union([z.url(), z.literal("")]).default("") });

export async function addHour(formData: FormData) {
  const member = await requireActiveMember();
  const parsed = hourSchema.parse(Object.fromEntries(formData));
  const [entry] = await getDb().insert(hourEntries).values({ memberId: member.id, workDate: new Date(`${parsed.date}T12:00:00Z`), minutes: Math.round(parsed.hours * 60), project: parsed.project, category: parsed.category, description: parsed.description }).returning({ id: hourEntries.id });
  await getDb().insert(auditEvents).values({ actorMemberId: member.id, action: "hour.created", entityType: "hour_entry", entityId: entry.id });
  revalidatePath("/portal");
}

export async function addContribution(formData: FormData) {
  const member = await requireActiveMember();
  const parsed = contributionSchema.parse(Object.fromEntries(formData));
  const [entry] = await getDb().insert(contributions).values({ memberId: member.id, contributionDate: new Date(`${parsed.date}T12:00:00Z`), title: parsed.title, project: parsed.project, category: parsed.category, description: parsed.description, evidenceUrl: parsed.link || null }).returning({ id: contributions.id });
  await getDb().insert(auditEvents).values({ actorMemberId: member.id, action: "contribution.created", entityType: "contribution", entityId: entry.id });
  revalidatePath("/portal");
}

export async function deleteHour(id: string) {
  const member = await requireActiveMember();
  await getDb().update(hourEntries).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(hourEntries.id, id), eq(hourEntries.memberId, member.id)));
  await getDb().insert(auditEvents).values({ actorMemberId: member.id, action: "hour.deleted", entityType: "hour_entry", entityId: id });
  revalidatePath("/portal");
}

export async function deleteContribution(id: string) {
  const member = await requireActiveMember();
  await getDb().update(contributions).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(contributions.id, id), eq(contributions.memberId, member.id)));
  await getDb().insert(auditEvents).values({ actorMemberId: member.id, action: "contribution.deleted", entityType: "contribution", entityId: id });
  revalidatePath("/portal");
}

export async function updateProfile(formData: FormData) {
  const member = await requireActiveMember();
  const parsed = z.object({ displayName: z.string().trim().min(2).max(100), bio: z.string().trim().max(700), photoUrl: z.union([z.url(), z.literal("")]) }).parse(Object.fromEntries(formData));
  await getDb().update(members).set({ displayName: parsed.displayName, bio: parsed.bio, photoUrl: parsed.photoUrl || null, updatedAt: new Date() }).where(eq(members.id, member.id));
  await getDb().insert(auditEvents).values({ actorMemberId: member.id, action: "profile.updated", entityType: "member", entityId: member.id });
  revalidatePath("/portal"); revalidatePath("/members");
}
