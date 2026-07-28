import "server-only";

import { randomBytes } from "node:crypto";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  discordCalendarReminders,
  discordChannels,
  discordDirectMessages,
  discordEvents,
  discordGuildMembers,
  discordGuilds,
  discordLinkTokens,
  discordMessages,
} from "@/db/schema";
import { refreshCalendarEvents } from "@/lib/calendar";
import {
  discordTokenHash,
  verifyDiscordSignature,
} from "@/lib/discord-signature";
import { discordApplicationCommands } from "@/lib/discord-commands";
import {
  inferDiscordOnboardingRoleIds,
  type DiscordRoleOption,
} from "@/lib/discord-role-selection";

const DISCORD_API = "https://discord.com/api/v10";

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  bot?: boolean;
};

type DiscordGuildMember = {
  user: DiscordUser;
  nick?: string | null;
  roles: string[];
  joined_at?: string | null;
};

type DiscordGuild = {
  id: string;
  name: string;
  icon?: string | null;
  approximate_member_count?: number;
};

type DiscordChannel = {
  id: string;
  guild_id?: string;
  name?: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  thread_metadata?: { archived?: boolean };
};

type DiscordRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
};

type DiscordMessage = {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: DiscordUser;
  member?: { nick?: string | null };
  content: string;
  timestamp: string;
  edited_timestamp?: string | null;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    content_type?: string | null;
    size?: number;
  }>;
  reactions?: Array<{
    me?: boolean;
    emoji?: {
      id?: string | null;
      name?: string | null;
    };
  }>;
};

function discordMessageIsNewer(
  message: DiscordMessage,
  latest: { id: string; createdAt: Date },
) {
  const createdAt = new Date(message.timestamp).getTime();
  const latestCreatedAt = latest.createdAt.getTime();
  if (createdAt !== latestCreatedAt) return createdAt > latestCreatedAt;
  if (message.id.length !== latest.id.length) {
    return message.id.length > latest.id.length;
  }
  return message.id > latest.id;
}

export function normalizeDiscordReactionEmoji(value: string) {
  const emoji = value.trim();
  if (
    !emoji ||
    emoji.length > 32 ||
    /\s/.test(emoji) ||
    /[\u0000-\u001f\u007f]/.test(emoji)
  ) {
    throw new Error("Choose one valid emoji without spaces.");
  }
  return emoji;
}

async function addDiscordMessageReaction(
  channelId: string,
  messageId: string,
  emoji: string,
) {
  await discordFetch(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "PUT" },
  );
}

export function discordConfiguration() {
  return {
    applicationId: Boolean(process.env.DISCORD_APPLICATION_ID),
    publicKey: Boolean(process.env.DISCORD_PUBLIC_KEY),
    botToken: Boolean(process.env.DISCORD_BOT_TOKEN),
    clientSecret: Boolean(process.env.DISCORD_CLIENT_SECRET),
  };
}

export async function checkDiscordGuildAccess(guildId: string) {
  try {
    const guild = await discordFetch<DiscordGuild>(
      `/guilds/${guildId}?with_counts=true`,
    );
    return {
      ok: true as const,
      name: guild.name,
      memberCount: guild.approximate_member_count ?? 0,
      reason: "",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      name: "",
      memberCount: 0,
      reason: detail.includes("(403)")
        ? "The bot has not been authorized into this Discord server."
        : detail.includes("(404)")
          ? "Discord could not find this server for the bot."
          : detail.includes("(401)")
            ? "Discord rejected the configured bot token."
            : "Discord server access could not be verified.",
    };
  }
}

export async function listDiscordGuildRoles(
  guildId: string,
): Promise<DiscordRoleOption[]> {
  if (!/^\d{15,22}$/.test(guildId)) {
    throw new Error("A valid Discord server is required.");
  }
  const roles = await discordFetch<DiscordRole[]>(`/guilds/${guildId}/roles`);
  return roles
    .map((role) => ({
      id: role.id,
      name: role.name,
      position: role.position,
      managed: role.managed,
    }))
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
}

