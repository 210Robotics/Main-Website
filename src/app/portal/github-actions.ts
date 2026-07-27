"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { auditEvents, operationsHubRecords } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";

export async function linkGitHubUsername(usernameValue: string) {
  const actor = await requireActiveMember();
  const username = usernameValue.trim().replace(/^@/, "");
  if (!/^[a-zd](?:[a-zd-]{0,37}[a-zd])?$/i.test(username))
    return { status: "error" as const, message: "Enter a valid GitHub username." };
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "210-Robotics-Member-Portal",
    },
    cache: "no-store",
  });
  if (!response.ok)
    return { status: "error" as const, message: "That public GitHub profile could not be found." };
  const profile = (await response.json()) as { login?: string };
  const normalized = profile.login || username;
  const [existing] = await getDb()
    .select({ id: operationsHubRecords.id })
    .from(operationsHubRecords)
    .where(and(
      eq(operationsHubRecords.kind, "GITHUB_ACCOUNT"),
      eq(operationsHubRecords.subjectMemberId, actor.id),
      isNull(operationsHubRecords.archivedAt),
    ))
    .limit(1);
  const values = {
    title: `@${normalized}`,
    description: "Member-linked public GitHub profile",
    status: "ACTIVE",
    subjectMemberId: actor.id,
    sourceType: "member-public-github-link",
    sourceUrl: `https://github.com/${normalized}`,
    data: { githubUsername: normalized, linkMode: "PUBLIC_PROFILE" },
    updatedAt: new Date(),
  };
  const record = existing
    ? (await getDb().update(operationsHubRecords).set(values).where(eq(operationsHubRecords.id, existing.id)).returning({ id: operationsHubRecords.id }))[0]
    : (await getDb().insert(operationsHubRecords).values({
        ...values,
        kind: "GITHUB_ACCOUNT",
        createdByMemberId: actor.id,
      }).returning({ id: operationsHubRecords.id }))[0];
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: existing ? "github.account_link_updated" : "github.account_linked",
    entityType: "operations_hub_record",
    entityId: record.id,
    details: { username: normalized, mode: "PUBLIC_PROFILE" },
  });
  revalidatePath("/portal");
  return { status: "success" as const, message: `Linked @${normalized} to your 210 account.` };
}
