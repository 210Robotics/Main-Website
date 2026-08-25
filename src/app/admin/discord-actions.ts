"use server";

import { and, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { put } from "@vercel/blob";
import { getDb } from "@/db";
import {
  auditEvents,
  discordChannels,
  discordGuildMembers,
  discordGuilds,
  membershipDues,
  membershipDuesPayments,
  membershipSettings,
  members,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import {
  assignDiscordOnboardingRoles,
  discordConfiguration,
  listDiscordGuildRoles,
  listDiscordVoiceChannels,
  normalizeDiscordReactionEmoji,
  processDiscordOnboarding,
  publishDiscordVerificationPanel,
  registerDiscordCommands,
  sendDiscordCalendarReminders,
  sendDiscordChannelMessage,
  sendDiscordDirectMessage,
  sendDiscordDirectMessageWithFile,
  sendDiscordMemberBroadcast,
  sendDiscordSelectedMemberMessages,
  sendDiscordMonthlyCalendarDigest,
  sendDiscordRegistrationReminder,
  sendDiscordRegistrationReminders,
  setDiscordChannelSlowmode,
  setDiscordGuildMemberTimeout,
  syncDiscordDuesAccess,
  syncDiscordDuesAccessForMember,
  syncDiscordGuild,
  syncDiscordMessages,
  upsertDiscordGuild,
} from "@/lib/discord";
import { buildOrganizationDebrief } from "@/lib/organization-debrief";
import {
  membershipDuesStatus,
  membershipDuesStatuses,
} from "@/lib/membership-dues";
import { recalculateMembershipDues } from "@/lib/membership-dues-server";
import { reconcileMemberMembership } from "@/lib/membership-access-server";
import { privateBlobToken } from "@/lib/private-blob";
import {
  speakDiscordVoiceMessage,
  stopAllDiscordVoiceRecordings,
} from "@/lib/discord-voice-worker";
import {
  MAX_MEETING_RECORDING_BYTES,
  allowedMeetingRecordingTypes,
  transcribeAndArchiveMeeting,
} from "@/lib/meeting-transcription";

export type DiscordConnectState = {
  status: "idle" | "success" | "warning" | "error";
  message: string;
};

export type DiscordMessageState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type MeetingTranscriptionState = {
  status: "idle" | "success" | "error";
  message: string;
  transcriptId?: string;
};

const meetingTranscriptionSchema = z.object({
  guildId: z.string().regex(/^\d{15,22}$/),
  title: z.string().trim().min(2).max(180),
  pathname: z.string().min(20).max(700),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(allowedMeetingRecordingTypes),
  bytes: z.number().int().positive().max(MAX_MEETING_RECORDING_BYTES),
  consentConfirmed: z.literal(true),
});

const recordingAnnouncementSchema = z.object({
  guildId: z.string().regex(/^\d{15,22}$/),
  voiceChannelId: z.string().regex(/^\d{15,22}$/),
  title: z.string().trim().min(2).max(180),
});

async function recordingChannels(guildId: string, voiceChannelId?: string) {
  const channels = await getDb()
    .select()
    .from(discordChannels)
    .where(eq(discordChannels.guildId, guildId));
  const rules = channels.find(
    (channel) =>
      channel.name.toLowerCase().replace(/[^a-z0-9]/g, "") ===
        "rulesandexpectations" && [0, 5].includes(channel.type),
  );
  if (!rules)
    throw new Error(
      "Synchronize a #rules-and-expectations text channel first.",
    );
  let voice: { id: string; name: string; type: number } | null =
    voiceChannelId
    ? channels
        .filter((channel) => [2, 13].includes(channel.type))
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        }))
        .find((channel) => channel.id === voiceChannelId) || null
    : null;
  if (voiceChannelId && !voice) {
    const liveVoiceChannels = await listDiscordVoiceChannels(guildId);
    voice =
      liveVoiceChannels.find((channel) => channel.id === voiceChannelId) ||
      null;
  }
  if (voiceChannelId && !voice)
    throw new Error("Select a Discord voice channel the bot can view.");
  return { rules, voice };
}

function required(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function cents(formData: FormData, name: string) {
  const value = Number(formData.get(name) || 0);
  if (!Number.isFinite(value) || value < 0 || value > 100_000) {
    throw new Error(`${name} must be a valid non-negative amount.`);
  }
  return Math.round(value * 100);
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date.");
  return date;
}

export async function syncDiscordNow(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = String(formData.get("guildId") || "").trim() || undefined;
  const result = await syncDiscordGuild(guildId);
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_SYNC",
    entityType: "discord_guild",
    entityId: result.guildId,
    details: result,
  });
  revalidatePath("/admin");
}

export async function syncDiscordMessagesNow(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const result = await syncDiscordMessages(guildId);
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_MESSAGE_SYNC",
    entityType: "discord_guild",
    entityId: guildId,
    details: result,
  });
  revalidatePath("/admin");
}

export async function sendCalendarRemindersNow(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const result = await sendDiscordCalendarReminders(guildId);
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_CALENDAR_REMINDERS",
    entityType: "discord_guild",
    entityId: guildId,
    details: result,
  });
  revalidatePath("/admin");
}

export async function sendMonthlyCalendarDigestNow(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const result = await sendDiscordMonthlyCalendarDigest(guildId, {
    force: true,
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_MONTHLY_CALENDAR_DIGEST",
    entityType: "discord_guild",
    entityId: guildId,
    details: result,
  });
  revalidatePath("/admin");
}