async function discordFetch<T>(
  path: string,
  init: Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
  } = {},
) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  const requestHeaders: Record<string, string> = {
    Authorization: `Bot ${token}`,
    ...init.headers,
  };
  if (!(init.body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(
      `Discord API request failed (${response.status}): ${detail}`,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function upsertDiscordGuild({
  guildId,
  name,
  installedByDiscordUserId,
}: {
  guildId: string;
  name?: string;
  installedByDiscordUserId?: string;
}) {
  const now = new Date();
  await getDb()
    .insert(discordGuilds)
    .values({
      id: guildId,
      name: name || "Discord server",
      installedByDiscordUserId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: discordGuilds.id,
      set: {
        updatedAt: now,
        ...(name ? { name } : {}),
        ...(installedByDiscordUserId
          ? { installedByDiscordUserId }
          : {}),
      },
    });
}

export async function recordDiscordEvent({
  guildId,
  discordUserId,
  kind,
  commandName,
  metadata = {},
}: {
  guildId?: string | null;
  discordUserId?: string | null;
  kind: string;
  commandName?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await getDb().insert(discordEvents).values({
    guildId: guildId || null,
    discordUserId: discordUserId || null,
    kind,
    commandName: commandName || null,
    metadata,
  });
}

export async function upsertDiscordMember({
  guildId,
  user,
  displayName,
  roles = [],
  joinedAt,
}: {
  guildId: string;
  user: DiscordUser;
  displayName?: string;
  roles?: string[];
  joinedAt?: string | null;
}) {
  const now = new Date();
  const values = {
    guildId,
    discordUserId: user.id,
    username: user.username,
    displayName: displayName || user.global_name || user.username,
    avatarHash: user.avatar || null,
    roles,
    isBot: Boolean(user.bot),
    joinedAt: joinedAt ? new Date(joinedAt) : null,
    lastSeenAt: now,
    leftAt: null,
    updatedAt: now,
  };
  const [row] = await getDb()
    .insert(discordGuildMembers)
    .values(values)
    .onConflictDoUpdate({
      target: [
        discordGuildMembers.guildId,
        discordGuildMembers.discordUserId,
      ],
      set: values,
    })
    .returning();
  return row;
}

export async function createDiscordLinkToken({
  guildId,
  discordUserId,
  username,
}: {
  guildId: string;
  discordUserId: string;
  username: string;
}) {
  const token = randomBytes(32).toString("base64url");
  await getDb().insert(discordLinkTokens).values({
    tokenHash: discordTokenHash(token),
    guildId,
    discordUserId,
    username,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com"
  ).replace(/\/$/, "");
  return `${siteUrl}/discord/connect?token=${encodeURIComponent(token)}`;
}

export async function registerDiscordCommands(guildId: string) {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId) {
    throw new Error("DISCORD_APPLICATION_ID is not configured.");
  }
  const registered = await discordFetch<Array<{ id: string; name: string }>>(
    `/applications/${applicationId}/guilds/${guildId}/commands`,
    {
      method: "PUT",
      body: JSON.stringify(discordApplicationCommands),
    },
  );
  await recordDiscordEvent({
    guildId,
    kind: "COMMANDS_REGISTERED",
    metadata: { commandCount: registered.length },
  });
  return registered;
}

export async function syncDiscordGuild(requestedGuildId?: string) {
  let guildId = requestedGuildId || process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    const [configured] = await getDb()
      .select()
      .from(discordGuilds)
      .orderBy(desc(discordGuilds.updatedAt))
      .limit(1);
    guildId = configured?.id;
  }
  if (!guildId) {
    throw new Error(
      "No Discord server is connected yet. Use /setup in the team server.",
    );
  }

  const guild = await discordFetch<DiscordGuild>(
    `/guilds/${guildId}?with_counts=true`,
  );
  await upsertDiscordGuild({ guildId, name: guild.name });

  const syncedIds: string[] = [];
  let after: string | undefined;
  for (;;) {
    const params = new URLSearchParams({ limit: "1000" });
    if (after) params.set("after", after);
    const page = await discordFetch<DiscordGuildMember[]>(
      `/guilds/${guildId}/members?${params}`,
    );
    for (const member of page) {
      await upsertDiscordMember({
        guildId,
        user: member.user,
        displayName:
          member.nick ||
          member.user.global_name ||
          member.user.username,
        roles: member.roles,
        joinedAt: member.joined_at,
      });
      syncedIds.push(member.user.id);
    }
    if (page.length < 1000) break;
    after = page.at(-1)?.user.id;
    if (!after) break;
  }

  const now = new Date();
  if (syncedIds.length) {
    await getDb()
      .update(discordGuildMembers)
      .set({ leftAt: now, updatedAt: now })
      .where(
        and(
          eq(discordGuildMembers.guildId, guildId),
          isNull(discordGuildMembers.leftAt),
          notInArray(discordGuildMembers.discordUserId, syncedIds),
        ),
      );
  }
  const [counts] = await getDb()
    .select({
      total: sql<number>`count(*) filter (where ${discordGuildMembers.isBot} = false and ${discordGuildMembers.leftAt} is null)::int`,
      linked: sql<number>`count(*) filter (where ${discordGuildMembers.isBot} = false and ${discordGuildMembers.leftAt} is null and ${discordGuildMembers.linkedMemberId} is not null)::int`,
    })
    .from(discordGuildMembers)
    .where(eq(discordGuildMembers.guildId, guildId));
  await getDb()
    .update(discordGuilds)
    .set({
      name: guild.name,
      iconHash: guild.icon || null,
      memberCount: counts?.total ?? 0,
      linkedMemberCount: counts?.linked ?? 0,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(discordGuilds.id, guildId));
  await recordDiscordEvent({
    guildId,
    kind: "SYNC_COMPLETED",
    metadata: counts,
  });
  return {
    guildId,
    guildName: guild.name,
    memberCount: counts?.total ?? 0,
    linkedMemberCount: counts?.linked ?? 0,
  };
}

async function configuredGuild(requestedGuildId?: string) {
  const configuredId = requestedGuildId || process.env.DISCORD_GUILD_ID;
  if (configuredId) {
    const [guild] = await getDb()
      .select()
      .from(discordGuilds)
      .where(eq(discordGuilds.id, configuredId))
      .limit(1);
    if (guild) return guild;
    await upsertDiscordGuild({
      guildId: configuredId,
      name: "210 Robotics Discord",
    });
    const [created] = await getDb()
      .select()
      .from(discordGuilds)
      .where(eq(discordGuilds.id, configuredId))
      .limit(1);
    return created;
  }
  const [guild] = await getDb()
    .select()
    .from(discordGuilds)
    .orderBy(desc(discordGuilds.updatedAt))
    .limit(1);
  return guild;
}

export async function syncDiscordMessages(requestedGuildId?: string) {
  const guild = await configuredGuild(requestedGuildId);
  if (!guild) throw new Error("No Discord server is connected.");
  const [guildChannels, activeThreads] = await Promise.all([
    discordFetch<DiscordChannel[]>(`/guilds/${guild.id}/channels`),
    discordFetch<{ threads: DiscordChannel[] }>(
      `/guilds/${guild.id}/threads/active`,
    ).catch(() => ({ threads: [] })),
  ]);
  const synchronizedChannels = [...guildChannels, ...activeThreads.threads];
  const readableChannels = synchronizedChannels.filter(
    (channel) => [0, 5, 10, 11, 12].includes(channel.type),
  );
  const now = new Date();
  for (const channel of synchronizedChannels) {
    await getDb()
      .insert(discordChannels)
      .values({
        id: channel.id,
        guildId: guild.id,
        name: channel.name || "unknown-channel",
        type: channel.type,
        parentId: channel.parent_id || null,
        position: channel.position ?? 0,
        archived: Boolean(channel.thread_metadata?.archived),
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: discordChannels.id,
        set: {
          name: channel.name || "unknown-channel",
          type: channel.type,
          parentId: channel.parent_id || null,
          position: channel.position ?? 0,
          archived: Boolean(channel.thread_metadata?.archived),
          lastSyncedAt: now,
        },
      });
  }
  const general = readableChannels.find(
    (channel) => channel.name?.toLowerCase() === "general",
  );
  if (!guild.generalChannelId && general) {
    await getDb()
      .update(discordGuilds)
      .set({ generalChannelId: general.id, updatedAt: now })
      .where(eq(discordGuilds.id, guild.id));
  }

  const linkedRows = await getDb()
    .select({
      discordUserId: discordGuildMembers.discordUserId,
      linkedMemberId: discordGuildMembers.linkedMemberId,
    })
    .from(discordGuildMembers)
    .where(eq(discordGuildMembers.guildId, guild.id));
  const memberLinks = new Map(
    linkedRows.map((row) => [row.discordUserId, row.linkedMemberId]),
  );
  let messagesSaved = 0;
  let messagesVerified = 0;
  let verificationFailures = 0;
  let channelsRead = 0;
  const reactionEmoji = guild.messageReactionEnabled
    ? normalizeDiscordReactionEmoji(guild.messageReactionEmoji)
    : null;
  for (const channel of readableChannels) {
    const [latest] = await getDb()
      .select({
        id: discordMessages.id,
        createdAt: discordMessages.discordCreatedAt,
      })
      .from(discordMessages)
      .where(eq(discordMessages.channelId, channel.id))
      .orderBy(desc(discordMessages.discordCreatedAt))
      .limit(1);
    let before: string | undefined;
    const maxPages = latest ? 20 : 5;
    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      const params = new URLSearchParams({ limit: "100" });
      if (before) params.set("before", before);
      let page: DiscordMessage[];
      try {
        page = await discordFetch<DiscordMessage[]>(
          `/channels/${channel.id}/messages?${params}`,
        );
      } catch (error) {
        console.error(
          `Discord message sync skipped #${channel.name || channel.id}`,
          error,
        );
        break;
      }
      if (!page.length) break;
      const newMessages = latest
        ? page.filter((message) => discordMessageIsNewer(message, latest))
        : page;
      const messagesToVerify = page.filter(
        (message) =>
          reactionEmoji &&
          !message.author.bot &&
          !message.reactions?.some(
            (reaction) =>
              reaction.me && reaction.emoji?.name === reactionEmoji,
          ),
      );
      const values = page.map((message) => {
        const createdAt = new Date(message.timestamp);
        return {
          id: message.id,
          guildId: guild.id,
          channelId: channel.id,
          channelName: channel.name || "unknown-channel",
          authorDiscordUserId: message.author.id,
          authorUsername: message.author.username,
          authorDisplayName:
            message.member?.nick ||
            message.author.global_name ||
            message.author.username,
          authorIsBot: Boolean(message.author.bot),
          linkedMemberId: memberLinks.get(message.author.id) || null,
          content: message.content || "",
          attachments: (message.attachments || []).map((attachment) => ({
            id: attachment.id,
            filename: attachment.filename,
            url: attachment.url,
            contentType: attachment.content_type,
            size: attachment.size,
          })),
          discordCreatedAt: createdAt,
          discordEditedAt: message.edited_timestamp
            ? new Date(message.edited_timestamp)
            : null,
          updatedAt: now,
        };
      });
      await getDb()
        .insert(discordMessages)
        .values(values)
        .onConflictDoUpdate({
          target: discordMessages.id,
          set: {
            guildId: sql`excluded.guild_id`,
            channelId: sql`excluded.channel_id`,
            channelName: sql`excluded.channel_name`,
            authorDiscordUserId: sql`excluded.author_discord_user_id`,
            authorUsername: sql`excluded.author_username`,
            authorDisplayName: sql`excluded.author_display_name`,
            authorIsBot: sql`excluded.author_is_bot`,
            linkedMemberId: sql`excluded.linked_member_id`,
            content: sql`excluded.content`,
            attachments: sql`excluded.attachments`,
            discordCreatedAt: sql`excluded.discord_created_at`,
            discordEditedAt: sql`excluded.discord_edited_at`,
            deletedAt: null,
            updatedAt: now,
          },
        });
      messagesSaved += newMessages.length;
      for (const message of messagesToVerify) {
        try {
          await addDiscordMessageReaction(
            channel.id,
            message.id,
            reactionEmoji!,
          );
          messagesVerified += 1;
        } catch (error) {
          verificationFailures += 1;
          console.error(
            `Discord verification reaction failed for ${message.id} in #${channel.name || channel.id}`,
            error,
          );
        }
      }
      const oldest = page.at(-1);
      before = oldest?.id;
      if (
        !before ||
        page.length < 100 ||
        (latest &&
          oldest &&
          new Date(oldest.timestamp).getTime() <= latest.createdAt.getTime())
      ) {
        break;
      }
    }
    channelsRead += 1;
  }
  await recordDiscordEvent({
    guildId: guild.id,
    kind: "MESSAGE_SYNC_COMPLETED",
    metadata: {
      channelsRead,
      messagesSaved,
      messagesVerified,
      verificationFailures,
    },
  });
  const archive = await publishDiscordMessageArchive(guild.id).catch(
    (error: unknown) => {
      console.error("Discord Botlog archive could not be published", error);
      return {
        published: false,
        reason:
          error instanceof Error
            ? error.message
            : "Archive publication failed.",
      };
    },
  );
  return {
    guildId: guild.id,
    channelsRead,
    messagesSaved,
    messagesVerified,
    verificationFailures,
    archive,
  };
}

export async function listDiscordVoiceChannels(guildId: string) {
  if (!/^\d{15,22}$/.test(guildId)) {
    throw new Error("A valid Discord server is required.");
  }
  const channels = await discordFetch<DiscordChannel[]>(
    `/guilds/${guildId}/channels`,
  );
  return channels
    .filter((channel) => [2, 13].includes(channel.type))
    .sort(
      (left, right) =>
        (left.position ?? 0) - (right.position ?? 0) ||
        (left.name || "").localeCompare(right.name || ""),
    )
    .map((channel) => ({
      id: channel.id,
      name: channel.name || "Unnamed voice channel",
      type: channel.type,
    }));
}

export async function publishDiscordMessageArchive(
  requestedGuildId?: string,
) {
  const guild = await configuredGuild(requestedGuildId);
  if (!guild) throw new Error("No Discord server is connected.");
  const channels = await getDb()
    .select()
    .from(discordChannels)
    .where(eq(discordChannels.guildId, guild.id));
  const botlog = channels.find(
    (channel) =>
      ["botlog", "botlogs"].includes(
        channel.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      ) &&
      [0, 5, 10, 11, 12].includes(channel.type),
  );
  if (!botlog) {
    return {
      published: false,
      reason: "No #Botlog channel is synchronized.",
    };
  }
  const messages = await getDb()
    .select({
      id: discordMessages.id,
      channelId: discordMessages.channelId,
      channelName: discordMessages.channelName,
      authorDiscordUserId: discordMessages.authorDiscordUserId,
      authorUsername: discordMessages.authorUsername,
      authorDisplayName: discordMessages.authorDisplayName,
      authorIsBot: discordMessages.authorIsBot,
      linkedMemberId: discordMessages.linkedMemberId,
      content: discordMessages.content,
      attachments: discordMessages.attachments,
      createdAt: discordMessages.discordCreatedAt,
      editedAt: discordMessages.discordEditedAt,
    })
    .from(discordMessages)
    .where(
      and(
        eq(discordMessages.guildId, guild.id),
        isNull(discordMessages.deletedAt),
      ),
    )
    .orderBy(discordMessages.discordCreatedAt);
  const channelCounts = new Map<string, number>();
  for (const message of messages) {
    channelCounts.set(
      message.channelName,
      (channelCounts.get(message.channelName) ?? 0) + 1,
    );
  }
  const generatedAt = new Date();
  const chunkSize = 2_000;
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(messages.length / chunkSize)) },
    (_, index) =>
      messages.slice(index * chunkSize, (index + 1) * chunkSize),
  );
  const postedIds: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const archive = {
      format: "210-robotics-discord-message-archive",
      version: 1,
      generatedAt: generatedAt.toISOString(),
      server: { id: guild.id, name: guild.name },
      summary: {
        totalMessages: messages.length,
        channelCount: channelCounts.size,
        firstMessageAt: messages.at(0)?.createdAt.toISOString() ?? null,
        lastMessageAt: messages.at(-1)?.createdAt.toISOString() ?? null,
        messagesByChannel: Object.fromEntries(
          [...channelCounts.entries()].sort((a, b) => b[1] - a[1]),
        ),
        part: index + 1,
        parts: chunks.length,
      },
      messages: chunk,
    };
    const date = generatedAt.toISOString().slice(0, 10);
    const partSuffix =
      chunks.length > 1 ? `-part-${index + 1}-of-${chunks.length}` : "";
    const filename = `210-robotics-discord-messages-${date}${partSuffix}.json`;
    const formData = new FormData();
    formData.append(
      "payload_json",
      JSON.stringify({
        content:
          `**Discord archive updated**\n` +
          `${messages.length.toLocaleString()} logged messages across ` +
          `${channelCounts.size.toLocaleString()} channels · ` +
          `part ${index + 1} of ${chunks.length}`,
        allowed_mentions: { parse: [] },
      }),
    );
    formData.append(
      "files[0]",
      new Blob([JSON.stringify(archive, null, 2)], {
        type: "application/json",
      }),
      filename,
    );
    const posted = await discordFetch<{ id: string }>(
      `/channels/${botlog.id}/messages`,
      { method: "POST", body: formData },
    );
    postedIds.push(posted.id);
  }
  await recordDiscordEvent({
    guildId: guild.id,
    kind: "MESSAGE_ARCHIVE_PUBLISHED",
    metadata: {
      channelId: botlog.id,
      messageCount: messages.length,
      parts: chunks.length,
      postedIds,
    },
  });
  return {
    published: true,
    channelId: botlog.id,
    messageCount: messages.length,
    parts: chunks.length,
  };
}

