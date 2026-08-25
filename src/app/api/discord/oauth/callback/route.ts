import { createHmac, timingSafeEqual } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  auditEvents,
  discordGuildMembers,
  discordGuilds,
  members,
} from "@/db/schema";
import { reconcileMemberMembership } from "@/lib/membership-access-server";
import {
  completeDiscordLinkedOnboarding,
  recordDiscordEvent,
  syncDiscordDuesAccessForMember,
} from "@/lib/discord";

export const runtime = "nodejs";

type DiscordIdentity = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

type StatePayload = {
  memberId: string;
  clerkUserId: string;
  nonce: string;
  issuedAt: number;
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com").replace(/\/$/, "");
}

function oauthSecret() {
  return process.env.DISCORD_OAUTH_STATE_SECRET || process.env.DISCORD_VOICE_WORKER_SECRET || "";
}

function verifyState(value: string, secret: string): StatePayload | null {
  const [encoded, signature] = value.split(".", 2);
  if (!encoded || !signature || !secret) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(signature);
  if (
    expectedBytes.length !== receivedBytes.length ||
    !timingSafeEqual(expectedBytes, receivedBytes)
  ) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as StatePayload;
    if (
      !payload.memberId ||
      !payload.clerkUserId ||
      !payload.nonce ||
      Date.now() - payload.issuedAt > 10 * 60_000
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

function finish(path: string) {
  const response = NextResponse.redirect(new URL(path, siteUrl()));
  response.cookies.delete("discord_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  if (error) return finish("/verify?discord=cancelled");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") || "";
  const cookieState = request.cookies.get("discord_oauth_state")?.value || "";
  if (!code || !state || state !== cookieState) return finish("/verify?discord=invalid-state");
  const payload = verifyState(state, oauthSecret());
  const { userId } = await auth();
  if (!payload || !userId || payload.clerkUserId !== userId) {
    return finish("/verify?discord=invalid-state");
  }
  const [member] = await getDb()
    .select()
    .from(members)
    .where(and(eq(members.id, payload.memberId), eq(members.clerkUserId, userId)))
    .limit(1);
  if (!member) return finish("/verify?discord=member-missing");
  const clientId = process.env.DISCORD_APPLICATION_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!clientId || !clientSecret || !botToken || !guildId) {
    return finish("/verify?discord=unavailable");
  }
  const redirectUri = `${siteUrl()}/api/discord/oauth/callback`;
  const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const token = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string };
  if (!tokenResponse.ok || !token.access_token) return finish("/verify?discord=exchange-failed");
  const identityResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const identity = (await identityResponse.json().catch(() => ({}))) as DiscordIdentity;
  if (!identityResponse.ok || !/^\d{15,22}$/.test(identity.id || "")) {
    return finish("/verify?discord=identity-failed");
  }
  const guildMemberResponse = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${identity.id}`,
    {
      headers: { authorization: `Bot ${botToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  const guildMember = (await guildMemberResponse.json().catch(() => ({}))) as {
    nick?: string | null;
    roles?: string[];
    joined_at?: string | null;
    user?: DiscordIdentity;
  };
  if (!guildMemberResponse.ok) return finish("/verify?discord=join-server-first");
  const [otherIdentity] = await getDb()
    .select({ id: discordGuildMembers.id })
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, guildId),
        eq(discordGuildMembers.linkedMemberId, member.id),
        ne(discordGuildMembers.discordUserId, identity.id),
      ),
    )
    .limit(1);
  const [otherMember] = await getDb()
    .select({ linkedMemberId: discordGuildMembers.linkedMemberId })
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, guildId),
        eq(discordGuildMembers.discordUserId, identity.id),
      ),
    )
    .limit(1);
  if (otherIdentity || (otherMember?.linkedMemberId && otherMember.linkedMemberId !== member.id)) {
    return finish("/verify?discord=already-linked");
  }
  const now = new Date();
  await getDb()
    .insert(discordGuilds)
    .values({ id: guildId })
    .onConflictDoNothing({ target: discordGuilds.id });
  const [linked] = await getDb()
    .insert(discordGuildMembers)
    .values({
      guildId,
      discordUserId: identity.id,
      username: identity.username,
      displayName: guildMember.nick || identity.global_name || identity.username,
      avatarHash: identity.avatar || null,
      roles: guildMember.roles || [],
      joinedAt: guildMember.joined_at ? new Date(guildMember.joined_at) : null,
      linkedMemberId: member.id,
      linkedAt: now,
      lastSynchronizedAt: now,
      guildMembershipStatus: "ACTIVE",
      nicknameSyncStatus: "PENDING",
      roleSyncStatus: "PENDING",
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [discordGuildMembers.guildId, discordGuildMembers.discordUserId],
      set: {
        username: identity.username,
        displayName: guildMember.nick || identity.global_name || identity.username,
        avatarHash: identity.avatar || null,
        roles: guildMember.roles || [],
        linkedMemberId: member.id,
        linkedAt: now,
        lastSynchronizedAt: now,
        guildMembershipStatus: "ACTIVE",
        leftAt: null,
        updatedAt: now,
      },
    })
    .returning();
  await Promise.all([
    recordDiscordEvent({
      guildId,
      discordUserId: identity.id,
      kind: "ACCOUNT_LINKED_OAUTH",
      metadata: { memberId: member.id },
    }),
    getDb().insert(auditEvents).values({
      actorMemberId: member.id,
      action: "discord.oauth_linked",
      entityType: "member",
      entityId: member.id,
      details: { discordUserId: identity.id },
    }),
  ]);
  if (linked) await completeDiscordLinkedOnboarding({ guildMemberId: linked.id });
  await reconcileMemberMembership(member.id);
  await syncDiscordDuesAccessForMember(member.id).catch(() => undefined);
  return finish("/verify?discord=linked");
}

