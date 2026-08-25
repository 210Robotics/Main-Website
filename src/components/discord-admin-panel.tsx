import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  discordCalendarReminders,
  discordChannels,
  discordDirectMessages,
  discordEvents,
  discordGuildMembers,
  discordGuilds,
  discordMessages,
  discordVerificationApplications,
  members,
} from "@/db/schema";
import {
  registerDiscordCommandsAction,
  postDiscordRecordingPolicy,
  postDiscordVerificationPanel,
  processDiscordOnboardingNow,
  retryDiscordOnboardingRoles,
  saveDiscordDuesAccessSettings,
  saveDiscordOnboardingSettings,
  saveDiscordSettings,
  saveDiscordReactionSettings,
  sendAllDiscordReminders,
  sendCalendarRemindersNow,
  sendDiscordBroadcastReminder,
  sendDiscordReminder,
  sendMonthlyCalendarDigestNow,
  syncDiscordNow,
  syncDiscordMessagesNow,
  syncDiscordDuesAccessNow,
  updateDiscordChannelSlowmode,
  updateDiscordMemberDmSettings,
  updateDiscordMemberTimeout,
} from "@/app/admin/discord-actions";
import { ActionForm } from "@/components/action-form";
import { DiscordConnectForm } from "@/components/discord-connect-form";
import { DiscordDmReplyForm } from "@/components/discord-dm-reply-form";
import { DiscordMessageComposer } from "@/components/discord-message-composer";
import { DiscordMemberDmComposer } from "@/components/discord-member-dm-composer";
import { DiscordMeetingTranscription } from "@/components/discord-meeting-transcription";
import { DiscordBrowserRecorder } from "@/components/discord-browser-recorder";
import { DiscordOrganizationDebrief } from "@/components/discord-organization-debrief";
import { DiscordSectionMenu } from "@/components/discord-section-menu";
import { DiscordVoiceSpeaker } from "@/components/discord-voice-speaker";
import { requirePermission } from "@/lib/auth";
import {
  checkDiscordGuildAccess,
  discordConfiguration,
  inferDiscordDuesPublicChannelIds,
  listDiscordGuildRoles,
  listDiscordVoiceChannels,
} from "@/lib/discord";
import { inferDiscordOnboardingRoleIds } from "@/lib/discord-role-selection";
import { discordVoiceWorkerConfiguration } from "@/lib/discord-voice-worker";

function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Not yet";
}