export async function publishDiscordMeetingTranscript({
  guildId,
  title,
  transcript,
  recordingDocumentId,
  transcriptDocxDocumentId,
  transcriptMarkdownDocumentId,
}: {
  guildId?: string;
  title: string;
  transcript: string;
  recordingDocumentId?: string;
  transcriptDocxDocumentId?: string;
  transcriptMarkdownDocumentId?: string;
}) {
  const guild = await configuredGuild(guildId);
  if (!guild) throw new Error("No Discord server is connected.");
  const channels = await getDb()
    .select()
    .from(discordChannels)
    .where(eq(discordChannels.guildId, guild.id));
  const botlog = channels.find(
    (channel) =>
      ["botlog", "botlogs"].includes(
        channel.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      ) &&
      [0, 5, 10, 11, 12].includes(channel.type),
  );
  if (!botlog)
    return {
      published: false,
      reason: "No #Botlog channel is synchronized.",
    };
  const safeTitle = title.replace(/[^\w .()-]/g, "").trim() || "Meeting";
  const filename = `${safeTitle.slice(0, 80).replace(/\s+/g, "-")}-transcript.md`;
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com"
  ).replace(/\/$/, "");
  const documentLinks = [
    recordingDocumentId
      ? `[Open audio recording](${siteUrl}/api/internal-documents/${recordingDocumentId}/file)`
      : "",
    transcriptDocxDocumentId
      ? `[Download Word transcript](${siteUrl}/api/internal-documents/${transcriptDocxDocumentId}/file)`
      : "",
    transcriptMarkdownDocumentId
      ? `[Download Markdown transcript](${siteUrl}/api/internal-documents/${transcriptMarkdownDocumentId}/file)`
      : "",
  ].filter(Boolean);
  const formData = new FormData();
  formData.append(
    "payload_json",
    JSON.stringify({
      content:
        `**Meeting transcript archived: ${safeTitle}**\n` +
        "The consent-confirmed recording and speaker-attributed Word and Markdown transcripts are stored in Internal Documents." +
        (documentLinks.length ? `\n${documentLinks.join(" · ")}` : ""),
      allowed_mentions: { parse: [] },
    }),
  );
  formData.append(
    "files[0]",
    new Blob([`# ${safeTitle}\n\n${transcript}`], {
      type: "text/markdown",
    }),
    filename,
  );
  const posted = await discordFetch<{ id: string }>(
    `/channels/${botlog.id}/messages`,
    { method: "POST", body: formData },
  );
  await recordDiscordEvent({
    guildId: guild.id,
    kind: "MEETING_TRANSCRIPT_PUBLISHED",
    metadata: {
      channelId: botlog.id,
      messageId: posted.id,
      title: safeTitle,
      transcriptLength: transcript.length,
    },
  });
  return {
    published: true,
    channelId: botlog.id,
    messageId: posted.id,
  };
}

