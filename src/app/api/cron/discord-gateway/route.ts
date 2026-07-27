import { NextResponse } from "next/server";
import { runDiscordGatewaySession } from "@/lib/discord-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const requestedSeconds = Number(
    new URL(request.url).searchParams.get("durationSeconds") || 240,
  );
  const durationMs =
    Math.min(
      Math.max(Number.isFinite(requestedSeconds) ? requestedSeconds : 240, 20),
      270,
    ) * 1_000;
  try {
    const result = await runDiscordGatewaySession(durationMs);
    console.info(
      JSON.stringify({
        event: "discord.gateway_session_completed",
        ...result,
      }),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "discord.gateway_session_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Discord gateway session failed.",
      },
      { status: 500 },
    );
  }
}
