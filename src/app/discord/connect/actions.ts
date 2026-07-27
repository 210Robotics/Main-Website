"use server";

import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  discordGuildMembers,
  discordLinkTokens,
} from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { discordTokenHash, recordDiscordEvent } from "@/lib/discord";

export async function connectDiscordAccount(formData: FormData) {
  const member = await getCurrentMember();
  const token = String(formData.get("token") || "");
  if (!member) {
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/discord/connect?token=${token}`)}`,
    );
  }
  if (token.length < 20) redirect("/discord/connect?error=invalid");
  const tokenHash = discordTokenHash(token);
  const [link] = await getDb()
    .select()
    .from(discordLinkTokens)
    .where(
      and(
        eq(discordLinkTokens.tokenHash, tokenHash),
        isNull(discordLinkTokens.usedAt),
        gt(discordLinkTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!link) redirect("/discord/connect?error=expired");

  const [discordMember] = await getDb()
    .select()
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, link.guildId),
        eq(discordGuildMembers.discordUserId, link.discordUserId),
      ),
    )
    .limit(1);
  if (!discordMember) redirect("/discord/connect?error=missing");
  if (
    discordMember.linkedMemberId &&
    discordMember.linkedMemberId !== member.id
  ) {
    redirect("/discord/connect?error=already-linked");
  }
  const [otherDiscordIdentity] = await getDb()
    .select({ id: discordGuildMembers.id })
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, link.guildId),
        eq(discordGuildMembers.linkedMemberId, member.id),
        ne(discordGuildMembers.discordUserId, link.discordUserId),
      ),
    )
    .limit(1);
  if (otherDiscordIdentity) {
    redirect("/discord/connect?error=member-already-linked");
  }

  const now = new Date();
  const [claimed] = await getDb()
    .update(discordLinkTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(discordLinkTokens.tokenHash, tokenHash),
        isNull(discordLinkTokens.usedAt),
      ),
    )
    .returning();
  if (!claimed) redirect("/discord/connect?error=expired");
  await getDb()
    .update(discordGuildMembers)
    .set({ linkedMemberId: member.id, updatedAt: now })
    .where(eq(discordGuildMembers.id, discordMember.id));
  await recordDiscordEvent({
    guildId: link.guildId,
    discordUserId: link.discordUserId,
    kind: "ACCOUNT_LINKED",
    metadata: { memberId: member.id },
  });
  redirect(
    member.status === "ACTIVE"
      ? "/portal?tab=connections&discord=linked"
      : "/pending?discord=linked",
  );
}