export async function sendDiscordCalendarReminders(
  requestedGuildId?: string,
) {
  const guild = await configuredGuild(requestedGuildId);
  if (
    !guild ||
    !guild.calendarAnnouncementsEnabled ||
    !guild.generalChannelId
  ) {
    return { sent: 0, skipped: true };
  }
  const calendar = await refreshCalendarEvents();
  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + guild.calendarReminderHours * 60 * 60 * 1000,
  );
  const upcoming = calendar.events.filter((event) => {
    const start = new Date(event.start);
    return (
      !Number.isNaN(start.getTime()) &&
      start.getTime() >= now.getTime() - 5 * 60 * 1000 &&
      start <= windowEnd
    );
  });
  let sent = 0;
  let alreadySent = 0;
  for (const event of upcoming) {
    const startsAt = new Date(event.start);
    const [claim] = await getDb()
      .insert(discordCalendarReminders)
      .values({
        guildId: guild.id,
        calendarEventId: event.id,
        eventTitle: event.title,
        startsAt,
        reminderWindowHours: guild.calendarReminderHours,
        channelId: guild.generalChannelId,
      })
      .onConflictDoNothing()
      .returning();
    if (!claim) {
      alreadySent += 1;
      continue;
    }
    try {
      const timestamp = Math.floor(startsAt.getTime() / 1000);
      const location = event.location ? `\n📍 ${event.location}` : "";
      const message = await discordFetch<{ id: string }>(
        `/channels/${guild.generalChannelId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content:
              `@everyone\n📅 **Upcoming: ${event.title}**\n` +
              `<t:${timestamp}:F> · <t:${timestamp}:R>${location}\n` +
              `${event.googleUrl}`,
            allowed_mentions: { parse: ["everyone"] },
          }),
        },
      );
      await getDb()
        .update(discordCalendarReminders)
        .set({ discordMessageId: message.id })
        .where(eq(discordCalendarReminders.id, claim.id));
      sent += 1;
    } catch (error) {
      await getDb()
        .delete(discordCalendarReminders)
        .where(eq(discordCalendarReminders.id, claim.id));
      throw error;
    }
  }
  if (sent) {
    await recordDiscordEvent({
      guildId: guild.id,
      kind: "CALENDAR_REMINDERS_SENT",
      metadata: { sent, reminderHours: guild.calendarReminderHours },
    });
  }
  return {
    sent,
    alreadySent,
    eligibleEvents: upcoming.length,
    calendarEvents: calendar.count,
    reminderHours: guild.calendarReminderHours,
    channelId: guild.generalChannelId,
    skipped: false,
  };
}

function centralDateParts(value: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day", number>;
}

function nextMonthDetails(now: Date) {
  const current = centralDateParts(now);
  const month = current.month === 12 ? 1 : current.month + 1;
  const year = current.month === 12 ? current.year + 1 : current.year;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return { ...current, targetYear: year, targetMonth: month, key, label };
}

export async function sendDiscordMonthlyCalendarDigest(
  requestedGuildId?: string,
  options: { force?: boolean } = {},
) {
  const guild = await configuredGuild(requestedGuildId);
  if (
    !guild ||
    !guild.calendarAnnouncementsEnabled ||
    !guild.generalChannelId
  ) {
    return {
      sent: 0,
      skipped: true,
      reason: "Calendar announcements are not configured.",
    };
  }
  const now = new Date();
  const month = nextMonthDetails(now);
  if (!options.force && month.day < 25) {
    return {
      sent: 0,
      skipped: true,
      reason: "The automatic digest sends on or after the 25th.",
      month: month.key,
    };
  }
  const eventKind = `CALENDAR_MONTHLY_DIGEST:${month.key}`;
  const [existing] = await getDb()
    .select({ id: discordEvents.id })
    .from(discordEvents)
    .where(
      and(
        eq(discordEvents.guildId, guild.id),
        eq(discordEvents.kind, eventKind),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      sent: 0,
      skipped: true,
      reason: `${month.label} was already announced.`,
      month: month.key,
    };
  }
  const calendar = await refreshCalendarEvents();
  const monthEvents = calendar.events
    .filter((event) => {
      const start = new Date(event.start);
      if (Number.isNaN(start.getTime())) return false;
      const parts = centralDateParts(start);
      return (
        parts.year === month.targetYear && parts.month === month.targetMonth
      );
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  const lines = monthEvents.map((event) => {
    const timestamp = Math.floor(new Date(event.start).getTime() / 1000);
    const location = event.location
      ? ` · 📍 ${event.location.replace(/\s+/g, " ").trim().slice(0, 120)}`
      : "";
    return `• <t:${timestamp}:${event.allDay ? "D" : "f"}> — **${event.title.slice(0, 180)}**${location}`;
  });
  if (!lines.length) {
    lines.push(
      "No events are currently listed. The shared calendar remains the source of truth and this digest will update next month.",
    );
  }
  const header =
    `@everyone\n📆 **210 Robotics · ${month.label} calendar**\n` +
    `${monthEvents.length} upcoming event${monthEvents.length === 1 ? "" : "s"} from the shared Google Calendar.\n`;
  const footer = `\n${calendar.events[0]?.googleUrl ?? "https://calendar.google.com/"}`;
  const chunks: string[] = [];
  let current = header;
  for (const line of lines) {
    if (`${current}\n${line}${footer}`.length > 1_950) {
      chunks.push(`${current}${footer}`);
      current = `📆 **${month.label} calendar · continued**\n${line}`;
    } else {
      current += `\n${line}`;
    }
  }
  chunks.push(`${current}${footer}`);
  const messageIds: string[] = [];
  for (const [index, content] of chunks.entries()) {
    const message = await discordFetch<{ id: string }>(
      `/channels/${guild.generalChannelId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content,
          allowed_mentions: { parse: index === 0 ? ["everyone"] : [] },
        }),
      },
    );
    messageIds.push(message.id);
  }
  await recordDiscordEvent({
    guildId: guild.id,
    kind: eventKind,
    metadata: {
      month: month.key,
      eventCount: monthEvents.length,
      channelId: guild.generalChannelId,
      messageIds,
    },
  });
  return {
    sent: messageIds.length,
    skipped: false,
    month: month.key,
    eventCount: monthEvents.length,
    channelId: guild.generalChannelId,
  };
}