export async function updateDiscordMemberTimeout(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const guildMemberId = z.uuid().parse(required(formData, "guildMemberId"));
  const durationMinutes = Number(formData.get("durationMinutes"));
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 0 ||
    durationMinutes > 28 * 24 * 60
  )
    throw new Error("Choose a timeout between 1 minute and 28 days.");
  const reason = String(formData.get("reason") || "").trim().slice(0, 400);
  const [member] = await getDb()
    .select()
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.id, guildMemberId),
        eq(discordGuildMembers.guildId, guildId),
      ),
    )
    .limit(1);
  if (!member || member.isBot || member.leftAt)
    throw new Error("Select an active human Discord member.");
  const result = await setDiscordGuildMemberTimeout({
    guildId,
    discordUserId: member.discordUserId,
    durationMinutes,
    reason:
      reason ||
      (durationMinutes === 0
        ? `Timeout cleared from 210 Robotics admin portal by member ${actor.id}`
        : `Timed out from 210 Robotics admin portal by member ${actor.id}`),
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action:
      durationMinutes === 0
        ? "DISCORD_MEMBER_TIMEOUT_CLEARED"
        : "DISCORD_MEMBER_TIMED_OUT",
    entityType: "discord_guild_member",
    entityId: member.id,
    details: {
      guildId,
      discordUserId: member.discordUserId,
      durationMinutes,
      until: result.until,
      reason,
    },
  });
  revalidatePath("/admin");
}

export async function updateDiscordChannelSlowmode(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const channelId = required(formData, "channelId");
  const seconds = Number(formData.get("seconds"));
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600) {
    throw new Error("Choose a slowmode interval between 0 seconds and 6 hours.");
  }
  const reason = String(formData.get("reason") || "").trim().slice(0, 400);
  const [channel] = await getDb()
    .select()
    .from(discordChannels)
    .where(
      and(
        eq(discordChannels.id, channelId),
        eq(discordChannels.guildId, guildId),
      ),
    )
    .limit(1);
  if (!channel || ![0, 5].includes(channel.type)) {
    throw new Error("Select a synchronized Discord text channel.");
  }
  const result = await setDiscordChannelSlowmode({
    guildId,
    channelId,
    seconds,
    reason:
      reason ||
      `Slowmode updated from 210 Robotics admin portal by member ${actor.id}`,
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_CHANNEL_SLOWMODE_UPDATED",
    entityType: "discord_channel",
    entityId: channel.id,
    details: {
      guildId,
      channelId,
      channelName: channel.name,
      seconds: result.seconds,
      reason,
    },
  });
  revalidatePath("/admin");
}

export async function updateDiscordMemberDmSettings(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const guildMemberId = z.uuid().parse(required(formData, "guildMemberId"));
  const automaticRegistrationDms =
    formData.get("automaticRegistrationDms") === "on";
  const [member] = await getDb()
    .select()
    .from(discordGuildMembers)
    .where(
      and(
        eq(discordGuildMembers.id, guildMemberId),
        eq(discordGuildMembers.guildId, guildId),
      ),
    )
    .limit(1);
  if (!member || member.isBot || member.leftAt)
    throw new Error("Select an active human Discord member.");
  await getDb()
    .update(discordGuildMembers)
    .set({
      remindersOptedOut: !automaticRegistrationDms,
      updatedAt: new Date(),
    })
    .where(eq(discordGuildMembers.id, member.id));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_MEMBER_DM_SETTINGS_UPDATED",
    entityType: "discord_guild_member",
    entityId: member.id,
    details: {
      guildId,
      discordUserId: member.discordUserId,
      automaticRegistrationDms,
    },
  });
  revalidatePath("/admin");
}

export async function transcribeMeetingRecording(
  input: z.input<typeof meetingTranscriptionSchema>,
): Promise<MeetingTranscriptionState> {
  try {
    const actor = await requirePermission("integrations.manage");
    const data = meetingTranscriptionSchema.parse(input);
    const result = await transcribeAndArchiveMeeting({
      memberId: actor.id,
      guildId: data.guildId,
      title: data.title,
      pathname: data.pathname,
      filename: data.filename,
      mimeType: data.mimeType,
      bytes: data.bytes,
    });
    revalidatePath("/admin");
    return {
      status: "success",
      message:
        `Word and Markdown transcripts created and the recording archived${result.driveSynced ? " in Google Drive" : " in Internal Documents"}. ` +
        (result.botlog.published
          ? "The Markdown transcript and download links were also posted in #Botlog."
          : `Botlog was not updated: ${result.botlog.reason}`),
      transcriptId: result.transcriptId,
    };
  } catch (error) {
    console.error("Meeting transcription failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The meeting could not be transcribed.",
    };
  }
}

export async function postDiscordRecordingPolicy(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const { rules } = await recordingChannels(guildId);
  const content =
    "**Voice meeting recording & documentation policy**\n\n" +
    "210 Robotics may record a voice meeting for internal team documentation only when the recording is clearly announced before it begins. Everyone present must be informed and asked for consent. Anyone may decline or leave before recording starts, and the bot/website will not silently or automatically record people merely for joining a voice channel.\n\n" +
    "Approved recordings and Gemini-generated transcripts are kept in the team’s private Internal Documents archive. Access is limited to authorized team leadership. Questions or removal requests should be directed to a team officer.";
  const sent = await sendDiscordChannelMessage({
    guildId,
    channelId: rules.id,
    channelName: rules.name,
    content,
    allowedUserIds: [],
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_RECORDING_POLICY_POSTED",
    entityType: "discord_message",
    entityId: sent.id,
    details: { guildId, channelId: rules.id },
  });
  revalidatePath("/admin");
}

export async function postDiscordVerificationPanel(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const posted = await publishDiscordVerificationPanel(guildId);
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_VERIFICATION_PANEL_POSTED",
    entityType: "discord_message",
    entityId: posted.messageId,
    details: { guildId, channelId: posted.channelId },
  });
  revalidatePath("/admin");
}