export async function DiscordAdminPanel({
  searchQuery = "",
  recordingTitle = "",
  voiceChannelId = "",
}: {
  searchQuery?: string;
  recordingTitle?: string;
  voiceChannelId?: string;
}) {
  const actor = await requirePermission("integrations.manage");
  const [guild] = await getDb()
    .select()
    .from(discordGuilds)
    .orderBy(desc(discordGuilds.updatedAt))
    .limit(1);
  const safeSearch = searchQuery.trim().slice(0, 100);
  const messageFilter = guild
    ? and(
        eq(discordMessages.guildId, guild.id),
        isNull(discordMessages.deletedAt),
        safeSearch
          ? or(
              ilike(discordMessages.content, `%${safeSearch}%`),
              ilike(discordMessages.authorDisplayName, `%${safeSearch}%`),
              ilike(discordMessages.authorUsername, `%${safeSearch}%`),
              ilike(discordMessages.channelName, `%${safeSearch}%`),
            )
          : undefined,
      )
    : undefined;
  const [
    discordMembers,
    recentEvents,
    websiteMembers,
    channelRows,
    messageRows,
    directMessageRows,
    messageCount,
    topAuthors,
    topChannels,
    reminderRows,
    liveVoiceChannels,
    guildRoles,
    verificationApplications,
  ] = await Promise.all([
    guild
      ? getDb()
          .select({
            discord: discordGuildMembers,
            memberName: members.displayName,
            memberEmail: members.email,
            recentlyReminded: sql<boolean>`${discordGuildMembers.registrationReminderSentAt} > now() - interval '14 days'`,
          })
          .from(discordGuildMembers)
          .leftJoin(members, eq(members.id, discordGuildMembers.linkedMemberId))
          .where(
            and(
              eq(discordGuildMembers.guildId, guild.id),
              eq(discordGuildMembers.isBot, false),
              isNull(discordGuildMembers.leftAt),
            ),
          )
          .orderBy(desc(discordGuildMembers.lastSeenAt))
      : Promise.resolve([]),
    getDb()
      .select()
      .from(discordEvents)
      .where(
        gte(
          discordEvents.createdAt,
          sql`now() - interval '30 days'`,
        ),
      )
      .orderBy(desc(discordEvents.createdAt))
      .limit(100),
    getDb()
      .select({
        id: members.id,
        displayName: members.displayName,
        email: members.email,
        accessRole: members.accessRole,
      })
      .from(members)
      .where(eq(members.status, "ACTIVE"))
      .orderBy(members.displayName),
    guild
      ? getDb()
          .select()
          .from(discordChannels)
          .where(eq(discordChannels.guildId, guild.id))
          .orderBy(discordChannels.position, discordChannels.name)
      : Promise.resolve([]),
    guild && messageFilter
      ? getDb()
          .select({
            message: discordMessages,
            memberName: members.displayName,
          })
          .from(discordMessages)
          .leftJoin(members, eq(members.id, discordMessages.linkedMemberId))
          .where(messageFilter)
          .orderBy(desc(discordMessages.discordCreatedAt))
          .limit(250)
      : Promise.resolve([]),
    getDb()
      .select()
      .from(discordDirectMessages)
      .orderBy(desc(discordDirectMessages.discordCreatedAt))
      .limit(1_000),
    guild
      ? getDb()
          .select({ value: count() })
          .from(discordMessages)
          .where(
            and(
              eq(discordMessages.guildId, guild.id),
              isNull(discordMessages.deletedAt),
            ),
          )
      : Promise.resolve([]),
    guild
      ? getDb()
          .select({
            name: discordMessages.authorDisplayName,
            value: count(),
          })
          .from(discordMessages)
          .where(
            and(
              eq(discordMessages.guildId, guild.id),
              eq(discordMessages.authorIsBot, false),
              isNull(discordMessages.deletedAt),
            ),
          )
          .groupBy(discordMessages.authorDisplayName)
          .orderBy(desc(count()))
          .limit(5)
      : Promise.resolve([]),
    guild
      ? getDb()
          .select({
            name: discordMessages.channelName,
            value: count(),
          })
          .from(discordMessages)
          .where(
            and(
              eq(discordMessages.guildId, guild.id),
              isNull(discordMessages.deletedAt),
            ),
          )
          .groupBy(discordMessages.channelName)
          .orderBy(desc(count()))
          .limit(5)
      : Promise.resolve([]),
    guild
      ? getDb()
          .select()
          .from(discordCalendarReminders)
          .where(eq(discordCalendarReminders.guildId, guild.id))
          .orderBy(desc(discordCalendarReminders.sentAt))
          .limit(5)
      : Promise.resolve([]),
    guild
      ? listDiscordVoiceChannels(guild.id).catch((error: unknown) => {
          console.error("Discord voice channel refresh failed", error);
          return [];
        })
      : Promise.resolve([]),
    guild
      ? listDiscordGuildRoles(guild.id).catch((error: unknown) => {
          console.error("Discord role refresh failed", error);
          return [];
        })
      : Promise.resolve([]),
    guild
      ? getDb()
          .select()
          .from(discordVerificationApplications)
          .where(eq(discordVerificationApplications.guildId, guild.id))
          .orderBy(desc(discordVerificationApplications.submittedAt))
          .limit(100)
      : Promise.resolve([]),
  ]);
  const linked = discordMembers.filter((row) => row.discord.linkedMemberId);
  const unlinked = discordMembers.filter(
    (row) => !row.discord.linkedMemberId,
  );
  const linkedWebsiteMemberIds = new Set(
    linked
      .map((row) => row.discord.linkedMemberId)
      .filter((id): id is string => Boolean(id)),
  );
  const websiteOnlyMembers = websiteMembers.filter(
    (member) => !linkedWebsiteMemberIds.has(member.id),
  );
  const directMessageConversationMap = new Map<
    string,
    {
      discordUserId: string;
      displayName: string;
      username: string;
      messages: typeof directMessageRows;
    }
  >();
  for (const message of directMessageRows) {
    const conversation = directMessageConversationMap.get(
      message.discordUserId,
    ) || {
      discordUserId: message.discordUserId,
      displayName: message.displayName,
      username: message.username,
      messages: [],
    };
    conversation.messages.push(message);
    directMessageConversationMap.set(message.discordUserId, conversation);
  }
  const directMessageConversations = [
    ...directMessageConversationMap.values(),
  ].map((conversation) => ({
    ...conversation,
    messages: conversation.messages.reverse(),
  }));
  const commandUses = recentEvents.filter(
    (event) => event.kind === "COMMAND_USED",
  ).length;
  const registrationDms = recentEvents.filter(
    (event) => event.kind === "REGISTRATION_DM_SENT",
  ).length;
  const configuration = discordConfiguration();
  const voiceWorker = discordVoiceWorkerConfiguration();
  const guildAccess =
    guild && configuration.botToken
      ? await checkDiscordGuildAccess(guild.id)
      : null;
  const interactionEndpoint =
    "https://210robotics.com/api/discord/interactions";
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const configuredGuildId = guild?.id || process.env.DISCORD_GUILD_ID;
  const installUrl = applicationId
    ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(applicationId)}&permissions=8&scope=bot%20applications.commands${
        configuredGuildId
          ? `&guild_id=${encodeURIComponent(configuredGuildId)}&disable_guild_select=true`
          : ""
      }`
    : null;
  const botSettingsUrl = applicationId
    ? `https://discord.com/developers/applications/${encodeURIComponent(applicationId)}/bot`
    : null;
  const voiceChannelOptions = liveVoiceChannels.length
    ? liveVoiceChannels
    : channelRows
        .filter((channel) => [2, 13].includes(channel.type))
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
        }));
  const onboardingRoles = inferDiscordOnboardingRoleIds(guildRoles, {
    agreedRoleId: guild?.agreedRoleId,
    vexUMemberRoleId: guild?.vexUMemberRoleId,
  });
  const selectableGuildRoles = guildRoles.filter(
    (role) => !role.managed && role.name !== "@everyone",
  );
  const awaitingSecurityDelay = discordMembers.filter(
    ({ discord }) =>
      discord.securityDelayEndsAt &&
      !discord.securityDelayNotificationSentAt,
  ).length;
  const onboardingRoleIssues = discordMembers.filter(
    ({ discord }) => Boolean(discord.onboardingRoleError),
  );
  const duesChannelOptions = channelRows.filter(
    (channel) => [0, 2, 5, 13, 15].includes(channel.type) && !channel.archived,
  );
  const selectedDuesPublicChannelIds = new Set(
    guild?.duesPublicChannelIds.length
      ? guild.duesPublicChannelIds
      : inferDiscordDuesPublicChannelIds(duesChannelOptions),
  );

  return (
    <section className="card mt-7 min-w-0 p-5 sm:p-6 md:p-8">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="eyebrow">Website + server connection</p>
          <h2 className="mt-4 text-2xl font-bold">Discord integration</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">
            Match Discord identities to member accounts, compare membership
            totals, and privately remind individual unregistered people.
          </p>
        </div>
        <span
          className={
            configuration.botToken && guildAccess?.ok
              ? "tag border-emerald-700 text-emerald-300"
              : "tag border-amber-700 text-amber-300"
          }
        >
          {!configuration.botToken
            ? "Bot token needed"
            : guildAccess?.ok
              ? "Bot ready"
              : "Discord authorization needed"}
        </span>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric value={websiteMembers.length} label="Active website members" />
        <Metric value={discordMembers.length} label="Discord members" />
        <Metric value={linked.length} label="Linked identities" />
        <Metric value={unlinked.length} label="Need registration" />
        <Metric value={messageCount[0]?.value ?? 0} label="Logged messages" />
        <Metric value={commandUses} label="30-day command uses" />
      </div>
      <DiscordSectionMenu />

      {!configuration.botToken && (
        <div className="mt-6 border border-amber-800/70 bg-amber-950/20 p-5">
          <strong className="text-amber-200">
            The public endpoint is ready, but Discord cannot be synchronized
            or send DMs yet.
          </strong>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            Add the bot token as <code>DISCORD_BOT_TOKEN</code> in the hosting
            environment and enable Discord&apos;s Server Members Intent. The
            Application ID and request-signing key are already detected.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {botSettingsUrl && (
              <a
                className="button secondary"
                href={botSettingsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Discord bot settings
              </a>
            )}
            <a
              className="button secondary"
              href="https://vercel.com/210robotics/210_robotics/settings/environment-variables"
              target="_blank"
              rel="noreferrer"
            >
              Open Vercel environment settings
            </a>
          </div>
        </div>
      )}
      {configuration.botToken && guild && guildAccess && !guildAccess.ok && (
        <div className="mt-6 border border-amber-800/70 bg-amber-950/20 p-5">
          <strong className="text-amber-200">
            The bot token is valid, but this server has not authorized the bot.
          </strong>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            {guildAccess.reason} Use the authorization button below with a
            Discord server administrator account. Discord requires this consent
            before commands, channels, messages, or members can be accessed.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            If Discord reports <strong>&quot;Integration requires code grant&quot;</strong>,
            open the Bot settings and turn off{" "}
            <strong>&quot;Requires OAuth2 Code Grant&quot;</strong>. This
            server-only bot does not request a Discord user access token.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
          {installUrl && (
            <a
              className="button inline-flex"
              href={installUrl}
              target="_blank"
              rel="noreferrer"
            >
              Authorize bot in 210 Robotics server
            </a>
          )}
            {botSettingsUrl && (
              <a
                className="button secondary inline-flex"
                href={botSettingsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Discord bot settings
              </a>
            )}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border border-[#333] bg-[#0d0d0d] p-4 text-xs leading-6 text-[#999]">
        <span>Discord verification links:</span>
        <a className="text-[#fd7803] underline" href="https://210robotics.com/privacy" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        <a className="text-[#fd7803] underline" href="https://210robotics.com/terms" target="_blank" rel="noreferrer">
          Terms of Service
        </a>
        <span>Permission integer: 8</span>
      </div>
      <div className="mt-4 border border-blue-900/60 bg-blue-950/20 p-4 text-sm leading-6 text-blue-100/75">
        To log message text, enable Discord&apos;s{" "}
        <strong className="text-blue-100">Message Content Intent</strong> and
        give the bot View Channel + Read Message History access. Private DMs
        are securely copied into the private admin inbox below and answered by
        the configured Gemini workflow. After a new human-authored server
        message is successfully logged, the bot can add the automatic reaction
        selected below. The bot also needs Add Reactions access.
      </div>
      {guild && (
        <ActionForm
          action={saveDiscordReactionSettings}
          successMessage="Automatic message reaction settings saved."
          className="mt-4 grid gap-4 border border-[#343434] bg-[#0d0d0d] p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(12rem,.4fr)_auto]"
        >
          <input type="hidden" name="guildId" value={guild.id} />
          <label className="flex items-start gap-3 text-sm leading-6 text-[#bbb]">
            <input
              className="mt-1.5"
              type="checkbox"
              name="reactionEnabled"
              defaultChecked={guild.messageReactionEnabled}
            />
            <span>
              <strong className="block text-white">
                React after each message is logged
              </strong>
              Turn this off to remove the automatic reaction from future
              messages.
            </span>
          </label>
          <label className="field">
            <span>Reaction emoji</span>
            <input
              className="input text-xl"
              name="reactionEmoji"
              defaultValue={guild.messageReactionEmoji}
              maxLength={32}
              aria-label="Automatic Discord reaction emoji"
              required
            />
          </label>
          <button className="button w-full justify-center md:self-end">
            Save reaction
          </button>
        </ActionForm>
      )}

      <div
        className="mt-7 scroll-mt-28 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"
        id="discord-overview"
      >
        <div className="border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
            Connected server
          </p>
          {guild ? (
            <>
              <h3 className="mt-3 text-xl font-bold">{guild.name}</h3>
              <p className="mt-1 font-mono text-xs text-[#666]">
                Server ID {guild.id} · automatically linked
              </p>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <Status
                  label="Last member sync"
                  value={formatDate(guild.lastSyncedAt)}
                />
                <Status
                  label="Registration DMs (30 days)"
                  value={String(registrationDms)}
                />
                <Status
                  label="Calendar reminders"
                  value={
                    guild.calendarAnnouncementsEnabled ? "Enabled" : "Paused"
                  }
                />
                <Status label="Application ID" value="Configured" />
                <Status
                  label="Bot authentication"
                  value={configuration.botToken ? "Configured" : "Missing"}
                />
                <Status
                  label="Discord server access"
                  value={guildAccess?.ok ? "Authorized" : "Authorization needed"}
                />
              </dl>
              {installUrl && (
                <a
                  className="button secondary mt-6 inline-flex"
                  href={installUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Authorize bot in this server
                </a>
              )}
              {configuration.botToken && guildAccess?.ok ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <ActionForm
                    action={syncDiscordNow}
                    successMessage="Discord members synchronized."
                  >
                    <input type="hidden" name="guildId" value={guild.id} />
                    <button className="button w-full justify-center sm:w-auto">
                      Sync members now
                    </button>
                  </ActionForm>
                  <ActionForm
                    action={registerDiscordCommandsAction}
                    successMessage="Discord commands registered."
                  >
                    <input type="hidden" name="guildId" value={guild.id} />
                    <button className="button secondary w-full justify-center sm:w-auto">
                      Install slash commands
                    </button>
                  </ActionForm>
                  <ActionForm
                    action={syncDiscordMessagesNow}
                    successMessage="Discord message log synchronized."
                  >
                    <input type="hidden" name="guildId" value={guild.id} />
                    <button className="button secondary w-full justify-center sm:w-auto">
                      Sync message log
                    </button>
                  </ActionForm>
                </div>
              ) : !configuration.botToken ? (
                <p className="mt-4 border border-amber-900/70 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100/70">
                  The server link is saved. Sync and command controls will
                  appear automatically after <code>DISCORD_BOT_TOKEN</code> is
                  added to Vercel and the site is redeployed.
                </p>
              ) : (
                <p className="mt-4 border border-amber-900/70 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100/70">
                  The server ID and bot token are saved. Authorize the bot in
                  this server to unlock command installation, member sync, the
                  message log, and the channel composer.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-4 text-sm leading-7 text-[#999]">
                Add the bot to the team server, then enter the Discord Server
                ID to install its commands and synchronize the roster.
              </p>
              <DiscordConnectForm
                installUrl={installUrl}
                botTokenConfigured={configuration.botToken}
              />
            </>
          )}
        </div>
        <div className="border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
            Discord developer setup
          </p>
          <p className="mt-3 text-sm leading-6 text-[#999]">
            Set this as the application&apos;s Interactions Endpoint URL:
          </p>
          <code className="mt-4 block overflow-x-auto border border-[#333] bg-black p-3 text-xs text-[#ddd]">
            {interactionEndpoint}
          </code>
          <p className="mt-4 text-xs leading-6 text-[#777]">
            Available commands: /ask, /record, /stopall, /setup, /register,
            /status, /dues, and /team. /ask is powered only by the configured
            Gemini service. /record joins and records the selected voice
            channel; /stopall finalizes every active recording. Account links
            are private, expire after seven days, and work once.
          </p>
        </div>
      </div>

      {guild && (
        <div
          className="mt-7 scroll-mt-28 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
          id="discord-dues-access"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
                Membership dues + Discord permissions
              </p>
              <h3 className="mt-3 text-xl font-bold">Paid member access</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
                In transition mode, dues do not change channel access. When
                enforcement is enabled, the bot creates Membership Paid and
                Membership Not Paid roles, keeps the selected public channels
                visible, and hides other channels from unpaid members.
                Administrators, officers, directors, leads, and bots are always
                exempt.
              </p>
            </div>
            <span
              className={
                guild.duesEnforcementEnabled
                  ? "tag border-emerald-700 text-emerald-300"
                  : "tag border-blue-700 text-blue-300"
              }
            >
              {guild.duesEnforcementEnabled
                ? "Payment enforcement on"
                : "Transition mode"}
            </span>
          </div>

          <ActionForm
            action={saveDiscordDuesAccessSettings}
            successMessage="Membership access settings saved and Discord roles synchronized."
            className="mt-6 grid gap-5"
          >
            <input type="hidden" name="guildId" value={guild.id} />
            <label className="flex items-start gap-3 border border-[#343434] bg-black/30 p-4 text-sm leading-6 text-[#bbb]">
              <input
                className="mt-1.5"
                type="checkbox"
                name="duesEnforcementEnabled"
                defaultChecked={guild.duesEnforcementEnabled}
              />
              <span>
                <strong className="block text-white">
                  Require paid or waived dues for private Discord channels
                </strong>
                Leave this off during a transition period. Turning it off
                removes the payment restriction from members without changing
                officer or server permissions.
              </span>
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-white">
                Channels everyone can still access
              </legend>
              <p className="mt-2 text-xs leading-5 text-[#777]">
                General and announcements are selected automatically the first
                time. Review this list before turning enforcement on.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {duesChannelOptions.map((channel) => (
                  <label
                    className="flex min-w-0 items-center gap-3 border border-[#303030] bg-[#111] p-3 text-sm text-[#bbb]"
                    key={channel.id}
                  >
                    <input
                      type="checkbox"
                      name="publicChannelId"
                      value={channel.id}
                      defaultChecked={selectedDuesPublicChannelIds.has(channel.id)}
                    />
                    <span className="truncate">#{channel.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="button justify-center">
                Save and apply access rules
              </button>
            </div>
          </ActionForm>
          <ActionForm
            action={syncDiscordDuesAccessNow}
            successMessage="Discord membership access synchronized."
            className="mt-3"
          >
            <input type="hidden" name="guildId" value={guild.id} />
            <button className="button secondary w-full justify-center sm:w-auto">
              Recheck every member now
            </button>
          </ActionForm>
          <p className="mt-4 text-xs leading-5 text-[#777]">
            Last synchronized: {formatDate(guild.duesLastSyncedAt)}. Stripe
            payments, waivers, manual dues updates, and newly linked Discord
            accounts also trigger a member-level access check automatically.
          </p>
        </div>
      )}

      {guild && (
        <div
          className="mt-7 scroll-mt-28 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
          id="discord-onboarding"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
                Join DM and automatic access
              </p>
              <h3 className="mt-3 text-xl font-bold">
                Member onboarding
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
                New members receive a private welcome and portal-link message
                immediately. After the ten-minute security delay, the bot sends
                an unlock notice and adds both selected roles as soon as their
                Discord identity is linked.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <Status
                label="Waiting for unlock"
                value={String(awaitingSecurityDelay)}
              />
              <Status
                label="Role issues"
                value={String(onboardingRoleIssues.length)}
              />
            </div>
          </div>
          <ActionForm
            action={saveDiscordOnboardingSettings}
            successMessage="Discord onboarding settings saved."
            className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem_auto]"
          >
            <input type="hidden" name="guildId" value={guild.id} />
            <label className="field">
              <span>Agreement role</span>
              <select
                className="input"
                name="agreedRoleId"
                defaultValue={onboardingRoles.agreedRoleId ?? ""}
                required
              >
                <option value="" disabled>
                  Select the Agreed role
                </option>
                {selectableGuildRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>VEX U member role</span>
              <select
                className="input"
                name="vexUMemberRoleId"
                defaultValue={onboardingRoles.vexUMemberRoleId ?? ""}
                required
              >
                <option value="" disabled>
                  Select the VEX U Member role
                </option>
                {selectableGuildRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Security delay</span>
              <select
                className="input"
                name="securityDelayMinutes"
                defaultValue={String(guild.securityDelayMinutes)}
              >
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm text-[#bbb] xl:self-end xl:pb-3">
              <input
                type="checkbox"
                name="onboardingEnabled"
                defaultChecked={guild.onboardingEnabled}
              />
              Welcome DMs enabled
            </label>
            <button
              className="button justify-center md:w-fit"
              disabled={!selectableGuildRoles.length}
            >
              Save onboarding
            </button>
          </ActionForm>
          {!selectableGuildRoles.length && (
            <p className="mt-4 border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-100/75">
              Discord roles could not be loaded. Confirm the bot has Manage
              Roles and Server Members access, then refresh this page.
            </p>
          )}
          <ActionForm
            action={processDiscordOnboardingNow}
            successMessage="Due onboarding notices and role assignments were checked."
            className="mt-4"
          >
            <input type="hidden" name="guildId" value={guild.id} />
            <button className="button secondary w-full justify-center sm:w-auto">
              Check due unlocks now
            </button>
          </ActionForm>
          {!!onboardingRoleIssues.length && (
            <div className="mt-6 border-t border-[#303030] pt-5">
              <h4 className="text-sm font-bold text-white">
                Role assignment needs attention
              </h4>
              <div className="mt-3 grid gap-2">
                {onboardingRoleIssues.slice(0, 20).map(({ discord }) => (
                  <div
                    className="flex flex-col gap-3 border border-[#2d2d2d] bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                    key={discord.id}
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-white">
                        {discord.displayName}
                      </strong>
                      <span className="mt-1 block text-xs leading-5 text-[#888]">
                        {discord.onboardingRoleError}
                      </span>
                    </div>
                    {discord.linkedMemberId && (
                      <ActionForm
                        action={retryDiscordOnboardingRoles}
                        successMessage={`Roles assigned to ${discord.displayName}.`}
                      >
                        <input type="hidden" name="guildId" value={guild.id} />
                        <input
                          type="hidden"
                          name="discordUserId"
                          value={discord.discordUserId}
                        />
                        <button className="button secondary w-full justify-center sm:w-auto">
                          Retry roles
                        </button>
                      </ActionForm>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {guild && (
        <div
          className="mt-7 scroll-mt-28 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
          id="discord-calendar"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
                Google Calendar → Discord
              </p>
              <h3 className="mt-3 text-xl font-bold">
                Upcoming event announcements
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#888]">
                The existing 210 Google Calendar feed is refreshed before each
                reminder run. Each event is announced once in the selected
                channel as its start approaches and tags @everyone.
              </p>
            </div>
            <span className="tag">
              {reminderRows.length
                ? `Last sent ${formatDate(reminderRows[0].sentAt)}`
                : "No reminders sent yet"}
            </span>
          </div>
          <ActionForm
            action={saveDiscordSettings}
            successMessage="Calendar announcement settings saved."
            className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]"
          >
            <input type="hidden" name="guildId" value={guild.id} />
            <label className="field">
              <span>Calendar reminder channel</span>
              <select
                className="input"
                name="generalChannelId"
                defaultValue={guild.generalChannelId ?? ""}
                required
              >
                <option value="" disabled>
                  Select a synchronized channel
                </option>
                {channelRows
                  .filter((channel) => [0, 5].includes(channel.type))
                  .map((channel) => (
                    <option value={channel.id} key={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Announce this many hours before</span>
              <input
                className="input"
                name="reminderHours"
                type="number"
                min="1"
                max="168"
                defaultValue={guild.calendarReminderHours}
                required
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-[#bbb] md:self-end md:pb-3">
              <input
                type="checkbox"
                name="announcementsEnabled"
                defaultChecked={guild.calendarAnnouncementsEnabled}
              />
              Announcements enabled
            </label>
            <button className="button justify-center md:w-fit">
              Save reminder settings
            </button>
          </ActionForm>
          <ActionForm
            action={sendCalendarRemindersNow}
            successMessage="Upcoming events checked; eligible reminders sent."
            className="mt-3"
          >
            <input type="hidden" name="guildId" value={guild.id} />
            <button
              className="button secondary w-full justify-center sm:w-auto"
              disabled={
                !configuration.botToken || !guild.generalChannelId
              }
            >
              Check and announce upcoming events now
            </button>
          </ActionForm>
          <div className="mt-5 border-t border-[#303030] pt-5">
            <h4 className="text-sm font-bold text-white">
              Upcoming-month digest
            </h4>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
              On or after the 25th, the daily Google Calendar sync posts one
              digest containing every event scheduled for the following month.
              It uses this same channel, tags @everyone once, and will not
              duplicate a month.
            </p>
            <a
              className="button secondary mt-4 inline-flex w-full justify-center sm:w-auto"
              href="https://calendar.google.com/calendar/embed?src=c_95f57b77ce9cc3321b6d5ee44042d9f8920481babe4dd9e33f511458453f721e%40group.calendar.google.com&ctz=America%2FChicago"
              target="_blank"
              rel="noreferrer"
            >
              Open connected Google Calendar
            </a>
            <ActionForm
              action={sendMonthlyCalendarDigestNow}
              successMessage="The upcoming-month digest was checked and sent if it was not already posted."
              className="mt-3"
            >
              <input type="hidden" name="guildId" value={guild.id} />
              <button
                className="button secondary w-full justify-center sm:w-auto"
                disabled={
                  !configuration.botToken || !guild.generalChannelId
                }
              >
                Send upcoming-month digest now
              </button>
            </ActionForm>
          </div>
        </div>
      )}

      {guild && (
        <div
          className="mt-7 scroll-mt-28 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
          id="discord-moderation"
        >
          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <p className="eyebrow">Permission-protected moderation</p>
              <h3 className="mt-3 text-xl font-bold">
                Timeout, mute &amp; slowmode
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#999]">
                Temporarily mute a member across the server with a Discord
                timeout, or slow down messages in one text channel. Discord
                records the reason in its audit log, and the portal keeps its
                own administrator activity record.
              </p>
            </div>
            <div className="grid min-w-0 gap-5">
              <ActionForm
                action={updateDiscordMemberTimeout}
                successMessage="The Discord member timeout was updated."
                className="grid min-w-0 gap-4 border border-[#343434] bg-black/40 p-4 sm:p-5"
              >
                <input type="hidden" name="guildId" value={guild.id} />
                <label className="field">
                  <span>Discord member</span>
                  <select className="input" name="guildMemberId" required>
                    <option value="">Select a member</option>
                    {discordMembers.map(({ discord, memberName }) => (
                      <option value={discord.id} key={discord.id}>
                        {memberName || discord.displayName} (@{discord.username})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Timeout / server mute length</span>
                  <select
                    className="input"
                    name="durationMinutes"
                    defaultValue="30"
                    required
                  >
                    <option value="5">5 minutes</option>
                    <option value="10">10 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="360">6 hours</option>
                    <option value="1440">1 day</option>
                    <option value="10080">7 days</option>
                    <option value="40320">28 days</option>
                    <option value="0">Clear current timeout</option>
                  </select>
                </label>
                <label className="field">
                  <span>Reason (recommended)</span>
                  <textarea
                    className="input min-h-24"
                    name="reason"
                    maxLength={400}
                    placeholder="Brief moderation reason for the Discord and website audit logs"
                  />
                </label>
                <button
                  className="button w-full justify-center sm:w-fit"
                  disabled={!configuration.botToken}
                >
                  Apply member timeout
                </button>
              </ActionForm>
              <ActionForm
                action={updateDiscordChannelSlowmode}
                successMessage="The Discord channel slowmode was updated."
                className="grid min-w-0 gap-4 border border-[#343434] bg-black/40 p-4 sm:p-5"
              >
                <input type="hidden" name="guildId" value={guild.id} />
                <label className="field">
                  <span>Text channel</span>
                  <select className="input" name="channelId" required>
                    <option value="">Select a channel</option>
                    {channelRows
                      .filter((channel) => [0, 5].includes(channel.type))
                      .map((channel) => (
                        <option value={channel.id} key={channel.id}>
                          #{channel.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>Slowmode interval</span>
                  <select
                    className="input"
                    name="seconds"
                    defaultValue="30"
                    required
                  >
                    <option value="0">Off</option>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="15">15 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="120">2 minutes</option>
                    <option value="300">5 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="3600">1 hour</option>
                    <option value="21600">6 hours</option>
                  </select>
                </label>
                <label className="field">
                  <span>Reason (recommended)</span>
                  <input
                    className="input"
                    name="reason"
                    maxLength={400}
                    placeholder="Why this channel is being slowed down"
                  />
                </label>
                <button
                  className="button secondary w-full justify-center sm:w-fit"
                  disabled={!configuration.botToken}
                >
                  Apply channel slowmode
                </button>
              </ActionForm>
            </div>
          </div>
        </div>
      )}

      {guild && (
        <div
          className="mt-7 scroll-mt-28 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
          id="discord-transcription"
        >
          <div className="mb-6 border border-[#4a321e] bg-[#17100a] p-4 sm:p-5">
            <p className="eyebrow">Discord bot voice recorder</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold">/record voice workflow</h3>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#aaa]">
                  The slash command asks the always-on bot worker to join the
                  selected voice channel. After every member leaves, it mixes
                  each member&apos;s isolated audio with their Discord display
                  name, sends the labeled tracks to Gemini, archives the audio
                  plus Word and Markdown transcripts, and posts all download
                  links in #Botlogs. Screen sharing is handled separately
                  below.
                </p>
              </div>
              <span
                className={
                  voiceWorker.configured
                    ? "tag border-emerald-700 text-emerald-300"
                    : "tag border-amber-700 text-amber-300"
                }
              >
                {voiceWorker.configured
                  ? "Voice worker connected"
                  : "Voice worker host needed"}
              </span>
            </div>
          </div>
          <DiscordVoiceSpeaker
            guildId={guild.id}
            voiceChannels={voiceChannelOptions}
            configured={voiceWorker.configured}
          />
          <DiscordMeetingTranscription
            guildId={guild.id}
            uploaderId={actor.id}
          />
          <DiscordBrowserRecorder
            guildId={guild.id}
            uploaderId={actor.id}
            initialTitle={recordingTitle}
            initialVoiceChannelId={voiceChannelId}
            voiceChannels={voiceChannelOptions}
          />
          <div className="mt-6 border-t border-[#303030] pt-5">
            <p className="text-sm font-bold text-white">
              Member verification application
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
              Post the current/new-member verification embed in
              #rules-and-expectations. Its button opens a Discord application,
              then directs the member to Clerk for verified UTSA identity,
              account linking, and confirmed dues or fundraising-waiver review.
            </p>
            <ActionForm
              action={postDiscordVerificationPanel}
              successMessage="Verification application posted in #rules-and-expectations."
              className="mt-3"
            >
              <input type="hidden" name="guildId" value={guild.id} />
              <button
                className="button w-full justify-center sm:w-auto"
                disabled={!configuration.botToken}
              >
                Post verification application
              </button>
            </ActionForm>
          </div>
          <div className="mt-6 border-t border-[#303030] pt-5">
            <p className="text-sm font-bold text-white">
              Permanent Discord recording policy
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
              Post the consent-based recording policy in
              #rules-and-expectations. The notice explains that sessions are
              announced, require participant consent, and are never recorded
              automatically merely because someone joins voice.
            </p>
            <ActionForm
              action={postDiscordRecordingPolicy}
              successMessage="Recording policy posted in #rules-and-expectations."
              className="mt-3"
            >
              <input type="hidden" name="guildId" value={guild.id} />
              <button
                className="button secondary w-full justify-center sm:w-auto"
                disabled={!configuration.botToken}
              >
                Post recording policy
              </button>
            </ActionForm>
          </div>
        </div>
      )}

      {guild && (
        <div
          className="mt-7 scroll-mt-28 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
          id="discord-channel-messages"
        >
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
            Admin announcement composer
          </p>
          <h3 className="mt-3 text-xl font-bold">
            Send a Discord message as the bot
          </h3>
          <p className="mb-6 mt-2 max-w-3xl text-sm leading-6 text-[#888]">
            Choose any text channel or active thread visible to the bot. Insert
            people from the synchronized Discord roster to send real,
            controlled notifications.
          </p>
          <DiscordMessageComposer
            guildId={guild.id}
            channels={channelRows
              .filter((channel) =>
                [0, 5, 10, 11, 12].includes(channel.type),
              )
              .map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
              }))}
            people={discordMembers.map(({ discord }) => ({
              discordUserId: discord.discordUserId,
              displayName: discord.displayName,
              username: discord.username,
            }))}
          />
        </div>
      )}

      <div
        className="mt-8 scroll-mt-28 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
        id="discord-private-dms"
      >
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
          Shared bot inbox
        </p>
        <h3 className="mt-3 text-xl font-bold sm:text-2xl">
          Continue private conversations as the 210 Bot
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
          Every private message sent to the bot is logged here. Gemini receives
          the recent conversation context and can answer in the same Discord
          DM. Admins can also read the shared history, reply personally as the
          bot, or start a new conversation without leaving the portal.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            value={directMessageConversations.length}
            label="Private conversations"
          />
          <Metric
            value={
              directMessageRows.filter(
                (message) => message.direction === "INBOUND",
              ).length
            }
            label="Member messages"
          />
          <Metric
            value={
              directMessageRows.filter((message) => message.aiGenerated).length
            }
            label="Gemini replies"
          />
          <Metric
            value={
              directMessageRows.filter(
                (message) =>
                  message.direction === "OUTBOUND" && !message.aiGenerated,
              ).length
            }
            label="Manual bot replies"
          />
        </div>
        {guild && (
          <details className="mt-5 min-w-0 border border-[#6f3b11] bg-[#15100c]">
            <summary className="cursor-pointer p-4 font-bold text-white sm:p-5">
              Start a new private conversation
            </summary>
            <DiscordDmReplyForm
              guildId={guild.id}
              configured={Boolean(configuration.botToken)}
              recipients={discordMembers.map(({ discord }) => ({
                discordUserId: discord.discordUserId,
                displayName: discord.displayName,
                username: discord.username,
              }))}
            />
          </details>
        )}
        <div className="mt-5 grid gap-3">
          {directMessageConversations.map((conversation, index) => {
            const latest =
              conversation.messages[conversation.messages.length - 1];
            return (
              <details
                className="min-w-0 border border-[#343434] bg-[#101010]"
                key={conversation.discordUserId}
                open={index === 0}
              >
                <summary className="cursor-pointer p-4 sm:p-5">
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <span className="min-w-0">
                      <strong className="block truncate text-white">
                        {conversation.displayName}
                      </strong>
                      <span className="block truncate text-xs text-[#777]">
                        @{conversation.username} ·{" "}
                        {conversation.messages.length} message
                        {conversation.messages.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-xs text-[#777]">
                      {latest
                        ? formatDate(latest.discordCreatedAt)
                        : "No messages"}
                    </span>
                  </span>
                </summary>
                <div className="grid gap-3 border-t border-[#303030] p-4 sm:p-5">
                  {conversation.messages.map((message) => (
                    <article
                      className={`max-w-[92%] border p-3 sm:max-w-[78%] ${
                        message.direction === "INBOUND"
                          ? "justify-self-start border-[#444] bg-[#171717]"
                          : "justify-self-end border-[#7b3d0a] bg-[#2a1607]"
                      }`}
                      key={message.id}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-[#888]">
                        <span>
                          {message.direction === "INBOUND"
                            ? conversation.displayName
                            : message.aiGenerated
                              ? "210 Robotics bot"
                              : "210 Robotics bot · Manual"}
                        </span>
                        {message.aiGenerated && (
                          <span className="border border-violet-700 px-1.5 py-0.5 text-violet-300">
                            Gemini
                          </span>
                        )}
                        <span>{formatDate(message.discordCreatedAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#ddd]">
                        {message.content || "[Attachment only]"}
                      </p>
                      {message.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <a
                              className="tag max-w-full truncate text-[#fd7803] underline"
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              key={attachment.id}
                            >
                              {attachment.filename}
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {guild && (
                  <DiscordDmReplyForm
                    guildId={guild.id}
                    recipient={{
                      discordUserId: conversation.discordUserId,
                      displayName: conversation.displayName,
                      username: conversation.username,
                    }}
                    replyToMessageId={latest?.id}
                    configured={Boolean(configuration.botToken)}
                  />
                )}
              </details>
            );
          })}
          {!directMessageConversations.length && (
            <p className="border border-dashed border-[#3a3a3a] p-5 text-sm leading-6 text-[#777]">
              No private bot conversations have been logged yet. This inbox
              will populate after a member sends the bot a Discord DM or an
              admin starts a conversation above.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 scroll-mt-28" id="discord-member-dms">
        {guild && (
          <div className="mb-7">
            <DiscordOrganizationDebrief
              guildId={guild.id}
              configured={Boolean(configuration.botToken)}
            />
          </div>
        )}
        {guild && (
          <DiscordMemberDmComposer
            guildId={guild.id}
            configured={Boolean(configuration.botToken)}
            recipients={discordMembers.map(({ discord }) => ({
              id: discord.id,
              displayName: discord.displayName,
              username: discord.username,
              linked: Boolean(discord.linkedMemberId),
            }))}
          />
        )}
        {guild && (
          <div className="mb-7 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6">
            <p className="eyebrow">Server-wide private reminder</p>
            <h3 className="mt-3 text-xl font-bold">
              DM every server member individually
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
              Sends the same administrator reminder as a private bot message to
              each synchronized human member. People who block server DMs are
              reported as failed without stopping the remaining deliveries.
            </p>
            <ActionForm
              action={sendDiscordBroadcastReminder}
              successMessage="The private member reminder batch finished."
              className="mt-5 grid gap-3"
            >
              <input type="hidden" name="guildId" value={guild.id} />
              <textarea
                className="input min-h-28"
                name="message"
                maxLength={1_800}
                placeholder="Reminder: our general meeting begins Friday at 6:00 PM. Please review the agenda before arriving."
                required
              />
              <button
                className="button w-full justify-center sm:w-fit"
                disabled={!configuration.botToken}
              >
                Send private reminder to everyone
              </button>
            </ActionForm>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Unified member directory</p>
            <h3 className="mt-3 text-xl font-bold">
              Discord members, portal accounts &amp; DM settings
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
              See who is linked across both systems, find portal members who
              have not connected Discord, and control registration reminders.
              Registration DMs now ask members to link their account and sign
              in or sign up for the 210 Robotics Portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-xs text-[#777]">
              Bulk registration reminders have a 14-day cooldown. Individual
              reminders can be resent immediately.
            </span>
            {guild && unlinked.length > 0 && (
              <ActionForm
                action={sendAllDiscordReminders}
                successMessage="Eligible unlinked members were sent private registration links."
              >
                <input type="hidden" name="guildId" value={guild.id} />
                <button
                  className="button justify-center px-4 py-2 text-xs"
                  disabled={!configuration.botToken}
                >
                  DM all eligible members
                </button>
              </ActionForm>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric value={linked.length} label="Linked accounts" />
          <Metric value={unlinked.length} label="Discord only" />
          <Metric value={websiteOnlyMembers.length} label="Portal only" />
        </div>

        <details className="mt-5 border border-[#343434] bg-[#0d0d0d]">
          <summary className="cursor-pointer p-4 text-sm font-bold sm:p-5">
            Verification applications ({verificationApplications.length})
          </summary>
          <div className="grid gap-3 border-t border-[#303030] p-4 lg:grid-cols-2 sm:p-5">
            {verificationApplications.map((application) => (
              <article
                className="min-w-0 border border-[#343434] bg-[#101010] p-4"
                key={application.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate">
                      {application.firstName} {application.lastName}
                    </strong>
                    <span className="block truncate text-xs text-[#777]">
                      {application.universityEmail}
                    </span>
                  </div>
                  <span className="tag border-amber-800 text-amber-300">
                    {application.status.replaceAll("_", " ")}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#888]">
                  <div>
                    <dt className="text-[#666]">Academic level</dt>
                    <dd>{application.academicLevel}</dd>
                  </div>
                  <div>
                    <dt className="text-[#666]">Declared dues method</dt>
                    <dd>{application.duesMethod.replaceAll("_", " ")}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[#666]">Submitted</dt>
                    <dd>{formatDate(application.submittedAt)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-[#777]">
                  {application.linkedMemberId
                    ? "Discord is linked. Clerk verification and the authoritative dues ledger still determine access."
                    : "Awaiting secure portal account linking. This Discord form does not verify identity or payment."}
                </p>
              </article>
            ))}
            {!verificationApplications.length && (
              <p className="text-sm text-[#777]">
                No Discord verification applications have been submitted yet.
              </p>
            )}
          </div>
        </details>

        <details className="mt-5 border border-[#343434] bg-[#0d0d0d]" open>
          <summary className="cursor-pointer p-4 text-sm font-bold sm:p-5">
            Discord members needing a portal link ({unlinked.length})
          </summary>
          <div className="grid gap-3 border-t border-[#303030] p-4 lg:grid-cols-2 sm:p-5">
            {unlinked.map(({ discord, recentlyReminded }) => (
              <article
                className="min-w-0 border border-[#343434] bg-[#101010] p-4"
                key={discord.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate">
                      {discord.displayName}
                    </strong>
                    <span className="block truncate text-xs text-[#777]">
                      @{discord.username}
                    </span>
                    <span className="mt-1 block text-xs text-amber-300">
                      Discord only · portal account not linked
                    </span>
                    <span className="mt-1 block text-xs text-[#666]">
                      {discord.registrationReminderSentAt
                        ? `Last reminded ${formatDate(discord.registrationReminderSentAt)}`
                        : "No registration DM sent"}
                    </span>
                  </div>
                  <ActionForm
                    action={sendDiscordReminder}
                    successMessage="Private portal registration link sent."
                  >
                    <input
                      type="hidden"
                      name="guildMemberId"
                      value={discord.id}
                    />
                    <button
                      className="button secondary justify-center px-3 py-2 text-xs"
                      disabled={
                        !configuration.botToken ||
                        discord.remindersOptedOut
                      }
                    >
                      {discord.remindersOptedOut
                        ? "DMs paused"
                        : recentlyReminded
                          ? "Resend link"
                          : "DM link account"}
                    </button>
                  </ActionForm>
                </div>
                {guild && (
                  <ActionForm
                    action={updateDiscordMemberDmSettings}
                    successMessage="Registration DM setting saved."
                    className="mt-4 flex flex-col gap-3 border-t border-[#303030] pt-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <input type="hidden" name="guildId" value={guild.id} />
                    <input
                      type="hidden"
                      name="guildMemberId"
                      value={discord.id}
                    />
                    <label className="flex items-center gap-2 text-xs text-[#aaa]">
                      <input
                        type="checkbox"
                        name="automaticRegistrationDms"
                        defaultChecked={!discord.remindersOptedOut}
                      />
                      Allow automatic registration DMs
                    </label>
                    <button className="button secondary justify-center px-3 py-2 text-xs">
                      Save DM setting
                    </button>
                  </ActionForm>
                )}
              </article>
            ))}
            {!unlinked.length && (
              <p className="text-sm text-[#777]">
                Every synchronized Discord member is linked to a portal
                account.
              </p>
            )}
          </div>
        </details>

        <details className="mt-3 border border-[#343434] bg-[#0d0d0d]">
          <summary className="cursor-pointer p-4 text-sm font-bold sm:p-5">
            Linked Discord + portal accounts ({linked.length})
          </summary>
          <div className="grid gap-3 border-t border-[#303030] p-4 lg:grid-cols-2 sm:p-5">
            {linked.map(({ discord, memberName, memberEmail }) => (
              <article
                className="min-w-0 border border-[#343434] bg-[#101010] p-4"
                key={discord.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate">
                      {memberName || discord.displayName}
                    </strong>
                    <span className="block truncate text-xs text-[#777]">
                      @{discord.username} · {memberEmail || "Portal member"}
                    </span>
                  </div>
                  <span className="tag border-emerald-800 text-emerald-300">
                    Linked
                  </span>
                </div>
              </article>
            ))}
          </div>
        </details>

        <details className="mt-3 border border-[#343434] bg-[#0d0d0d]">
          <summary className="cursor-pointer p-4 text-sm font-bold sm:p-5">
            Active portal members without linked Discord (
            {websiteOnlyMembers.length})
          </summary>
          <div className="grid gap-3 border-t border-[#303030] p-4 lg:grid-cols-2 sm:p-5">
            {websiteOnlyMembers.map((member) => (
              <article
                className="min-w-0 border border-[#343434] bg-[#101010] p-4"
                key={member.id}
              >
                <strong className="block truncate">
                  {member.displayName}
                </strong>
                <span className="block truncate text-xs text-[#777]">
                  {member.email} · {member.accessRole}
                </span>
                <span className="mt-1 block text-xs text-amber-300">
                  Portal account active · Discord not linked
                </span>
              </article>
            ))}
            {!websiteOnlyMembers.length && (
              <p className="text-sm text-[#777]">
                Every active portal member has linked Discord.
              </p>
            )}
          </div>
        </details>
      </div>

      {guild && (
        <div
          className="mt-9 scroll-mt-28 border-t border-[#333] pt-8"
          id="discord-message-log"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Permission-protected archive</p>
              <h3 className="mt-3 text-xl font-bold">Discord message log</h3>
              <p className="mt-2 text-sm leading-6 text-[#888]">
                Messages from channels visible to the bot are searchable here.
                Attachments remain linked to Discord&apos;s secured CDN. Each
                sync also publishes a complete JSON snapshot and summary in
                #Botlog.
              </p>
            </div>
            <form className="flex w-full gap-2 lg:w-auto">
              <input type="hidden" name="tab" value="discord" />
              <input
                className="input min-w-0 lg:w-80"
                name="discordQuery"
                defaultValue={safeSearch}
                placeholder="Search messages, people, or channels"
              />
              <button className="button secondary">Search</button>
            </form>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Ranking title="Most active people" rows={topAuthors} />
            <Ranking title="Most active channels" rows={topChannels} prefix="#" />
          </div>
          <div className="mt-5 grid gap-3">
            {messageRows.map(({ message, memberName }) => (
              <article
                className="min-w-0 border border-[#343434] bg-[#101010] p-4 sm:p-5"
                key={message.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong>{message.authorDisplayName}</strong>
                    {memberName && (
                      <span className="ml-2 text-xs text-emerald-400">
                        Linked to {memberName}
                      </span>
                    )}
                    <p className="mt-1 text-xs text-[#777]">
                      #{message.channelName} · @{message.authorUsername}
                      {message.authorIsBot ? " · bot" : ""}
                    </p>
                  </div>
                  <time className="text-xs text-[#666]">
                    {formatDate(message.discordCreatedAt)}
                  </time>
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#ccc]">
                  {message.content ||
                    (message.attachments.length
                      ? "Attachment"
                      : "Message content unavailable — enable Message Content Intent.")}
                </p>
                {message.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.attachments.map((attachment) => (
                      <a
                        className="tag hover:border-[#fd7803] hover:text-white"
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        key={attachment.id}
                      >
                        {attachment.filename}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {!messageRows.length && (
              <p className="border border-dashed border-[#333] p-6 text-sm text-[#777]">
                {safeSearch
                  ? "No synchronized messages match that search."
                  : "No messages have been synchronized yet."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-[#343434] bg-[#101010] p-4">
      <strong className="text-2xl text-[#fd7803]">{value}</strong>
      <p className="mt-2 text-xs uppercase tracking-[.09em] text-[#777]">
        {label}
      </p>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[.09em] text-[#666]">
        {label}
      </dt>
      <dd className="mt-1 text-[#ddd]">{value}</dd>
    </div>
  );
}

function Ranking({
  title,
  rows,
  prefix = "",
}: {
  title: string;
  rows: Array<{ name: string; value: number }>;
  prefix?: string;
}) {
  return (
    <div className="border border-[#343434] bg-[#0d0d0d] p-5">
      <h4 className="text-sm font-bold">{title}</h4>
      <ol className="mt-4 grid gap-2">
        {rows.map((row, index) => (
          <li
            className="flex items-center justify-between gap-3 text-sm"
            key={row.name}
          >
            <span className="truncate text-[#bbb]">
              {index + 1}. {prefix}
              {row.name}
            </span>
            <strong className="tabular-nums text-[#fd7803]">{row.value}</strong>
          </li>
        ))}
        {!rows.length && <li className="text-sm text-[#666]">No data yet.</li>}
      </ol>
    </div>
  );
}
