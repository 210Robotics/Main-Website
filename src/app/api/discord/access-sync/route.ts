import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { discordEvents, discordReactionRolePanels } from "@/db/schema";
import {
  publishDiscordReactionRolePanel,
  publishDiscordVerificationPanel,
  syncDiscordDuesAccess,
} from "@/lib/discord";
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
    const access = await syncDiscordDuesAccess({
      guildId: parsed.data.guildId,
      configureChannels: true,
    });
    const [existingVerificationPanel] = await getDb()
      .select({ id: discordEvents.id })
      .from(discordEvents)
      .where(
        and(
          eq(discordEvents.guildId, parsed.data.guildId),
          eq(discordEvents.kind, "VERIFICATION_PANEL_POSTED"),
        ),
      )
      .limit(1);
    const verificationPanel = existingVerificationPanel
      ? { status: "EXISTS" as const }
      : await publishDiscordVerificationPanel(parsed.data.guildId)
          .then((result) => ({ status: "POSTED" as const, ...result }))
          .catch((error) => ({
            status: "WARNING" as const,
            reason: error instanceof Error ? error.message : String(error),
          }));
    const [existingReactionRolePanel] = await getDb()
      .select()
      .from(discordReactionRolePanels)
      .where(
        and(
          eq(discordReactionRolePanels.guildId, parsed.data.guildId),
          eq(discordReactionRolePanels.active, true),
        ),
      )
      .limit(1);
    const reactionRoles = existingReactionRolePanel
      ? {
          status: "EXISTS" as const,
          channelId: existingReactionRolePanel.channelId,
          messageId: existingReactionRolePanel.messageId,
          roleCount: existingReactionRolePanel.mappings.length,
        }
      : await publishDiscordReactionRolePanel({
          guildId: parsed.data.guildId,
        })
          .then((result) => ({
            status: "READY" as const,
            channelId: result.channelId,
            messageId: result.messageId,
            roleCount: result.mappings.length,
          }))
          .catch((error) => ({
            status: "WARNING" as const,
            reason: error instanceof Error ? error.message : String(error),
          }));
    return NextResponse.json({ access, verificationPanel, reactionRoles });
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