export async function sendDiscordChannelMessage({
  guildId,
  channelId,
  channelName,
  content,
  allowedUserIds,
  allowEveryone = false,
}: {
  guildId: string;
  channelId: string;
  channelName: string;
  content: string;
  allowedUserIds: string[];
  allowEveryone?: boolean;
}) {
  const message = await discordFetch<DiscordMessage>(
    `/channels/${channelId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        allowed_mentions: {
          parse: allowEveryone ? ["everyone"] : [],
          users: allowedUserIds,
          roles: [],
          replied_user: false,
        },
      }),
    },
  );
  const now = new Date();
  await getDb()
    .insert(discordMessages)
    .values({
      id: message.id,
      guildId,
      channelId,
      channelName,
      authorDiscordUserId: message.author.id,
      authorUsername: message.author.username,
      authorDisplayName:
        message.author.global_name || message.author.username,
      authorIsBot: true,
      content: message.content,
      attachments: [],
      discordCreatedAt: new Date(message.timestamp),
      discordEditedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: discordMessages.id,
      set: {
        content: message.content,
        updatedAt: now,
      },
    });
  let verified = false;
  const [guildSettings] = await getDb()
    .select({
      enabled: discordGuilds.messageReactionEnabled,
      emoji: discordGuilds.messageReactionEmoji,
    })
    .from(discordGuilds)
    .where(eq(discordGuilds.id, guildId))
    .limit(1);
  if (guildSettings?.enabled) {
    try {
      await addDiscordMessageReaction(
        channelId,
        message.id,
        normalizeDiscordReactionEmoji(guildSettings.emoji),
      );
      verified = true;
    } catch (error) {
      console.error(
        `Discord automatic reaction failed for sent message ${message.id}`,
        error,
      );
    }
  }
  await recordDiscordEvent({
    guildId,
    discordUserId: message.author.id,
    kind: "ADMIN_MESSAGE_SENT",
    metadata: {
      channelId,
      channelName,
      messageId: message.id,
      mentionedUsers: allowedUserIds.length,
      mentionedEveryone: allowEveryone,
      verified,
    },
  });
  return { id: message.id, timestamp: message.timestamp, verified };
}

export async function sendDiscordDirectMessage({
  discordUserId,
  content,
  log,
}: {
  discordUserId: string;
  content: string;
  log?: {
    username?: string;
    displayName?: string;
    aiGenerated?: boolean;
    replyToMessageId?: string | null;
    metadata?: Record<string, unknown>;
  };
}) {
  const message = content.trim().slice(0, 2_000);
  if (!/^\d{15,22}$/.test(discordUserId)) {
    throw new Error("A valid Discord user ID is required.");
  }
  if (!message) throw new Error("A direct message cannot be empty.");
  const channel = await discordFetch<{ id: string }>("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  const sent = await discordFetch<{ id: string; timestamp: string }>(
    `/channels/${channel.id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: message,
        allowed_mentions: { parse: [] },
      }),
    },
  );
  const [knownMember] = await getDb()
    .select({
      username: discordGuildMembers.username,
      displayName: discordGuildMembers.displayName,
    })
    .from(discordGuildMembers)
    .where(eq(discordGuildMembers.discordUserId, discordUserId))
    .limit(1);
  await getDb()
    .insert(discordDirectMessages)
    .values({
      id: sent.id,
      channelId: channel.id,
      discordUserId,
      username: log?.username || knownMember?.username || discordUserId,
      displayName:
        log?.displayName || knownMember?.displayName || knownMember?.username || discordUserId,
      direction: "OUTBOUND",
      content: message,
      aiGenerated: Boolean(log?.aiGenerated),
      replyToMessageId: log?.replyToMessageId || null,
      metadata: log?.metadata || {},
      discordCreatedAt: new Date(sent.timestamp),
    })
    .onConflictDoNothing();
  return sent;
}

export async function sendDiscordDirectMessageWithFile({
  discordUserId,
  content,
  filename,
  file,
  contentType = "text/markdown",
}: {
  discordUserId: string;
  content: string;
  filename: string;
  file: Buffer;
  contentType?: string;
}) {
  const message = content.trim().slice(0, 2_000);
  const safeFilename =
    filename
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 180) || "210-robotics-debrief.md";
  if (!/^\d{15,22}$/.test(discordUserId)) {
    throw new Error("A valid Discord user ID is required.");
  }
  if (!message) throw new Error("A direct message cannot be empty.");
  if (!file.byteLength) throw new Error("The debrief file is empty.");
  if (file.byteLength > 8 * 1024 * 1024) {
    throw new Error("The generated debrief is larger than Discord's upload limit.");
  }
  const channel = await discordFetch<{ id: string }>("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  const formData = new FormData();
  formData.set(
    "payload_json",
    JSON.stringify({
      content: message,
      allowed_mentions: { parse: [] },
      attachments: [{ id: 0, filename: safeFilename }],
    }),
  );
  formData.set(
    "files[0]",
    new Blob([new Uint8Array(file)], { type: contentType }),
    safeFilename,
  );
  const sent = await discordFetch<{ id: string; timestamp: string }>(
    `/channels/${channel.id}/messages`,
    {
      method: "POST",
      body: formData,
    },
  );
  const [knownMember] = await getDb()
    .select({
      username: discordGuildMembers.username,
      displayName: discordGuildMembers.displayName,
    })
    .from(discordGuildMembers)
    .where(eq(discordGuildMembers.discordUserId, discordUserId))
    .limit(1);
  await getDb()
    .insert(discordDirectMessages)
    .values({
      id: sent.id,
      channelId: channel.id,
      discordUserId,
      username: knownMember?.username || discordUserId,
      displayName:
        knownMember?.displayName || knownMember?.username || discordUserId,
      direction: "OUTBOUND",
      content: message,
      aiGenerated: false,
      metadata: {
        attachmentFilename: safeFilename,
        attachmentContentType: contentType,
        attachmentBytes: file.byteLength,
      },
      discordCreatedAt: new Date(sent.timestamp),
    })
    .onConflictDoNothing();
  return sent;
}