export async function announceDiscordRecordingSession(
  input: z.input<typeof recordingAnnouncementSchema>,
): Promise<DiscordMessageState> {
  try {
    const actor = await requirePermission("integrations.manage");
    const data = recordingAnnouncementSchema.parse(input);
    const { rules, voice } = await recordingChannels(
      data.guildId,
      data.voiceChannelId,
    );
    const sent = await sendDiscordChannelMessage({
      guildId: data.guildId,
      channelId: rules.id,
      channelName: rules.name,
      content:
        `**Recording notice: ${data.title}**\n` +
        `An administrator is preparing a consent-based recording in **${voice?.name || "a team voice channel"}** for internal documentation. ` +
        "Recording must not begin until everyone present has been informed and has consented. Anyone who does not consent may decline or leave before recording starts.",
      allowedUserIds: [],
    });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_RECORDING_SESSION_ANNOUNCED",
      entityType: "discord_message",
      entityId: sent.id,
      details: {
        guildId: data.guildId,
        voiceChannelId: data.voiceChannelId,
        title: data.title,
      },
    });
    return {
      status: "success",
      message: `Recording notice posted in #${rules.name}.`,
    };
  } catch (error) {
    console.error("Discord recording announcement failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The recording notice could not be posted.",
    };
  }
}

export async function saveDiscordSettings(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const generalChannelId = required(formData, "generalChannelId");
  const reminderHours = Number(formData.get("reminderHours") || 24);
  if (
    !Number.isInteger(reminderHours) ||
    reminderHours < 1 ||
    reminderHours > 168
  ) {
    throw new Error("Reminder window must be between 1 and 168 hours.");
  }
  const [channel] = await getDb()
    .select()
    .from(discordChannels)
    .where(
      and(
        eq(discordChannels.id, generalChannelId),
        eq(discordChannels.guildId, guildId),
      ),
    )
    .limit(1);
  if (!channel) throw new Error("Select a synchronized Discord channel.");
  const enabled = formData.get("announcementsEnabled") === "on";
  await getDb()
    .update(discordGuilds)
    .set({
      generalChannelId,
      calendarReminderHours: reminderHours,
      calendarAnnouncementsEnabled: enabled,
      updatedAt: new Date(),
    })
    .where(eq(discordGuilds.id, guildId));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_CALENDAR_SETTINGS",
    entityType: "discord_guild",
    entityId: guildId,
    details: {
      channelId: generalChannelId,
      channelName: channel.name,
      reminderHours,
      enabled,
    },
  });
  revalidatePath("/admin");
}

export async function saveDiscordReactionSettings(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const enabled = formData.get("reactionEnabled") === "on";
  const emoji = normalizeDiscordReactionEmoji(
    String(formData.get("reactionEmoji") || "✅"),
  );
  await getDb()
    .update(discordGuilds)
    .set({
      messageReactionEnabled: enabled,
      messageReactionEmoji: emoji,
      updatedAt: new Date(),
    })
    .where(eq(discordGuilds.id, guildId));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_MESSAGE_REACTION_SETTINGS",
    entityType: "discord_guild",
    entityId: guildId,
    details: { enabled, emoji },
  });
  revalidatePath("/admin");
}

export async function saveDiscordOnboardingSettings(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const agreedRoleId = required(formData, "agreedRoleId");
  const vexUMemberRoleId = required(formData, "vexUMemberRoleId");
  const securityDelayMinutes = Number(
    formData.get("securityDelayMinutes") || 10,
  );
  if (
    !Number.isInteger(securityDelayMinutes) ||
    securityDelayMinutes < 1 ||
    securityDelayMinutes > 60
  ) {
    throw new Error("The security delay must be between 1 and 60 minutes.");
  }
  if (agreedRoleId === vexUMemberRoleId) {
    throw new Error("Choose two different onboarding roles.");
  }
  const roles = await listDiscordGuildRoles(guildId);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const agreedRole = roleById.get(agreedRoleId);
  const vexUMemberRole = roleById.get(vexUMemberRoleId);
  if (
    !agreedRole ||
    agreedRole.managed ||
    !vexUMemberRole ||
    vexUMemberRole.managed
  ) {
    throw new Error("Choose two roles the 210 bot is allowed to manage.");
  }
  const onboardingEnabled = formData.get("onboardingEnabled") === "on";
  await getDb()
    .update(discordGuilds)
    .set({
      onboardingEnabled,
      securityDelayMinutes,
      agreedRoleId,
      vexUMemberRoleId,
      updatedAt: new Date(),
    })
    .where(eq(discordGuilds.id, guildId));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_ONBOARDING_SETTINGS",
    entityType: "discord_guild",
    entityId: guildId,
    details: {
      onboardingEnabled,
      securityDelayMinutes,
      agreedRoleId,
      agreedRoleName: agreedRole.name,
      vexUMemberRoleId,
      vexUMemberRoleName: vexUMemberRole.name,
    },
  });
  revalidatePath("/admin");
}

