import "server-only";

type VoiceRecordingStart = {
  guildId: string;
  channelId: string;
  title: string;
  requestedByMemberId: string;
  requestedByDiscordUserId: string;
};

type VoiceSpeechRequest = {
  guildId: string;
  channelId: string;
  text: string;
  requestedByMemberId: string;
};

export type DiscordVoiceSessionDiagnostic = {
  sessionId: string;
  state: string;
  guildId: string;
  channelId: string;
  channelName: string;
  connectedDurationSeconds: number;
  activeSpeakers: number;
  queuedSegments: number;
  pendingSegments: number;
  lastHeartbeatAt: string;
  lastAudioOperationAt: string | null;
  reconnectCount: number;
  lastError: string | null;
  lastDisconnectReason: string | null;
  idleTimeoutMinutes: number;
};

function workerConfiguration() {
  const baseUrl = process.env.DISCORD_VOICE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.DISCORD_VOICE_WORKER_SECRET;
  if (!baseUrl || !secret) {
    throw new Error("The always-on Discord voice recorder worker is not configured.");
  }
  return { baseUrl, secret };
}

async function workerJson<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: Record<string, unknown>; timeoutMs?: number } = {},
) {
  const { baseUrl, secret } = workerConfiguration();
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method || "GET",
    headers: {
      authorization: `Bearer ${secret}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(init.timeoutMs || 20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error || payload.message || `Voice recorder worker returned ${response.status}.`,
    );
  }
  return payload;
}

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

export async function stopAllDiscordVoiceRecordings() {
  const baseUrl = process.env.DISCORD_VOICE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.DISCORD_VOICE_WORKER_SECRET;
  if (!baseUrl || !secret) {
    throw new Error(
      "The always-on Discord voice recorder worker is not configured.",
    );
  }
  const response = await fetch(`${baseUrl}/recordings/stop-all`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    stopped?: number;
    message?: string;
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
    stopped: payload.stopped || 0,
    message:
      payload.message ||
      "All active recordings are being finalized and transcribed.",
  };
}

export async function stopDiscordVoiceRecording(guildId: string) {
  return workerJson<{ ok: boolean; message: string }>("/recordings/stop", {
    method: "POST",
    body: { guildId },
  });
}

export async function reconnectDiscordVoiceRecording(guildId: string) {
  return workerJson<{ ok: boolean; session: DiscordVoiceSessionDiagnostic }>(
    "/recordings/reconnect",
    { method: "POST", body: { guildId }, timeoutMs: 180_000 },
  );
}

export async function getDiscordVoiceDiagnostics() {
  return workerJson<{
    ok: boolean;
    gatewayStatus: number;
    processUptimeSeconds: number;
    memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
    sessions: DiscordVoiceSessionDiagnostic[];
  }>("/diagnostics");
}

export async function speakDiscordVoiceMessage(input: VoiceSpeechRequest) {
  const baseUrl = process.env.DISCORD_VOICE_WORKER_URL?.replace(/\/$/, "");
  const secret = process.env.DISCORD_VOICE_WORKER_SECRET;
  if (!baseUrl || !secret) {
    throw new Error(
      "The always-on Discord voice recorder worker is not configured.",
    );
  }
  const response = await fetch(`${baseUrl}/speech`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Voice worker returned ${response.status}.`,
    );
  }
  return {
    message: payload.message || "The bot spoke in the selected voice channel.",
  };
}