export async function assignDiscordOnboardingRoles({
  guildId,
  discordUserId,
}: {
  guildId: string;
  discordUserId: string;
}) {
  const [[guild], [member]] = await Promise.all([
    getDb()
      .select()
      .from(discordGuilds)
      .where(eq(discordGuilds.id, guildId))
      .limit(1),
    getDb()
      .select()
      .from(discordGuildMembers)
      .where(
        and(
          eq(discordGuildMembers.guildId, guildId),
          eq(discordGuildMembers.discordUserId, discordUserId),
        ),
      )
      .limit(1),
  ]);
  if (!guild || !member || member.leftAt || member.isBot) {
    throw new Error("The Discord member is not active in the connected server.");
  }
  if (!member.linkedMemberId) {
    throw new Error("The Discord account must be linked before roles are assigned.");
  }
  try {
    const roles = await listDiscordGuildRoles(guildId);
    const selected = inferDiscordOnboardingRoleIds(roles, {
      agreedRoleId: guild.agreedRoleId,
      vexUMemberRoleId: guild.vexUMemberRoleId,
    });
    if (!selected.agreedRoleId || !selected.vexUMemberRoleId) {
      throw new Error(
        "Choose the Agreed and VEX U Member roles in Discord onboarding settings.",
      );
    }
    const roleIds = [
      ...new Set([selected.agreedRoleId, selected.vexUMemberRoleId]),
    ];
    await Promise.all(
      roleIds.map((roleId) =>
        discordFetch(
          `/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
          {
            method: "PUT",
            headers: {
              "X-Audit-Log-Reason": encodeURIComponent(
                "210 Robotics portal account linked",
              ),
            },
          },
        ),
      ),
    );
    const now = new Date();
    await Promise.all([
      getDb()
        .update(discordGuildMembers)
        .set({
          roles: [...new Set([...member.roles, ...roleIds])],
          onboardingRolesAssignedAt: now,
          onboardingRoleError: null,
          updatedAt: now,
        })
        .where(eq(discordGuildMembers.id, member.id)),
      getDb()
        .update(discordGuilds)
        .set({
          agreedRoleId: selected.agreedRoleId,
          vexUMemberRoleId: selected.vexUMemberRoleId,
          updatedAt: now,
        })
        .where(eq(discordGuilds.id, guildId)),
    ]);
    await recordDiscordEvent({
      guildId,
      discordUserId,
      kind: "ONBOARDING_ROLES_ASSIGNED",
      metadata: { roleIds },
    });
    return {
      assigned: true as const,
      roleIds,
      roleNames: roles
        .filter((role) => roleIds.includes(role.id))
        .map((role) => role.name),
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 500) : "Role assignment failed.";
    await getDb()
      .update(discordGuildMembers)
      .set({ onboardingRoleError: detail, updatedAt: new Date() })
      .where(eq(discordGuildMembers.id, member.id));
    await recordDiscordEvent({
      guildId,
      discordUserId,
      kind: "ONBOARDING_ROLE_ASSIGNMENT_FAILED",
      metadata: { error: detail },
    });
    throw error;
  }
}

export async function handleDiscordMemberJoined({
  guildId,
  guildName,
  user,
  displayName,
  roles = [],
  joinedAt,
}: {
  guildId: string;
  guildName: string;
  user: DiscordUser;
  displayName?: string;
  roles?: string[];
  joinedAt?: string | null;
}) {
  await upsertDiscordGuild({ guildId, name: guildName });
  const member = await upsertDiscordMember({
    guildId,
    user,
    displayName,
    roles,
    joinedAt,
  });
  if (member.isBot) return { sent: false, reason: "bot" };
  const [guild] = await getDb()
    .select()
    .from(discordGuilds)
    .where(eq(discordGuilds.id, guildId))
    .limit(1);
  if (!guild?.onboardingEnabled) {
    return { sent: false, reason: "onboarding-disabled" };
  }
  const now = new Date();
  const delayMinutes = Math.max(
    1,
    Math.min(60, guild.securityDelayMinutes || 10),
  );
  const securityDelayEndsAt = new Date(
    now.getTime() + delayMinutes * 60 * 1_000,
  );
  await getDb()
    .update(discordGuildMembers)
    .set({
      onboardingDmSentAt: null,
      securityDelayEndsAt,
      securityDelayNotificationSentAt: null,
      onboardingRolesAssignedAt: null,
      onboardingRoleError: null,
      updatedAt: now,
    })
    .where(eq(discordGuildMembers.id, member.id));
  const registrationUrl = await createDiscordLinkToken({
    guildId,
    discordUserId: member.discordUserId,
    username: member.username,
  });
  await sendDiscordDirectMessage({
    discordUserId: member.discordUserId,
    content:
      `Welcome to 210 Robotics, ${member.displayName}!\n\n` +
      `Discord's ${delayMinutes}-minute security delay is now running. While you wait, sign in or sign up for the 210 Robotics Portal and link this Discord account:\n${registrationUrl}\n\n` +
      `After ${delayMinutes} minutes, I will notify you that the delay has passed. Once your account is linked, I will automatically add the Agreed and VEX U Member roles to unlock the server.\n\n` +
      `This private link expires in 7 days.`,
    log: {
      username: member.username,
      displayName: member.displayName,
      metadata: {
        kind: "join-onboarding",
        securityDelayEndsAt: securityDelayEndsAt.toISOString(),
      },
    },
  });
  await getDb()
    .update(discordGuildMembers)
    .set({
      onboardingDmSentAt: now,
      registrationReminderSentAt: now,
      registrationReminderCount:
        sql`${discordGuildMembers.registrationReminderCount} + 1`,
      updatedAt: now,
    })
    .where(eq(discordGuildMembers.id, member.id));
  await recordDiscordEvent({
    guildId,
    discordUserId: member.discordUserId,
    kind: "JOIN_ONBOARDING_DM_SENT",
    metadata: {
      securityDelayEndsAt: securityDelayEndsAt.toISOString(),
      delayMinutes,
    },
  });
  return { sent: true, securityDelayEndsAt, registrationUrl };
}

export async function processDiscordOnboarding({
  guildId,
  limit = 50,
}: {
  guildId?: string;
  limit?: number;
} = {}) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const now = new Date();
  const dueMembers = await getDb()
    .select()
    .from(discordGuildMembers)
    .where(
      and(
        guildId ? eq(discordGuildMembers.guildId, guildId) : undefined,
        eq(discordGuildMembers.isBot, false),
        isNull(discordGuildMembers.leftAt),
        isNotNull(discordGuildMembers.securityDelayEndsAt),
        lte(discordGuildMembers.securityDelayEndsAt, now),
        isNull(discordGuildMembers.securityDelayNotificationSentAt),
      ),
    )
    .orderBy(discordGuildMembers.securityDelayEndsAt)
    .limit(safeLimit);
  let notified = 0;
  let rolesAssigned = 0;
  const failures: Array<{ id: string; reason: string }> = [];
  for (const member of dueMembers) {
    try {
      let roleResult:
        | Awaited<ReturnType<typeof assignDiscordOnboardingRoles>>
        | null = null;
      let roleError = "";
      if (member.linkedMemberId && !member.onboardingRolesAssignedAt) {
        try {
          roleResult = await assignDiscordOnboardingRoles({
            guildId: member.guildId,
            discordUserId: member.discordUserId,
          });
          rolesAssigned += 1;
        } catch (error) {
          roleError =
            error instanceof Error
              ? error.message
              : "Automatic role assignment needs officer review.";
        }
      }
      const registrationUrl = member.linkedMemberId
        ? null
        : await createDiscordLinkToken({
            guildId: member.guildId,
            discordUserId: member.discordUserId,
            username: member.username,
          });
      const content = member.linkedMemberId
        ? roleError
          ? `Hi ${member.displayName}! Your security delay has passed and your portal account is linked. Automatic role assignment needs officer review, so an officer can finish unlocking the server from the Discord admin page.`
          : `Hi ${member.displayName}! Your security delay has passed. Your portal account is linked and the ${roleResult?.roleNames.join(" and ") || "Agreed and VEX U Member"} roles are ready, so the team server should now be unlocked.`
        : `Hi ${member.displayName}! Your security delay has passed. Link your Discord account to the 210 Robotics Portal and I will automatically add the Agreed and VEX U Member roles to unlock the server:\n${registrationUrl}\n\nThis private link expires in 7 days.`;
      await sendDiscordDirectMessage({
        discordUserId: member.discordUserId,
        content,
        log: {
          username: member.username,
          displayName: member.displayName,
          metadata: {
            kind: "security-delay-complete",
            rolesAssigned: Boolean(roleResult),
          },
        },
      });
      await getDb()
        .update(discordGuildMembers)
        .set({
          securityDelayNotificationSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(discordGuildMembers.id, member.id));
      await recordDiscordEvent({
        guildId: member.guildId,
        discordUserId: member.discordUserId,
        kind: "SECURITY_DELAY_COMPLETE_DM_SENT",
        metadata: {
          linked: Boolean(member.linkedMemberId),
          rolesAssigned: Boolean(roleResult),
          roleError,
        },
      });
      notified += 1;
    } catch (error) {
      failures.push({
        id: member.id,
        reason:
          error instanceof Error ? error.message : "Discord onboarding failed.",
      });
    }
  }
  return {
    due: dueMembers.length,
    notified,
    rolesAssigned,
    failed: failures.length,
    failures,
  };
}

export async function completeDiscordLinkedOnboarding({
  guildMemberId,
}: {
  guildMemberId: string;
}) {
  const [member] = await getDb()
    .select()
    .from(discordGuildMembers)
    .where(eq(discordGuildMembers.id, guildMemberId))
    .limit(1);
  if (!member?.linkedMemberId || member.leftAt || member.isBot) {
    return { assigned: false, reason: "not-eligible" };
  }
  if (
    member.securityDelayEndsAt &&
    member.securityDelayEndsAt.getTime() > Date.now()
  ) {
    return {
      assigned: false,
      reason: "security-delay",
      securityDelayEndsAt: member.securityDelayEndsAt,
    };
  }
  try {
    const result = await assignDiscordOnboardingRoles({
      guildId: member.guildId,
      discordUserId: member.discordUserId,
    });
    await sendDiscordDirectMessage({
      discordUserId: member.discordUserId,
      content:
        `Your 210 Robotics Portal account is linked and the ${result.roleNames.join(" and ")} roles were added automatically. The team server should now be unlocked.`,
      log: {
        username: member.username,
        displayName: member.displayName,
        metadata: { kind: "linked-roles-assigned" },
      },
    });
    return { assigned: true, roleNames: result.roleNames };
  } catch (error) {
    return {
      assigned: false,
      reason:
        error instanceof Error
          ? error.message
          : "Automatic role assignment needs officer review.",
    };
  }
}

export async function setDiscordGuildMemberTimeout({
  guildId,
  discordUserId,
  durationMinutes,
  reason,
}: {
  guildId: string;
  discordUserId: string;
  durationMinutes: number;
  reason?: string;
}) {
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(discordUserId))
    throw new Error("A valid Discord server and member are required.");
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 0 ||
    durationMinutes > 28 * 24 * 60
  )
    throw new Error("Discord timeouts must be between 1 minute and 28 days.");
  const until =
    durationMinutes === 0
      ? null
      : new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  await discordFetch(
    `/guilds/${guildId}/members/${discordUserId}`,
    {
      method: "PATCH",
      headers: reason
        ? {
            "X-Audit-Log-Reason": encodeURIComponent(
              reason.trim().slice(0, 400),
            ),
          }
        : undefined,
      body: JSON.stringify({
        communication_disabled_until: until,
      }),
    },
  );
  await recordDiscordEvent({
    guildId,
    discordUserId,
    kind: durationMinutes === 0 ? "MEMBER_TIMEOUT_CLEARED" : "MEMBER_TIMED_OUT",
    metadata: {
      durationMinutes,
      until,
      reason: reason?.trim().slice(0, 400) || "",
    },
  });
  return { until, durationMinutes };
}

