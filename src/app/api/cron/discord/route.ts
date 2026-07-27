import { NextRequest, NextResponse } from "next/server";
import {
  discordConfiguration,
  registerDiscordCommands,
  sendDiscordCalendarReminders,
  sendDiscordMonthlyCalendarDigest,
  sendDiscordRegistrationReminders,
  syncDiscordGuild,
  syncDiscordMessages,
} from "@/lib/discord";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!discordConfiguration().botToken) {
    return NextResponse.json({
      skipped: true,
      reason: "DISCORD_BOT_TOKEN is not configured",
    });
  }
  try {
    const result = await syncDiscordGuild();
    const [commands, messages, reminders, monthlyDigest, registrationDms] =
      await Promise.all([
        registerDiscordCommands(result.guildId),
        syncDiscordMessages(result.guildId),
        sendDiscordCalendarReminders(result.guildId),
        sendDiscordMonthlyCalendarDigest(result.guildId),
        sendDiscordRegistrationReminders({
          guildId: result.guildId,
          limit: 25,
        }),
      ]);
    return NextResponse.json({
      skipped: false,
      ...result,
      commands: commands.map((command) => command.name),
      messages,
      reminders,
      monthlyDigest,
      registrationDms,
    });
  } catch (error) {
    console.error("Scheduled Discord synchronization failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Discord synchronization failed",
      },
      { status: 500 },
    );
  }
}
