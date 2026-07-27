import "server-only";

import { eq, and } from "drizzle-orm";
import WebSocket from "ws";
import { getDb } from "@/db";
import {
  discordChannels,
  discordGuildMembers,
  discordMessages,
} from "@/db/schema";

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_GATEWAY =
  "wss://gateway.discord.gg/?v=10&encoding=json";
const VERIFIED_EMOJI = encodeURIComponent("\u2705");
const GATEWAY_INTENTS = 1 | 2 | 128 | 512 | 32_768;

type GatewayPayload = {
  op: number;
  d: unknown;
  s?: number | null;
  t?: string | null;
};

type GatewayMessage = {
  id: string;
  guild_id?: string;
  channel_id: string;
  content?: string;
  timestamp: string;
  edited_timestamp?: string | null;
  author: {
    id: string;
    username: string;
    global_name?: string | null;
    bot?: boolean;
  };
  member?: {
    nick?: string | null;
  };
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    content_type?: string | null;
    size?: number;
  }>;
};

async function discordRest(path: string, init: RequestInit = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Discord REST request failed (${response.status}): ${detail}`);
  }
  return response;
}

async function channelName(channelId: string, guildId: string) {
  const [saved] = await getDb()
    .select({ name: discordChannels.name })
    .from(discordChannels)
    .where(
      and(
        eq(discordChannels.id, channelId),
        eq(discordChannels.guildId, guildId),
      ),
    )
    .limit(1);
  if (saved?.name) return saved.name;
  const response = await discordRest(`/channels/${channelId}`);
  const channel = (await response.json()) as { name?: string };
  return channel.name || "unknown-channel";
}

async function logAndVerifyMessage(
  message: GatewayMessage,
  expectedGuildId: string,
) {
  if (message.guild_id !== expectedGuildId || !message.author?.id) {
    return { logged: false, verified: false };
  }
  const [member, name] = await Promise.all([
    getDb()
      .select({ linkedMemberId: discordGuildMembers.linkedMemberId })
      .from(discordGuildMembers)
      .where(
        and(
          eq(discordGuildMembers.guildId, expectedGuildId),
          eq(discordGuildMembers.discordUserId, message.author.id),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
    channelName(message.channel_id, expectedGuildId),
  ]);
  const now = new Date();
  const inserted = await getDb()
    .insert(discordMessages)
    .values({
      id: message.id,
      guildId: expectedGuildId,
      channelId: message.channel_id,
      channelName: name,
      authorDiscordUserId: message.author.id,
      authorUsername: message.author.username,
      authorDisplayName:
        message.member?.nick ||
        message.author.global_name ||
        message.author.username,
      authorIsBot: Boolean(message.author.bot),
      linkedMemberId: member?.linkedMemberId || null,
      content: message.content || "",
      attachments: (message.attachments || []).map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        url: attachment.url,
        contentType: attachment.content_type,
        size: attachment.size,
      })),
      discordCreatedAt: new Date(message.timestamp),
      discordEditedAt: message.edited_timestamp
        ? new Date(message.edited_timestamp)
        : null,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: discordMessages.id });
  if (!inserted.length) return { logged: false, verified: false };

  if (message.author.bot) {
    return { logged: true, verified: false };
  }
  try {
    await discordRest(
      `/channels/${message.channel_id}/messages/${message.id}/reactions/${VERIFIED_EMOJI}/@me`,
      { method: "PUT" },
    );
    return { logged: true, verified: true };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "discord.gateway_reaction_failed",
        guildId: expectedGuildId,
        channelId: message.channel_id,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { logged: true, verified: false };
  }
}

async function runConnection(
  token: string,
  guildId: string,
  deadline: number,
  counters: { messages: number; reactions: number },
) {
  const remaining = deadline - Date.now();
  if (remaining <= 5_000) return;

  await new Promise<void>((resolve) => {
    const socket = new WebSocket(DISCORD_GATEWAY);
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let sequence: number | null = null;
    let finished = false;
    const pending = new Set<Promise<unknown>>();

    function finish() {
      if (finished) return;
      finished = true;
      if (heartbeat) clearInterval(heartbeat);
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "Scheduled gateway handoff");
      }
      void Promise.allSettled([...pending]).finally(resolve);
    }

    const timeout = setTimeout(finish, Math.max(1_000, remaining - 2_000));
    socket.on("message", (raw) => {
      let payload: GatewayPayload;
      try {
        payload = JSON.parse(raw.toString()) as GatewayPayload;
      } catch {
        return;
      }
      if (typeof payload.s === "number") sequence = payload.s;
      if (payload.op === 10) {
        const hello = payload.d as { heartbeat_interval?: number };
        const interval = Math.max(5_000, hello.heartbeat_interval || 41_250);
        heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ op: 1, d: sequence }));
          }
        }, interval);
        socket.send(
          JSON.stringify({
            op: 2,
            d: {
              token,
              intents: GATEWAY_INTENTS,
              properties: {
                os: "linux",
                browser: "210-robotics-portal",
                device: "210-robotics-portal",
              },
              presence: {
                since: null,
                activities: [
                  {
                    name: "210 Robotics Portal",
                    type: 3,
                  },
                ],
                status: "online",
                afk: false,
              },
            },
          }),
        );
        return;
      }
      if (payload.op === 1 && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ op: 1, d: sequence }));
        return;
      }
      if (payload.op === 7 || payload.op === 9) {
        finish();
        return;
      }
      if (payload.op === 0 && payload.t === "READY") {
        console.info(
          JSON.stringify({
            event: "discord.gateway_ready",
            guildId,
          }),
        );
        return;
      }
      if (payload.op === 0 && payload.t === "MESSAGE_CREATE") {
        const task = logAndVerifyMessage(
          payload.d as GatewayMessage,
          guildId,
        )
          .then((result) => {
            if (result.logged) counters.messages += 1;
            if (result.verified) counters.reactions += 1;
          })
          .catch((error) => {
            console.error(
              JSON.stringify({
                event: "discord.gateway_message_failed",
                guildId,
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          })
          .finally(() => pending.delete(task));
        pending.add(task);
      }
    });
    socket.on("error", (error) => {
      console.error(
        JSON.stringify({
          event: "discord.gateway_socket_error",
          guildId,
          error: error.message,
        }),
      );
    });
    socket.on("close", () => {
      clearTimeout(timeout);
      finish();
    });
  });
}

export async function runDiscordGatewaySession(durationMs: number) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) {
    throw new Error(
      "DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are required for the gateway.",
    );
  }
  const startedAt = Date.now();
  const deadline = startedAt + Math.min(Math.max(durationMs, 20_000), 270_000);
  const counters = { messages: 0, reactions: 0 };
  let connections = 0;

  while (Date.now() < deadline - 5_000) {
    connections += 1;
    await runConnection(token, guildId, deadline, counters);
    if (Date.now() < deadline - 5_000) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  return {
    guildId,
    connections,
    messagesLogged: counters.messages,
    reactionsAdded: counters.reactions,
    durationMs: Date.now() - startedAt,
  };
}