export async function saveDiscordDuesAccessSettings(formData: FormData) {
  const actor = await requirePermission("dues.manage");
  const guildId = required(formData, "guildId");
  const enabled = formData.get("duesEnforcementEnabled") === "on";
  const requestedChannelIds = [
    ...new Set(
      formData
        .getAll("publicChannelId")
        .map(String)
        .filter((value) => /^\d{15,22}$/.test(value)),
    ),
  ];
  const channelRows = requestedChannelIds.length
    ? await getDb()
        .select({ id: discordChannels.id, name: discordChannels.name })
        .from(discordChannels)
        .where(
          and(
            eq(discordChannels.guildId, guildId),
            inArray(discordChannels.id, requestedChannelIds),
          ),
        )
    : [];
  if (channelRows.length !== requestedChannelIds.length) {
    throw new Error("One or more selected public Discord channels are invalid.");
  }
  if (enabled && !channelRows.length) {
    throw new Error(
      "Select at least one public channel before enforcing membership dues.",
    );
  }
  await getDb()
    .update(discordGuilds)
    .set({
      duesEnforcementEnabled: enabled,
      duesPublicChannelIds: requestedChannelIds,
      updatedAt: new Date(),
    })
    .where(eq(discordGuilds.id, guildId));
  const result = await syncDiscordDuesAccess({ guildId });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_MEMBERSHIP_DUES_SETTINGS",
    entityType: "discord_guild",
    entityId: guildId,
    details: {
      enabled,
      publicChannels: channelRows,
      paid: result.paid,
      unpaid: result.unpaid,
      exempt: result.exempt,
      restrictedChannels: result.restricted,
    },
  });
  revalidatePath("/admin");
}

export async function syncDiscordDuesAccessNow(formData: FormData) {
  const actor = await requirePermission("dues.manage");
  const guildId = required(formData, "guildId");
  const result = await syncDiscordDuesAccess({ guildId });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_MEMBERSHIP_DUES_SYNC",
    entityType: "discord_guild",
    entityId: guildId,
    details: result,
  });
  revalidatePath("/admin");
}

export async function processDiscordOnboardingNow(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const result = await processDiscordOnboarding({ guildId, limit: 100 });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_ONBOARDING_PROCESSED",
    entityType: "discord_guild",
    entityId: guildId,
    details: result,
  });
  revalidatePath("/admin");
}

export async function retryDiscordOnboardingRoles(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const discordUserId = required(formData, "discordUserId");
  const result = await assignDiscordOnboardingRoles({
    guildId,
    discordUserId,
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_ONBOARDING_ROLES_RETRIED",
    entityType: "discord_member",
    entityId: discordUserId,
    details: { guildId, roleNames: result.roleNames },
  });
  revalidatePath("/admin");
}

export async function registerDiscordCommandsAction(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const commands = await registerDiscordCommands(guildId);
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_COMMANDS_REGISTER",
    entityType: "discord_guild",
    entityId: guildId,
    details: { commands: commands.map((command) => command.name) },
  });
  revalidatePath("/admin");
}

export async function connectDiscordGuildWithState(
  _previousState: DiscordConnectState,
  formData: FormData,
): Promise<DiscordConnectState> {
  const startedAt = Date.now();
  try {
    const actor = await requirePermission("integrations.manage");
    const configuration = discordConfiguration();
    if (!configuration.botToken) {
      return {
        status: "error",
        message:
          "The private Discord bot token is not configured in Vercel yet. Add DISCORD_BOT_TOKEN, redeploy, then return here.",
      };
    }
    if (!configuration.applicationId) {
      return {
        status: "error",
        message: "The Discord Application ID is not configured.",
      };
    }
    const guildId = required(formData, "guildId");
    if (!/^\d{15,22}$/.test(guildId)) {
      return {
        status: "error",
        message:
          "Enter the numeric Discord Server ID. Enable Developer Mode in Discord, right-click the server, and select Copy Server ID.",
      };
    }
    console.info(
      JSON.stringify({
        level: "info",
        message: "Discord server connection started",
        guildId,
        actorMemberId: actor.id,
      }),
    );
    await upsertDiscordGuild({
      guildId,
      name: "210 Robotics Discord",
    });
    const commands = await registerDiscordCommands(guildId);
    let memberCount: number | null = null;
    let syncWarning = "";
    try {
      const result = await syncDiscordGuild(guildId);
      memberCount = result.memberCount;
    } catch (error) {
      syncWarning = friendlyDiscordConnectionError(error, true);
      console.warn(
        JSON.stringify({
          level: "warning",
          message: "Discord commands installed but member sync failed",
          guildId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_GUILD_CONNECT",
      entityType: "discord_guild",
      entityId: guildId,
      details: {
        commands: commands.map((command) => command.name),
        memberCount,
        syncWarning,
      },
    });
    revalidatePath("/admin");
    console.info(
      JSON.stringify({
        level: "info",
        message: "Discord server connection completed",
        guildId,
        commandCount: commands.length,
        memberCount,
        durationMs: Date.now() - startedAt,
      }),
    );
    if (syncWarning) {
      return {
        status: "warning",
        message: `${commands.length} slash commands were installed successfully. ${syncWarning}`,
      };
    }
    return {
      status: "success",
      message: `Connected successfully. ${commands.length} slash commands were installed and ${memberCount ?? 0} Discord members were synchronized.`,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Discord server connection failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      }),
    );
    return {
      status: "error",
      message: friendlyDiscordConnectionError(error),
    };
  }
}

function friendlyDiscordConnectionError(error: unknown, syncOnly = false) {
  const detail = error instanceof Error ? error.message : String(error);
  if (detail.includes("DISCORD_BOT_TOKEN")) {
    return "The private Discord bot token is not configured in Vercel.";
  }
  if (detail.includes("(401)")) {
    return "Discord rejected the bot token. Generate a current token in the Discord Developer Portal and update DISCORD_BOT_TOKEN in Vercel.";
  }
  if (detail.includes("(403)")) {
    return syncOnly
      ? "Member synchronization still needs the Server Members Intent enabled in Discord's Developer Portal."
      : "Discord denied access. Confirm the bot is installed in this server and has View Channels, Read Message History, and Send Messages permissions.";
  }
  if (detail.includes("(404)")) {
    return "Discord could not find that server for this bot. Confirm the Server ID and add the bot to the server first.";
  }
  if (detail.includes("No Discord server")) {
    return detail;
  }
  return syncOnly
    ? "Member synchronization needs attention; check the Server Members Intent and bot permissions."
    : "Discord could not complete the connection. Confirm the bot token, Server ID, installation, and privileged intents, then try again.";
}

