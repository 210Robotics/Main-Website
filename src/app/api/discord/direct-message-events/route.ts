import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { discordDirectMessages } from "@/db/schema";
import { notifyDiscordAdminOfInboundDm } from "@/lib/discord-private-dm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const directMessageSchema = z.object({
  channelId: z.string().regex(/^\d{15,22}$/),
  messageId: z.string().regex(/^\d{15,22}$/),
  content: z.string().max(10_000),
  timestamp: z.iso.datetime(),
  author: z.object({
    id: z.string().regex(/^\d{15,22}$/),
    username: z.string().trim().min(1).max(80),
    displayName: z.string().trim().min(1).max(120),
    avatar: z.string().nullable().optional(),
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
    .max(10)
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
    const data = directMessageSchema.parse(await request.json());
    const db = getDb();
    const [existing] = await db
      .select({ id: discordDirectMessages.id })
      .from(discordDirectMessages)
      .where(eq(discordDirectMessages.id, data.messageId))
      .limit(1);
    if (existing) {
      const notification =
        await notifyDiscordAdminOfInboundDm(data.messageId);
      return NextResponse.json({
        logged: true,
        duplicate: true,
        awaitingAdmin: true,
        notification,
      });
    }

    await db.insert(discordDirectMessages).values({
      id: data.messageId,
      channelId: data.channelId,
      discordUserId: data.author.id,
      username: data.author.username,
      displayName: data.author.displayName,
      direction: "INBOUND",
      content: data.content,
      attachments: data.attachments,
      aiGenerated: false,
      metadata: { responseStatus: "AWAITING_ADMIN" },
      discordCreatedAt: new Date(data.timestamp),
    });

    const notification = await notifyDiscordAdminOfInboundDm(data.messageId);
    return NextResponse.json({
      logged: true,
      replied: false,
      awaitingAdmin: true,
      inboundMessageId: data.messageId,
      notification,
    });
  } catch (error) {
    console.error("Discord private DM processing failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The private Discord message could not be processed.",
      },
      { status: 400 },
    );
  }
}
