import { NextRequest, NextResponse } from "next/server";
import {
  discordConfiguration,
  processDiscordOnboarding,
  registerDiscordCommands,
  sendDiscordRegistrationReminders,
  syncDiscordDuesAccess,
  syncDiscordGuild,
  syncDiscordMessages,
} from "@/lib/discord";
import { reconcileAllMembershipAccess } from "@/lib/membership-access-server";

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
    const membership = await reconcileAllMembershipAccess();
    const result = await syncDiscordGuild();
    const jobs = {
      commands: () => registerDiscordCommands(result.guildId),
      messages: () => syncDiscordMessages(result.guildId),
      registrationDms: () => sendDiscordRegistrationReminders({ guildId: result.guildId, limit: 25 }),
      onboarding: () => processDiscordOnboarding({ guildId: result.guildId, limit: 100 }),
      access: () => syncDiscordDuesAccess({ guildId: result.guildId, configureChannels: false }),
    };
    const operations = Object.fromEntries(
      await Promise.all(
        Object.entries(jobs).map(async ([name, run]) => {
          try {
            return [name, { status: "SUCCESS", result: await run() }] as const;
          } catch (error) {
            console.error(`Scheduled Discord ${name} job failed`, error);
            return [name, { status: "ERROR", error: error instanceof Error ? error.message : String(error) }] as const;
          }
        }),
      ),
    );
    return NextResponse.json({
      skipped: false,
      membershipReconciled: membership.length,
      ...result,
      operations,
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