export async function sendDiscordAdminMessage(
  _previousState: DiscordMessageState,
  formData: FormData,
): Promise<DiscordMessageState> {
  const startedAt = Date.now();
  try {
    const actor = await requirePermission("integrations.manage");
    if (!discordConfiguration().botToken) {
      return {
        status: "error",
        message:
          "The bot token is not active in this deployment yet. Redeploy after adding DISCORD_BOT_TOKEN.",
      };
    }
    const guildId =
      String(formData.get("guildId") || "").trim() ||
      process.env.DISCORD_GUILD_ID ||
      "";
    const channelId = required(formData, "channelId");
    const requestedContent = required(formData, "content");
    const mentionEveryone = formData.get("mentionEveryone") === "on";
    const content =
      mentionEveryone && !/@(?:everyone|here)\b/i.test(requestedContent)
        ? `@everyone\n${requestedContent}`
        : requestedContent;
    if (content.length > 2000) {
      return {
        status: "error",
        message: "Discord messages must be 2,000 characters or fewer.",
      };
    }
    const [channel] = await getDb()
      .select()
      .from(discordChannels)
      .where(
        and(
          eq(discordChannels.id, channelId),
          eq(discordChannels.guildId, guildId),
        ),
      )
      .limit(1);
    if (!channel || ![0, 5, 10, 11, 12].includes(channel.type)) {
      return {
        status: "error",
        message:
          "Select a synchronized text channel or thread from this Discord server.",
      };
    }
    const requestedMentions = [
      ...content.matchAll(/<@!?(\d{15,22})>/g),
    ]
      .map((match) => match[1])
      .slice(0, 100);
    const allowedMentions = requestedMentions.length
      ? await getDb()
          .select({ discordUserId: discordGuildMembers.discordUserId })
          .from(discordGuildMembers)
          .where(
            and(
              eq(discordGuildMembers.guildId, guildId),
              inArray(
                discordGuildMembers.discordUserId,
                requestedMentions,
              ),
            ),
          )
      : [];
    const result = await sendDiscordChannelMessage({
      guildId,
      channelId,
      channelName: channel.name,
      content,
      allowedUserIds: allowedMentions.map((row) => row.discordUserId),
      allowEveryone: mentionEveryone,
    });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_MESSAGE_SEND",
      entityType: "discord_message",
      entityId: result.id,
      details: {
        guildId,
        channelId,
        channelName: channel.name,
        mentionedUserCount: allowedMentions.length,
        mentionedEveryone: mentionEveryone,
      },
    });
    revalidatePath("/admin");
    console.info(
      JSON.stringify({
        level: "info",
        message: "Admin Discord message sent",
        guildId,
        channelId,
        actorMemberId: actor.id,
        durationMs: Date.now() - startedAt,
      }),
    );
    return {
      status: "success",
      message: `Message sent to #${channel.name}${mentionEveryone ? " with @everyone" : ""}.`,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Admin Discord message failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      }),
    );
    return {
      status: "error",
      message: friendlyDiscordConnectionError(error),
    };
  }
}

export async function sendDiscordVoiceSpeech(
  _previousState: DiscordMessageState,
  formData: FormData,
): Promise<DiscordMessageState> {
  try {
    const actor = await requirePermission("integrations.manage");
    const guildId = required(formData, "guildId");
    const channelId = required(formData, "channelId");
    const text = required(formData, "text").slice(0, 500);
    if (!/^\d{15,22}$/.test(guildId) || !/^\d{15,22}$/.test(channelId)) {
      return {
        status: "error",
        message: "Select a valid Discord voice channel.",
      };
    }
    const channels = await listDiscordVoiceChannels(guildId);
    const channel = channels.find((candidate) => candidate.id === channelId);
    if (!channel) {
      return {
        status: "error",
        message: "The bot cannot access that Discord voice channel.",
      };
    }
    const result = await speakDiscordVoiceMessage({
      guildId,
      channelId,
      text,
      requestedByMemberId: actor.id,
    });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_VOICE_SPEECH",
      entityType: "discord_channel",
      entityId: channelId,
      details: {
        guildId,
        channelName: channel.name,
        characterCount: text.length,
      },
    });
    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    console.error("Discord voice speech failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The bot could not speak in that voice channel.",
    };
  }
}

export async function stopAllDiscordRecordings(
  _previousState: DiscordMessageState,
  formData: FormData,
): Promise<DiscordMessageState> {
  try {
    const actor = await requirePermission("integrations.manage");
    const guildId = required(formData, "guildId");
    const result = await stopAllDiscordVoiceRecordings();
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_RECORDINGS_STOP_ALL",
      entityType: "discord_guild",
      entityId: guildId,
      details: { stopped: result.stopped },
    });
    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    console.error("Discord recording stop-all failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The active Discord recordings could not be stopped.",
    };
  }
}

export async function sendDiscordReminder(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildMemberId = required(formData, "guildMemberId");
  await sendDiscordRegistrationReminder({
    guildMemberId,
    ignoreCooldown: true,
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_REGISTRATION_REMINDER",
    entityType: "discord_guild_member",
    entityId: guildMemberId,
  });
  revalidatePath("/admin");
}

