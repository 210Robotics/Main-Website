import { NextResponse } from "next/server";
import { z } from "zod";
import { syncDiscordDuesAccess } from "@/lib/discord";
import { discordWorkerRequestIsAuthorized } from "@/lib/discord-worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const accessSyncSchema = z.object({
  guildId: z.string().regex(/^\d{15,22}$/),
});

export async function POST(request: Request) {
  if (!discordWorkerRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = accessSyncSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid Discord server is required." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await syncDiscordDuesAccess({
        guildId: parsed.data.guildId,
        configureChannels: true,
      }),
    );
  } catch (error) {
    console.error("Discord membership access sync failed", {
      guildId: parsed.data.guildId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Discord membership access could not be synchronized.",
      },
      { status: 400 },
    );
  }
}