export async function setDiscordChannelSlowmode({
  guildId,
  channelId,
  seconds,
  reason,
}: {
  guildId: string;
  channelId: string;
  seconds: number;
  reason?: string;
}) {
  if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId)) {
    throw new Error("A valid Discord server and text channel are required.");
  }
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600) {
    throw new Error("Discord slowmode must be between 0 seconds and 6 hours.");
  }
  const channel = await discordFetch<DiscordChannel>(
    `/channels/${channelId}`,
    {
      method: "PATCH",
      headers: reason
        ? {
            "X-Audit-Log-Reason": encodeURIComponent(
              reason.trim().slice(0, 400),
            ),
          }
        : undefined,
      body: JSON.stringify({ rate_limit_per_user: seconds }),
    },
  );
  if (channel.guild_id && channel.guild_id !== guildId) {
    throw new Error("The selected channel does not belong to this server.");
  }
  await recordDiscordEvent({
    guildId,
    kind: "CHANNEL_SLOWMODE_UPDATED",
    metadata: {
      channelId,
      seconds,
      reason: reason?.trim().slice(0, 400) || "",
    },
  });
  return { channelId, seconds };
}

export async function notifyDiscordAdmin({
  title,
  body,
  path = "/admin",
}: {
  title: string;
  body: string;
  path?: string;
}) {
  const discordUserId = process.env.DISCORD_ADMIN_USER_ID;
  if (!discordUserId) return { sent: false, reason: "Recipient not configured" };
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://210robotics.com"
  ).replace(/\/$/, "");
  const content =
    `🔔 **${title.trim().slice(0, 160)}**\n` +
    `${body.trim().slice(0, 1_500)}\n\n` +
    `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const message = await sendDiscordDirectMessage({
    discordUserId,
    content,
  });
  await recordDiscordEvent({
    guildId: process.env.DISCORD_GUILD_ID,
    discordUserId,
    kind: "ADMIN_NOTIFICATION_SENT",
    metadata: { title, path, messageId: message.id },
  });
  return { sent: true, messageId: message.id };
}

export async function sendDiscordRegistrationReminder({
  guildMemberId,
  ignoreCooldown = false,
}: {
  guildMemberId: string;
  ignoreCooldown?: boolean;
}) {
  const [member] = await getDb()
    .select()
    .from(discordGuildMembers)
    .where(eq(discordGuildMembers.id, guildMemberId))
    .limit(1);
  if (!member || member.isBot || member.leftAt || member.linkedMemberId) {
    throw new Error("This Discord member does not need a registration link.");
  }
  if (member.remindersOptedOut) {
    throw new Error("This Discord member opted out of registration reminders.");
  }
  const cooldown = 14 * 24 * 60 * 60 * 1000;
  if (
    !ignoreCooldown &&
    member.registrationReminderSentAt &&
    Date.now() - member.registrationReminderSentAt.getTime() < cooldown
  ) {
    throw new Error("A registration reminder was sent within the last 14 days.");
  }
  const registrationUrl = await createDiscordLinkToken({
    guildId: member.guildId,
    discordUserId: member.discordUserId,
    username: member.username,
  });
  const channel = await discordFetch<{ id: string }>("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: member.discordUserId }),
  });
  await discordFetch(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content:
        `Hi ${member.displayName}! Please link your Discord account and sign in or sign up for the 210 Robotics Portal so team tools can recognize you.\n\n` +
        `${registrationUrl}\n\nThis private link expires in 7 days.`,
      allowed_mentions: { parse: [] },
    }),
  });
  const now = new Date();
  await getDb()
    .update(discordGuildMembers)
    .set({
      registrationReminderSentAt: now,
      registrationReminderCount: sql`${discordGuildMembers.registrationReminderCount} + 1`,
      updatedAt: now,
    })
    .where(eq(discordGuildMembers.id, member.id));
  await recordDiscordEvent({
    guildId: member.guildId,
    discordUserId: member.discordUserId,
    kind: "REGISTRATION_DM_SENT",
  });
  return registrationUrl;
}

export async function sendDiscordRegistrationReminders({
  guildId,
  limit = 25,
}: {
  guildId: string;
  limit?: number;
}) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const cooldownCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const eligible = await getDb()
    .select({ id: discordGuildMembers.id })
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, guildId),
        eq(discordGuildMembers.isBot, false),
        eq(discordGuildMembers.remindersOptedOut, false),
        isNull(discordGuildMembers.leftAt),
        isNull(discordGuildMembers.linkedMemberId),
        or(
          isNull(discordGuildMembers.registrationReminderSentAt),
          lt(
            discordGuildMembers.registrationReminderSentAt,
            cooldownCutoff,
          ),
        ),
      ),
    )
    .orderBy(discordGuildMembers.createdAt)
    .limit(safeLimit);
  let sent = 0;
  const failures: Array<{ id: string; reason: string }> = [];
  for (const member of eligible) {
    try {
      await sendDiscordRegistrationReminder({ guildMemberId: member.id });
      sent += 1;
    } catch (error) {
      failures.push({
        id: member.id,
        reason:
          error instanceof Error ? error.message : "Discord DM failed.",
      });
    }
  }
  await recordDiscordEvent({
    guildId,
    kind: "REGISTRATION_DM_BATCH_COMPLETED",
    metadata: {
      eligible: eligible.length,
      sent,
      failed: failures.length,
      failures,
    },
  });
  return {
    eligible: eligible.length,
    sent,
    failed: failures.length,
    failures,
  };
}

export async function sendDiscordMemberBroadcast({
  guildId,
  content,
}: {
  guildId: string;
  content: string;
}) {
  const message = content.trim().slice(0, 1_800);
  if (!message) throw new Error("Enter a reminder message.");
  const recipients = await getDb()
    .select({
      id: discordGuildMembers.id,
      discordUserId: discordGuildMembers.discordUserId,
      displayName: discordGuildMembers.displayName,
    })
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, guildId),
        eq(discordGuildMembers.isBot, false),
        isNull(discordGuildMembers.leftAt),
      ),
    )
    .orderBy(discordGuildMembers.displayName)
    .limit(1_000);
  let sent = 0;
  const failures: Array<{ id: string; reason: string }> = [];
  for (const recipient of recipients) {
    try {
      await sendDiscordDirectMessage({
        discordUserId: recipient.discordUserId,
        content: `Hi ${recipient.displayName}! ${message}`,
      });
      sent += 1;
    } catch (error) {
      failures.push({
        id: recipient.id,
        reason: error instanceof Error ? error.message : "Discord DM failed.",
      });
    }
  }
  await recordDiscordEvent({
    guildId,
    kind: "MEMBER_DM_BROADCAST_COMPLETED",
    metadata: {
      recipients: recipients.length,
      sent,
      failed: failures.length,
      failures,
    },
  });
  return {
    recipients: recipients.length,
    sent,
    failed: failures.length,
    failures,
  };
}

export async function sendDiscordSelectedMemberMessages({
  guildId,
  guildMemberIds,
  content,
}: {
  guildId: string;
  guildMemberIds: string[];
  content: string;
}) {
  const message = content.trim().slice(0, 1_800);
  const recipientIds = [...new Set(guildMemberIds)].slice(0, 100);
  if (!message) throw new Error("Enter a private message.");
  if (!recipientIds.length) throw new Error("Select at least one member.");
  const recipients = await getDb()
    .select({
      id: discordGuildMembers.id,
      discordUserId: discordGuildMembers.discordUserId,
      displayName: discordGuildMembers.displayName,
    })
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.guildId, guildId),
        eq(discordGuildMembers.isBot, false),
        isNull(discordGuildMembers.leftAt),
        inArray(discordGuildMembers.id, recipientIds),
      ),
    )
    .orderBy(discordGuildMembers.displayName);
  let sent = 0;
  const failures: Array<{ id: string; reason: string }> = [];
  for (const recipient of recipients) {
    try {
      await sendDiscordDirectMessage({
        discordUserId: recipient.discordUserId,
        content: `Hi ${recipient.displayName}! ${message}`,
      });
      sent += 1;
    } catch (error) {
      failures.push({
        id: recipient.id,
        reason: error instanceof Error ? error.message : "Discord DM failed.",
      });
    }
  }
  await recordDiscordEvent({
    guildId,
    kind: "MEMBER_DM_SELECTION_COMPLETED",
    metadata: {
      requested: recipientIds.length,
      recipients: recipients.length,
      sent,
      failed: failures.length,
      failures,
    },
  });
  return {
    recipients: recipients.length,
    sent,
    failed: failures.length,
    failures,
  };
}

export type { DiscordUser };
export { discordTokenHash, verifyDiscordSignature };