export async function sendDiscordSelectedMemberDm(
  _previousState: DiscordMessageState,
  formData: FormData,
): Promise<DiscordMessageState> {
  try {
    const actor = await requirePermission("integrations.manage");
    const guildId = required(formData, "guildId");
    const guildMemberIds = formData
      .getAll("guildMemberIds")
      .map((value) => String(value))
      .filter((value) => z.uuid().safeParse(value).success);
    const message = required(formData, "message").slice(0, 1_800);
    const result = await sendDiscordSelectedMemberMessages({
      guildId,
      guildMemberIds,
      content: message,
    });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_MEMBER_DM_SELECTION",
      entityType: "discord_guild",
      entityId: guildId,
      details: {
        selected: guildMemberIds.length,
        sent: result.sent,
        failed: result.failed,
      },
    });
    return {
      status: result.failed ? "error" : "success",
      message: result.failed
        ? `${result.sent} DM${result.sent === 1 ? "" : "s"} sent; ${result.failed} failed because Discord blocked delivery.`
        : `${result.sent} private DM${result.sent === 1 ? "" : "s"} sent successfully.`,
    };
  } catch (error) {
    console.error("Selected Discord member DM failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The selected member DMs could not be sent.",
    };
  }
}

export async function sendDiscordConversationReply(
  _previousState: DiscordMessageState,
  formData: FormData,
): Promise<DiscordMessageState> {
  try {
    const actor = await requirePermission("integrations.manage");
    const parsed = z
      .object({
        guildId: z.string().regex(/^\d{15,22}$/),
        discordUserId: z.string().regex(/^\d{15,22}$/),
        message: z.string().trim().min(1).max(1_800),
        replyToMessageId: z
          .string()
          .regex(/^\d{15,22}$/)
          .optional()
          .or(z.literal("")),
      })
      .safeParse({
        guildId: String(formData.get("guildId") || "").trim(),
        discordUserId: String(formData.get("discordUserId") || "").trim(),
        message: String(formData.get("message") || ""),
        replyToMessageId: String(
          formData.get("replyToMessageId") || "",
        ).trim(),
      });
    if (!parsed.success) {
      return {
        status: "error",
        message:
          "Choose an active Discord member and enter a message under 1,800 characters.",
      };
    }

    const [recipient] = await getDb()
      .select({
        discordUserId: discordGuildMembers.discordUserId,
        username: discordGuildMembers.username,
        displayName: discordGuildMembers.displayName,
      })
      .from(discordGuildMembers)
      .where(
        and(
          eq(discordGuildMembers.guildId, parsed.data.guildId),
          eq(
            discordGuildMembers.discordUserId,
            parsed.data.discordUserId,
          ),
          eq(discordGuildMembers.isBot, false),
          isNull(discordGuildMembers.leftAt),
        ),
      )
      .limit(1);
    if (!recipient) {
      return {
        status: "error",
        message:
          "That person is no longer an active member of the connected Discord server. Synchronize Discord and try again.",
      };
    }

    const sent = await sendDiscordDirectMessage({
      discordUserId: recipient.discordUserId,
      content: parsed.data.message,
      log: {
        username: recipient.username,
        displayName: recipient.displayName,
        aiGenerated: false,
        replyToMessageId: parsed.data.replyToMessageId || null,
        metadata: {
          kind: "manual-admin-reply",
          actorMemberId: actor.id,
        },
      },
    });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_MANUAL_DM_SENT",
      entityType: "discord_user",
      entityId: recipient.discordUserId,
      details: {
        guildId: parsed.data.guildId,
        discordMessageId: sent.id,
        replyToMessageId: parsed.data.replyToMessageId || null,
        characterCount: parsed.data.message.trim().length,
      },
    });
    revalidatePath("/admin");
    return {
      status: "success",
      message: `Sent privately to ${recipient.displayName} as the 210 Robotics bot.`,
    };
  } catch (error) {
    console.error("Manual Discord conversation reply failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The private Discord message could not be sent.",
    };
  }
}

export async function sendOrganizationDebriefToJacob(
  _previousState: DiscordMessageState,
  formData: FormData,
): Promise<DiscordMessageState> {
  try {
    const actor = await requirePermission("integrations.manage");
    const guildId = required(formData, "guildId");
    const [linkedJacob] = await getDb()
      .select({
        discordUserId: discordGuildMembers.discordUserId,
        discordDisplayName: discordGuildMembers.displayName,
        discordUsername: discordGuildMembers.username,
        portalName: members.displayName,
      })
      .from(discordGuildMembers)
      .leftJoin(members, eq(members.id, discordGuildMembers.linkedMemberId))
      .where(
        and(
          eq(discordGuildMembers.guildId, guildId),
          eq(discordGuildMembers.isBot, false),
          isNull(discordGuildMembers.leftAt),
          or(
            ilike(members.displayName, "Jacob White"),
            ilike(discordGuildMembers.displayName, "Jacob White"),
            ilike(discordGuildMembers.username, "jacobw624"),
          ),
        ),
      )
      .limit(1);
    const configuredRecipient = String(
      process.env.DISCORD_ADMIN_USER_ID || "",
    ).trim();
    const discordUserId =
      linkedJacob?.discordUserId ||
      (/^\d{15,22}$/.test(configuredRecipient) ? configuredRecipient : "");
    if (!discordUserId) {
      return {
        status: "error",
        message:
          "Jacob White's linked Discord account could not be found. Synchronize Discord and link @jacobw624 to Jacob's portal account first.",
      };
    }

    const debrief = await buildOrganizationDebrief();
    const filename = `210-robotics-full-debrief-${debrief.generatedAt
      .toISOString()
      .slice(0, 10)}.md`;
    const sent = await sendDiscordDirectMessageWithFile({
      discordUserId,
      content: debrief.summaryMessage,
      filename,
      file: Buffer.from(debrief.markdown, "utf8"),
    });
    await getDb().insert(auditEvents).values({
      actorMemberId: actor.id,
      action: "DISCORD_ORGANIZATION_DEBRIEF_SENT",
      entityType: "discord_guild",
      entityId: guildId,
      details: {
        recipientDiscordUserId: discordUserId,
        recipientName:
          linkedJacob?.portalName ||
          linkedJacob?.discordDisplayName ||
          "Jacob White",
        messageId: sent.id,
        warningCount: debrief.warningCount,
        openTaskCount: debrief.openTaskCount,
        upcomingEventCount: debrief.upcomingEventCount,
        documentCount: debrief.documentCount,
        filename,
      },
    });
    return {
      status: "success",
      message: `Full debrief sent privately to ${
        linkedJacob?.portalName ||
        linkedJacob?.discordDisplayName ||
        "Jacob White"
      }: ${debrief.warningCount} warnings, ${debrief.openTaskCount} open tasks, ${debrief.upcomingEventCount} upcoming events, and ${debrief.documentCount} internal documents reviewed.`,
    };
  } catch (error) {
    console.error("Discord organization debrief failed", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The organization debrief could not be generated or delivered.",
    };
  }
}

