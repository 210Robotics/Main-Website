import { timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import {
  discordChannels,
  discordEvents,
  discordGuildMembers,
  discordGuilds,
  discordMessages,
} from "@/db/schema";
import {
  upsertDiscordGuild,
  upsertDiscordMember,
} from "@/lib/discord";
import { hasSensitiveEngineeringAttachment, redactLikelySecrets } from "@/lib/discord-content-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const messageEventSchema = z.object({
  guildId: z.string().regex(/^\d{15,22}$/),
  guildName: z.string().trim().min(1).max(120),
  channelId: z.string().regex(/^\d{15,22}$/),
  channelName: z.string().trim().min(1).max(120),
  channelType: z.number().int().min(0).max(16),
  messageId: z.string().regex(/^\d{15,22}$/),
  content: z.string().max(10_000),
  timestamp: z.iso.datetime(),
  editedTimestamp: z.iso.datetime().nullable().optional(),
  author: z.object({
    id: z.string().regex(/^\d{15,22}$/),
    username: z.string().trim().min(1).max(80),
    displayName: z.string().trim().min(1).max(120),
    avatar: z.string().nullable().optional(),
    roles: z.array(z.string().regex(/^\d{15,22}$/)).max(100).default([]),
    joinedAt: z.iso.datetime().nullable().optional(),
  }),
  attachments: z
    .array(
      z.object({
        id: z.string().regex(/^\d{15,22}$/),
        filename: z.string().min(1).max(255),
        url: z.url(),
        contentType: z.string().max(150).nullable().optional(),
        size: z.number().int().nonnegative().optional(),
      }),
    )
    .max(25)
    .default([]),
});

function authorized(request: Request) {
  const expected = process.env.DISCORD_VOICE_WORKER_SECRET;
  const received = request.headers.get("authorization")?.replace(
    /^Bearer\s+/i,
    "",
  );
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = messageEventSchema.parse(await request.json());
    await upsertDiscordGuild({
      guildId: data.guildId,
      name: data.guildName,
    });
    const member = await upsertDiscordMember({
      guildId: data.guildId,
      user: {
        id: data.author.id,
        username: data.author.username,
        global_name: data.author.displayName,
        avatar: data.author.avatar,
        bot: false,
      },
      displayName: data.author.displayName,
      roles: data.author.roles,
      joinedAt: data.author.joinedAt,
    });
    const now = new Date();
    const db = getDb();
    const [guildSettings] = await db
      .select({
        reactionEnabled: discordGuilds.messageReactionEnabled,
        reactionEmoji: discordGuilds.messageReactionEmoji,
        duesPublicChannelIds: discordGuilds.duesPublicChannelIds,
        verificationPublicChannelIds: discordGuilds.verificationPublicChannelIds,
      })
      .from(discordGuilds)
      .where(eq(discordGuilds.id, data.guildId))
      .limit(1);
    const protectedContent = redactLikelySecrets(data.content);
    const publicChannelIds = new Set([
      ...(guildSettings?.duesPublicChannelIds || []),
      ...(guildSettings?.verificationPublicChannelIds || []),
    ]);
    const sensitivePublicAttachment =
      publicChannelIds.has(data.channelId) &&
      hasSensitiveEngineeringAttachment(data.attachments.map((item) => item.filename));
    const moderationAction = protectedContent.matches
      ? "REMOVE_SECRET"
      : sensitivePublicAttachment
        ? "REMOVE_SENSITIVE_ATTACHMENT"
        : null;
    await db
      .insert(discordChannels)
      .values({
        id: data.channelId,
        guildId: data.guildId,
        name: data.channelName,
        type: data.channelType,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: discordChannels.id,
        set: {
          name: data.channelName,
          type: data.channelType,
          lastSyncedAt: now,
        },
      });
    if (moderationAction) {
      await db.insert(discordEvents).values({
        guildId: data.guildId,
        discordUserId: data.author.id,
        kind: moderationAction,
        metadata: { channelId: data.channelId, messageId: data.messageId },
      });
    }
    const [linked] = await db
      .select({ memberId: discordGuildMembers.linkedMemberId })
      .from(discordGuildMembers)
      .where(
        and(
          eq(discordGuildMembers.guildId, data.guildId),
          eq(discordGuildMembers.discordUserId, data.author.id),
        ),
      )
      .limit(1);
    await db
      .insert(discordMessages)
      .values({
        id: data.messageId,
        guildId: data.guildId,
        channelId: data.channelId,
        channelName: data.channelName,
        authorDiscordUserId: data.author.id,
        authorUsername: data.author.username,
        authorDisplayName: data.author.displayName,
        authorIsBot: false,
        linkedMemberId: linked?.memberId || member.linkedMemberId || null,
        content: protectedContent.redacted,
        attachments: data.attachments,
        discordCreatedAt: new Date(data.timestamp),
        discordEditedAt: data.editedTimestamp
          ? new Date(data.editedTimestamp)
          : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: discordMessages.id,
        set: {
          channelId: sql`excluded.channel_id`,
          channelName: sql`excluded.channel_name`,
          authorUsername: sql`excluded.author_username`,
          authorDisplayName: sql`excluded.author_display_name`,
          linkedMemberId: sql`excluded.linked_member_id`,
          content: sql`excluded.content`,
          attachments: sql`excluded.attachments`,
          discordEditedAt: sql`excluded.discord_edited_at`,
          deletedAt: null,
          updatedAt: now,
        },
      });
    return NextResponse.json({
      logged: true,
      messageId: data.messageId,
      moderationAction,
      reaction:
        !moderationAction && guildSettings?.reactionEnabled && guildSettings.reactionEmoji
          ? guildSettings.reactionEmoji
          : null,
    });
  } catch (error) {
    console.error("Discord realtime message log failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The Discord message could not be logged.",
      },
      { status: 400 },
    );
  }
}
