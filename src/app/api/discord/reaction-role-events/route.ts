import { NextResponse } from "next/server";
import { z } from "zod";
import { applyDiscordReactionRole } from "@/lib/discord";
import { discordWorkerRequestIsAuthorized } from "@/lib/discord-worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reactionRoleEventSchema = z.object({
  guildId: z.string().regex(/^\d{15,22}$/),
  channelId: z.string().regex(/^\d{15,22}$/),
  messageId: z.string().regex(/^\d{15,22}$/),
  discordUserId: z.string().regex(/^\d{15,22}$/),
  emoji: z.string().trim().min(1).max(80),
  action: z.enum(["ADD", "REMOVE"]),
});

export async function POST(request: Request) {
  if (!discordWorkerRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = reactionRoleEventSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The reaction-role event payload is invalid." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await applyDiscordReactionRole(parsed.data),
    );
  } catch (error) {
    console.error("Discord reaction-role event failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The reaction role could not be synchronized.",
      },
      { status: 400 },
    );
  }
}