export async function sendAllDiscordReminders(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const result = await sendDiscordRegistrationReminders({
    guildId,
    limit: 100,
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_REGISTRATION_REMINDER_BATCH",
    entityType: "discord_guild",
    entityId: guildId,
    details: result,
  });
  revalidatePath("/admin");
}

export async function sendDiscordBroadcastReminder(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const message = required(formData, "message").slice(0, 1_800);
  const result = await sendDiscordMemberBroadcast({
    guildId,
    content: message,
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_MEMBER_DM_BROADCAST",
    entityType: "discord_guild",
    entityId: guildId,
    details: {
      recipients: result.recipients,
      sent: result.sent,
      failed: result.failed,
    },
  });
  revalidatePath("/admin");
}

export async function initializeMembershipDuesPeriod(formData: FormData) {
  const actor = await requirePermission("dues.manage");
  const period = required(formData, "period");
  if (!/^[A-Za-z0-9][A-Za-z0-9 .-]{2,39}$/.test(period)) {
    throw new Error("Enter a valid semester or academic-year period.");
  }
  const amountDueCents = cents(formData, "amountDue");
  const dueAt = optionalDate(formData.get("dueAt"));
  const activeMembers = await getDb()
    .select({ id: members.id })
    .from(members)
    .where(eq(members.status, "ACTIVE"));
  if (activeMembers.length) {
    const initialized = await getDb()
      .insert(membershipDues)
      .values(
        activeMembers.map((member) => ({
          memberId: member.id,
          period,
          amountDueCents,
          dueAt,
          updatedByMemberId: actor.id,
        })),
      )
      .onConflictDoUpdate({
        target: [membershipDues.memberId, membershipDues.period],
        set: {
          amountDueCents,
          dueAt,
          updatedByMemberId: actor.id,
          updatedAt: new Date(),
        },
      })
      .returning({ id: membershipDues.id });
    for (const row of initialized) {
      await recalculateMembershipDues(row.id);
    }
  }
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "MEMBERSHIP_DUES_PERIOD_INITIALIZE",
    entityType: "membership_dues_period",
    entityId: period,
    details: { amountDueCents, dueAt, memberCount: activeMembers.length },
  });
  revalidatePath("/admin");
}

