import "server-only";

type VoiceRecordingStart = {
  guildId: string;
  channelId: string;
  title: string;
  requestedByMemberId: string;
  requestedByDiscordUserId: string;
};

export function discordVoiceWorkerConfiguration() {
  return {
    url: Boolean(process.env.DISCORD_VOICE_WORKER_URL),
    secret: Boolean(process.env.DISCORD_VOICE_WORKER_SECRET),
    configured: Boolean(
      process.env.DISCORD_VOICE_WORKER_URL &&
        process.env.DISCORD_VOICE_WORKER_SECRET,
    ),
  };
}

export async function startDiscordVoiceRecording(
  input: VoiceRecordingStart,
) {
  const baseUrl = process.env.DISCORD_VOICE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.DISCORD_VOICE_WORKER_SECRET;
  if (!baseUrl || !secret) {
    throw new Error(
      "The always-on Discord voice recorder worker is not configured.",
    );
  }
  const response = await fetch(`${baseUrl}/recordings/start`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    sessionId?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Voice recorder worker returned ${response.status}.`,
    );
  }
  return {
    sessionId: payload.sessionId || "",
    message:
      payload.message ||
      "The bot joined the voice channel and started recording.",
  };
}
