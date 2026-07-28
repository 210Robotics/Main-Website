import { NextResponse } from "next/server";
import { z } from "zod";
import { handleDiscordMemberJoined } from "@/lib/discord";
import { discordWorkerRequestIsAuthorized } from "@/lib/discord-worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const joinedMemberSchema = z.object({
  event: z.literal("GUILD_MEMBER_ADD"),
  guildId: z.string().regex(/^\d{15,22}$/),
  guildName: z.string().trim().min(1).max(120),
  joinedAt: z.iso.datetime().nullable().optional(),
  user: z.object({
    id: z.string().regex(/^\d{15,22}$/),
    username: z.string().trim().min(1).max(80),
    displayName: z.string().trim().min(1).max(120),
    avatar: z.string().nullable().optional(),
    bot: z.boolean().default(false),
    roles: z.array(z.string().regex(/^\d{15,22}$/)).max(100).default([]),
  }),
});

export async function POST(request: Request) {
  if (!discordWorkerRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = joinedMemberSchema.parse(await request.json());
    const result = await handleDiscordMemberJoined({
      guildId: data.guildId,
      guildName: data.guildName,
      user: {
        id: data.user.id,
        username: data.user.username,
        global_name: data.user.displayName,
        avatar: data.user.avatar,
        bot: data.user.bot,
      },
      displayName: data.user.displayName,
      roles: data.user.roles,
      joinedAt: data.joinedAt,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Discord member onboarding event failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The Discord join event could not be processed.",
      },
      { status: 400 },
    );
  }
}