export async function saveMembershipDues(formData: FormData) {
  const actor = await requirePermission("dues.manage");
  const memberId = required(formData, "memberId");
  const period = required(formData, "period");
  const amountDueCents = cents(formData, "amountDue");
  const manualAmountPaidCents = cents(formData, "amountPaid");
  const requestedStatus = required(formData, "status").toUpperCase();
  if (
    !membershipDuesStatuses.includes(
      requestedStatus as (typeof membershipDuesStatuses)[number],
    )
  ) {
    throw new Error("Invalid membership-dues status.");
  }
  const status = membershipDuesStatus({
    amountDueCents,
    amountPaidCents: manualAmountPaidCents,
    waived: requestedStatus === "WAIVED",
  });
  const dueAt = optionalDate(formData.get("dueAt"));
  const paymentMethod = String(formData.get("paymentMethod") || "")
    .trim()
    .slice(0, 100);
  const notes = String(formData.get("notes") || "").trim().slice(0, 2000);
  const now = new Date();
  const [saved] = await getDb()
    .insert(membershipDues)
    .values({
      memberId,
      period,
      amountDueCents,
      manualAmountPaidCents,
      amountPaidCents: manualAmountPaidCents,
      status,
      dueAt,
      paidAt: status === "PAID" ? now : null,
      paymentMethod,
      notes,
      updatedByMemberId: actor.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [membershipDues.memberId, membershipDues.period],
      set: {
        amountDueCents,
        manualAmountPaidCents,
        amountPaidCents: manualAmountPaidCents,
        status,
        dueAt,
        paidAt: status === "PAID" ? now : null,
        paymentMethod,
        notes,
        updatedByMemberId: actor.id,
        updatedAt: now,
      },
    })
    .returning();
  const recalculated = await recalculateMembershipDues(saved.id);
  try {
    await syncDiscordDuesAccessForMember(memberId);
  } catch (error) {
    console.error("Discord dues access did not synchronize after manual update", {
      memberId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "MEMBERSHIP_DUES_UPDATE",
    entityType: "membership_dues",
    entityId: saved.id,
    details: {
      memberId,
      period,
      amountDueCents,
      manualAmountPaidCents,
      amountPaidCents: recalculated?.amountPaidCents ?? manualAmountPaidCents,
      status: recalculated?.status ?? status,
    },
  });
  revalidatePath("/admin");
}

export async function saveMembershipSettings(formData: FormData) {
  const actor = await requirePermission("dues.manage");
  const membershipYear = required(formData, "membershipYear");
  if (!/^\d{4}-\d{4}$/.test(membershipYear)) {
    throw new Error("Membership year must look like 2026-2027.");
  }
  const semesterDuesCents = cents(formData, "semesterDues");
  const annualDuesCents = cents(formData, "annualDues");
  const fundraisingWaiverThresholdCents = cents(formData, "fundraisingWaiverThreshold");
  const gracePeriodDays = Math.max(0, Math.min(180, Number(formData.get("gracePeriodDays") || 0)));
  const accessEnforcementEnabled = formData.get("accessEnforcementEnabled") === "on";
  await getDb()
    .insert(membershipSettings)
    .values({
      id: "membership",
      membershipYear,
      semesterDuesCents,
      annualDuesCents,
      fundraisingWaiverThresholdCents,
      gracePeriodDays,
      accessEnforcementEnabled,
      updatedByMemberId: actor.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: membershipSettings.id,
      set: {
        membershipYear,
        semesterDuesCents,
        annualDuesCents,
        fundraisingWaiverThresholdCents,
        gracePeriodDays,
        accessEnforcementEnabled,
        updatedByMemberId: actor.id,
        updatedAt: new Date(),
      },
    });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "MEMBERSHIP_SETTINGS_UPDATE",
    entityType: "membership_settings",
    entityId: "membership",
    details: {
      membershipYear,
      semesterDuesCents,
      annualDuesCents,
      fundraisingWaiverThresholdCents,
      gracePeriodDays,
      accessEnforcementEnabled,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
}

export async function addManualMembershipDuesPayment(formData: FormData) {
  const actor = await requirePermission("dues.manage");
  const memberId = required(formData, "memberId");
  const period = required(formData, "period");
  const amountCents = cents(formData, "amount");
  if (amountCents <= 0) throw new Error("Payment amount must be greater than zero.");
  const coverageType = required(formData, "coverageType").toUpperCase();
  if (!["SEMESTER", "ANNUAL"].includes(coverageType)) {
    throw new Error("Choose semester or annual coverage.");
  }
  const paymentMethod = required(formData, "paymentMethod").toUpperCase().slice(0, 80);
  if (
    ![
      "CASH",
      "CASH_APP",
      "ZELLE",
      "CHECK",
      "UNIVERSITY_PAYMENT",
      "OTHER",
    ].includes(paymentMethod)
  ) {
    throw new Error("Choose a valid manual payment method.");
  }
  const paymentDate = optionalDate(formData.get("paymentDate")) || new Date();
  const transactionReference = String(formData.get("transactionReference") || "").trim().slice(0, 180);
  const notes = String(formData.get("notes") || "").trim().slice(0, 2_000);
  const proof = formData.get("proof");
  let proofFields: {
    proofPathname?: string;
    proofFilename?: string;
    proofMimeType?: string;
    proofBytes?: number;
  } = {};
  if (proof instanceof File && proof.size > 0) {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(proof.type) || proof.size > 8 * 1024 * 1024) {
      throw new Error("Payment proof must be a PDF, JPG, or PNG under 8 MB.");
    }
    const safeName = proof.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 140);
    const blob = await put(
      `membership-dues/proof/${memberId}/${crypto.randomUUID()}-${safeName}`,
      Buffer.from(await proof.arrayBuffer()),
      { access: "private", token: privateBlobToken(), contentType: proof.type, addRandomSuffix: true },
    );
    proofFields = {
      proofPathname: blob.pathname,
      proofFilename: safeName,
      proofMimeType: proof.type,
      proofBytes: proof.size,
    };
  }
  const [settings] = await getDb()
    .select()
    .from(membershipSettings)
    .where(eq(membershipSettings.id, "membership"))
    .limit(1);
  const [dues] = await getDb()
    .insert(membershipDues)
    .values({
      memberId,
      period,
      coverageType,
      amountDueCents:
        coverageType === "ANNUAL"
          ? settings?.annualDuesCents ?? 5_000
          : settings?.semesterDuesCents ?? 3_000,
      updatedByMemberId: actor.id,
    })
    .onConflictDoUpdate({
      target: [membershipDues.memberId, membershipDues.period],
      set: { coverageType, updatedByMemberId: actor.id, updatedAt: new Date() },
    })
    .returning();
  const receiptNumber = `210-${period.slice(0, 4)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const [payment] = await getDb()
    .insert(membershipDuesPayments)
    .values({
      membershipDuesId: dues.id,
      memberId,
      paymentType: coverageType === "ANNUAL" ? "ANNUAL_DUES" : "SEMESTER_DUES",
      coverageType,
      coveragePeriod: period,
      paymentMethod,
      paymentDate,
      transactionReference: transactionReference || null,
      receiptNumber,
      enteredByMemberId: actor.id,
      notes,
      ...proofFields,
      amountCents,
      status: "PAID",
      paidAt: paymentDate,
    })
    .returning();
  await recalculateMembershipDues(dues.id);
  await reconcileMemberMembership(memberId);
  await syncDiscordDuesAccessForMember(memberId).catch((error) => {
    console.error("Discord access did not synchronize after manual payment", {
      memberId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "MEMBERSHIP_DUES_PAYMENT_ADD",
    entityType: "membership_dues_payment",
    entityId: payment.id,
    details: { memberId, period, amountCents, paymentMethod, receiptNumber },
  });
  revalidatePath("/admin");
  revalidatePath("/portal");
}

export async function setDiscordGuildName(formData: FormData) {
  const actor = await requirePermission("integrations.manage");
  const guildId = required(formData, "guildId");
  const name = required(formData, "name").slice(0, 100);
  await getDb()
    .update(discordGuilds)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(discordGuilds.id, guildId)));
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "DISCORD_GUILD_RENAME",
    entityType: "discord_guild",
    entityId: guildId,
    details: { name },
  });
  revalidatePath("/admin");
}
