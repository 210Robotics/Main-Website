import { NextResponse } from "next/server";
import { processDiscordOnboarding } from "@/lib/discord";
import { discordWorkerRequestIsAuthorized } from "@/lib/discord-worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!discordWorkerRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processDiscordOnboarding({ limit: 100 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Discord onboarding processor failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Discord onboarding could not be processed.",
      },
      { status: 500 },
    );
  }
}
