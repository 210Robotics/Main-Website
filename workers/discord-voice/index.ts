import { spawn } from "node:child_process";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  type VoiceConnection,
} from "@discordjs/voice";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  type VoiceBasedChannel,
} from "discord.js";
import ffmpegPath from "ffmpeg-static";
import prism from "prism-media";

const PORT = Number(process.env.PORT || 8787);
const EMPTY_CHANNEL_GRACE_MS = 10_000;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_SPEECH_CHARACTERS = 500;
const MAX_SPEAKER_TRACK_BYTES = 8 * 1024 * 1024;
const MAX_SPEAKER_TRACK_TOTAL_BYTES = 14 * 1024 * 1024;
const MAX_SPEAKER_TRACKS = 12;
const RECORDING_NOTICE = "This channel is being recorded";

type StartRequest = {
  guildId: string;
  channelId: string;
  title: string;
  requestedByMemberId: string;
  requestedByDiscordUserId: string;
};

type SpeechRequest = {
  guildId: string;
  channelId: string;
  text: string;
  requestedByMemberId: string;
};

type AudioSegment = {
  path: string;
  startMs: number;
  userId: string;
};

type RenderedSpeakerTrack = {
  path: string;
  discordUserId: string;
  displayName: string;
};

type UploadedSpeakerTrack = {
  pathname: string;
  discordUserId: string;
  displayName: string;
  mimeType: string;
  bytes: number;
};

type RecordingSession = StartRequest & {
  id: string;
  channel: VoiceBasedChannel;
  connection: VoiceConnection;
  startedAt: number;
  tempDirectory: string;
  segments: AudioSegment[];
  pendingSegments: Set<Promise<unknown>>;
  activeSpeakers: Set<string>;
  hadHumanParticipant: boolean;
  emptyTimer: ReturnType<typeof setTimeout> | null;
  finishing: boolean;
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
const sessions = new Map<string, RecordingSession>();
const speechQueues = new Map<string, Promise<void>>();

function json(
  response: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function authorized(request: IncomingMessage) {
  const expected = process.env.DISCORD_VOICE_WORKER_SECRET;
  const received = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}

async function requestJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_REQUEST_BYTES) throw new Error("Request is too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function validStartRequest(value: unknown): value is StartRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<StartRequest>;
  return Boolean(
    /^\d{15,22}$/.test(input.guildId || "") &&
      /^\d{15,22}$/.test(input.channelId || "") &&
      /^\d{15,22}$/.test(input.requestedByDiscordUserId || "") &&
      typeof input.requestedByMemberId === "string" &&
      input.requestedByMemberId.length >= 10 &&
      typeof input.title === "string" &&
      input.title.trim().length >= 2 &&
      input.title.trim().length <= 180,
  );
}

function validSpeechRequest(value: unknown): value is SpeechRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<SpeechRequest>;
  return Boolean(
    /^\d{15,22}$/.test(input.guildId || "") &&
      /^\d{15,22}$/.test(input.channelId || "") &&
      typeof input.requestedByMemberId === "string" &&
      input.requestedByMemberId.length >= 10 &&
      typeof input.text === "string" &&
      input.text.trim().length >= 1 &&
      input.text.trim().length <= MAX_SPEECH_CHARACTERS,
  );
}

async function runProcess(executable: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true });
    let errorOutput = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      errorOutput = (errorOutput + chunk.toString()).slice(-4_000);
    });
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${executable} exited with code ${code}: ${errorOutput || "no error details"}`,
          ),
        );
    });
  });
}

async function enqueueSpeech(guildId: string, task: () => Promise<void>) {
  const previous = speechQueues.get(guildId) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  speechQueues.set(guildId, next);
  try {
    await next;
  } finally {
    if (speechQueues.get(guildId) === next) speechQueues.delete(guildId);
  }
}

async function playSpeech({
  connection,
  text,
  directory,
}: {
  connection: VoiceConnection;
  text: string;
  directory: string;
}) {
  const speechPath = join(directory, `speech-${randomUUID()}.wav`);
  await runProcess("espeak-ng", [
    "-v",
    "en-us",
    "-s",
    "155",
    "-a",
    "165",
    "-w",
    speechPath,
    text.trim(),
  ]);
  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  connection.subscribe(player);
  player.play(createAudioResource(speechPath));
  await entersState(player, AudioPlayerStatus.Playing, 15_000);
  await entersState(player, AudioPlayerStatus.Idle, 90_000);
}

function humanCount(channel: VoiceBasedChannel) {
  return channel.members.filter((member) => !member.user.bot).size;
}

function subscribeToSpeaker(session: RecordingSession, userId: string) {
  if (session.finishing || session.activeSpeakers.has(userId)) return;
  const member = session.channel.members.get(userId);
  if (!member || member.user.bot) return;
  session.activeSpeakers.add(userId);
  const startMs = Math.max(0, Date.now() - session.startedAt);
  const path = join(
    session.tempDirectory,
    `${String(session.segments.length).padStart(5, "0")}-${userId}-${randomUUID()}.pcm`,
  );
  const opusStream = session.connection.receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 1_000,
    },
  });
  const decoder = new prism.opus.Decoder({
    rate: 48_000,
    channels: 2,
    frameSize: 960,
  });
  const pending = pipeline(opusStream, decoder, createWriteStream(path))
    .then(async () => {
      const details = await stat(path).catch(() => null);
      if (details?.size) {
        session.segments.push({ path, startMs, userId });
      }
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "discord.voice.segment_failed",
          sessionId: session.id,
          userId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    })
    .finally(() => {
      session.activeSpeakers.delete(userId);
      session.pendingSegments.delete(pending);
    });
  session.pendingSegments.add(pending);
}

async function renderRecording(session: RecordingSession) {
  if (!ffmpegPath) throw new Error("FFmpeg is not available.");
  const executable = ffmpegPath;
  if (!session.segments.length) {
    throw new Error("No member audio was received during the voice session.");
  }
  const output = join(session.tempDirectory, "discord-voice-recording.mp3");
  const args: string[] = [];
  for (const segment of session.segments) {
    args.push(
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-i",
      segment.path,
    );
  }
  const filters = session.segments.map(
    (segment, index) =>
      `[${index}:a]adelay=${segment.startMs}|${segment.startMs}[segment${index}]`,
  );
  const labels = session.segments
    .map((_, index) => `[segment${index}]`)
    .join("");
  filters.push(
    `${labels}amix=inputs=${session.segments.length}:normalize=0:dropout_transition=0[mixed]`,
  );
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[mixed]",
    "-ac",
    "1",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "32k",
    "-y",
    output,
  );
  await new Promise<void>((resolve, reject) => {
    const process = spawn(executable, args, { windowsHide: true });
    let errorOutput = "";
    process.stderr?.on("data", (chunk: Buffer) => {
      errorOutput = (errorOutput + chunk.toString()).slice(-4_000);
    });
    process.on("error", reject);
    process.on("close", (code: number | null) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `FFmpeg could not mix the meeting audio (${code}): ${errorOutput}`,
          ),
        );
    });
  });
  return output;
}

async function renderSpeakerTracks(session: RecordingSession) {
  if (!ffmpegPath) throw new Error("FFmpeg is not available.");
  const bySpeaker = new Map<string, AudioSegment[]>();
  for (const segment of session.segments) {
    const current = bySpeaker.get(segment.userId) || [];
    current.push(segment);
    bySpeaker.set(segment.userId, current);
  }
  const tracks: RenderedSpeakerTrack[] = [];
  for (const [discordUserId, segments] of bySpeaker) {
    const output = join(
      session.tempDirectory,
      `speaker-${discordUserId}.mp3`,
    );
    const args: string[] = [];
    for (const segment of segments) {
      args.push(
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-i",
        segment.path,
      );
    }
    const filters = segments.map(
      (segment, index) =>
        `[${index}:a]adelay=${segment.startMs}|${segment.startMs}[speaker${index}]`,
    );
    const labels = segments
      .map((_, index) => `[speaker${index}]`)
      .join("");
    filters.push(
      `${labels}amix=inputs=${segments.length}:normalize=0:dropout_transition=0[speaker]`,
    );
    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[speaker]",
      "-ac",
      "1",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "24k",
      "-y",
      output,
    );
    await runProcess(ffmpegPath, args);
    const member = session.channel.guild.members.cache.get(discordUserId);
    tracks.push({
      path: output,
      discordUserId,
      displayName:
        member?.displayName ||
        member?.user.globalName ||
        member?.user.username ||
        `Discord member ${discordUserId}`,
    });
  }
  return tracks;
}

async function uploadSpeakerTrack(
  session: RecordingSession,
  track: RenderedSpeakerTrack,
) {
  const siteUrl = (
    process.env.SITE_URL || "https://210robotics.com"
  ).replace(/\/$/, "");
  const secret = process.env.DISCORD_VOICE_WORKER_SECRET;
  if (!secret) throw new Error("DISCORD_VOICE_WORKER_SECRET is missing.");
  const audio = await readFile(track.path);
  const formData = new FormData();
  formData.set("sessionId", session.id);
  formData.set("guildId", session.guildId);
  formData.set("discordUserId", track.discordUserId);
  formData.set("displayName", track.displayName);
  formData.set(
    "audio",
    new Blob([audio], { type: "audio/mpeg" }),
    `${track.discordUserId}.mp3`,
  );
  const response = await fetch(
    `${siteUrl}/api/discord/voice-speaker-tracks`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      body: formData,
      signal: AbortSignal.timeout(180_000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    pathname?: string;
    discordUserId?: string;
    displayName?: string;
    mimeType?: string;
    bytes?: number;
    error?: string;
  };
  if (!response.ok || !payload.pathname) {
    throw new Error(
      payload.error || `Speaker-track upload returned ${response.status}.`,
    );
  }
  return {
    pathname: payload.pathname,
    discordUserId: payload.discordUserId || track.discordUserId,
    displayName: payload.displayName || track.displayName,
    mimeType: payload.mimeType || "audio/mpeg",
    bytes: payload.bytes || audio.byteLength,
  } satisfies UploadedSpeakerTrack;
}

async function uploadCompletedSession(
  session: RecordingSession,
  audioPath: string,
  speakerTracks: UploadedSpeakerTrack[],
) {
  const siteUrl = (
    process.env.SITE_URL || "https://210robotics.com"
  ).replace(/\/$/, "");
  const secret = process.env.DISCORD_VOICE_WORKER_SECRET;
  if (!secret) throw new Error("DISCORD_VOICE_WORKER_SECRET is missing.");
  const audio = await readFile(audioPath);
  const formData = new FormData();
  formData.set("memberId", session.requestedByMemberId);
  formData.set("guildId", session.guildId);
  formData.set("channelId", session.channelId);
  formData.set("title", session.title);
  formData.set("startedAt", new Date(session.startedAt).toISOString());
  formData.set("endedAt", new Date().toISOString());
  formData.set("speakerManifest", JSON.stringify(speakerTracks));
  formData.set(
    "audio",
    new Blob([audio], { type: "audio/mpeg" }),
    `${session.title.replace(/[^a-zA-Z0-9._-]/g, "-") || "meeting"}-voice.mp3`,
  );
  const response = await fetch(
    `${siteUrl}/api/discord/voice-recordings`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      body: formData,
      signal: AbortSignal.timeout(300_000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    recordingUrl?: string;
    transcriptUrl?: string;
    transcriptMarkdownUrl?: string;
  };
  if (!response.ok) {
    throw new Error(
      payload.error || `Website archive returned ${response.status}.`,
    );
  }
  return payload;
}

async function finishSession(session: RecordingSession, reason: string) {
  if (session.finishing) return;
  session.finishing = true;
  if (session.emptyTimer) clearTimeout(session.emptyTimer);
  session.connection.destroy();
  for (const stream of session.connection.receiver.subscriptions.values()) {
    stream.destroy();
  }
  await Promise.allSettled([...session.pendingSegments]);
  try {
    const audioPath = await renderRecording(session);
    const renderedSpeakerTracks = await renderSpeakerTracks(session);
    const eligibleSpeakerTracks: RenderedSpeakerTrack[] = [];
    let eligibleSpeakerBytes = 0;
    for (const track of renderedSpeakerTracks) {
      const details = await stat(track.path);
      if (
        details.size <= MAX_SPEAKER_TRACK_BYTES &&
        eligibleSpeakerBytes + details.size <=
          MAX_SPEAKER_TRACK_TOTAL_BYTES &&
        eligibleSpeakerTracks.length < MAX_SPEAKER_TRACKS
      ) {
        eligibleSpeakerTracks.push(track);
        eligibleSpeakerBytes += details.size;
      }
    }
    const speakerTrackResults = await Promise.allSettled(
      eligibleSpeakerTracks.map((track) =>
        uploadSpeakerTrack(session, track),
      ),
    );
    const speakerTracks = speakerTrackResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    for (const result of speakerTrackResults) {
      if (result.status === "rejected") {
        console.error(
          JSON.stringify({
            event: "discord.voice.speaker_track_upload_failed",
            sessionId: session.id,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          }),
        );
      }
    }
    const archived = await uploadCompletedSession(
      session,
      audioPath,
      speakerTracks,
    );
    console.info(
      JSON.stringify({
        event: "discord.voice.session_archived",
        sessionId: session.id,
        guildId: session.guildId,
        channelId: session.channelId,
        reason,
        recordingUrl: archived.recordingUrl,
        transcriptUrl: archived.transcriptUrl,
        transcriptMarkdownUrl: archived.transcriptMarkdownUrl,
        speakerTracks: speakerTracks.length,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "discord.voice.session_archive_failed",
        sessionId: session.id,
        guildId: session.guildId,
        channelId: session.channelId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  } finally {
    sessions.delete(session.guildId);
    await rm(session.tempDirectory, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}

function updateEmptyChannelTimer(session: RecordingSession) {
  const people = humanCount(session.channel);
  if (people > 0) {
    session.hadHumanParticipant = true;
    if (session.emptyTimer) clearTimeout(session.emptyTimer);
    session.emptyTimer = null;
    return;
  }
  if (
    session.hadHumanParticipant &&
    !session.emptyTimer &&
    !session.finishing
  ) {
    session.emptyTimer = setTimeout(
      () => void finishSession(session, "everyone-left"),
      EMPTY_CHANNEL_GRACE_MS,
    );
  }
}

async function getVoiceChannel(guildId: string, channelId: string) {
  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(channelId);
  if (
    !channel ||
    !channel.isVoiceBased() ||
    ![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(
      channel.type,
    )
  ) {
    throw new Error("Select a voice or stage channel the bot can join.");
  }
  return { guild, channel };
}

async function speakInChannel(input: SpeechRequest) {
  if (!client.isReady()) throw new Error("Discord is still connecting.");
  await enqueueSpeech(input.guildId, async () => {
    const { guild, channel } = await getVoiceChannel(
      input.guildId,
      input.channelId,
    );
    const activeSession = sessions.get(input.guildId);
    if (activeSession?.finishing) {
      throw new Error(
        "Wait for the active recording to finish processing before speaking.",
      );
    }
    if (activeSession && activeSession.channelId !== input.channelId) {
      throw new Error(
        `The bot is recording in ${activeSession.channel.name}. Speak there or stop the recording first.`,
      );
    }
    const directory = await mkdtemp(join(tmpdir(), "210-discord-speech-"));
    const connection =
      activeSession?.connection ||
      joinVoiceChannel({
        guildId: guild.id,
        channelId: channel.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
      });
    const ownsConnection = !activeSession;
    try {
      if (ownsConnection) {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      }
      await playSpeech({
        connection,
        text: input.text,
        directory,
      });
    } finally {
      if (ownsConnection) connection.destroy();
      await rm(directory, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  });
  return {
    channelName: (
      await client.guilds
        .fetch(input.guildId)
        .then((guild) => guild.channels.fetch(input.channelId))
    )?.name,
  };
}

async function startSession(input: StartRequest) {
  if (!client.isReady()) throw new Error("Discord is still connecting.");
  if (sessions.has(input.guildId)) {
    throw new Error("This server already has an active voice recording.");
  }
  const { guild, channel } = await getVoiceChannel(
    input.guildId,
    input.channelId,
  );
  const tempDirectory = await mkdtemp(
    join(tmpdir(), "210-discord-voice-"),
  );
  const connection = joinVoiceChannel({
    guildId: guild.id,
    channelId: channel.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    await enqueueSpeech(input.guildId, () =>
      playSpeech({
        connection,
        text: RECORDING_NOTICE,
        directory: tempDirectory,
      }),
    );
  } catch (error) {
    connection.destroy();
    await rm(tempDirectory, { recursive: true, force: true }).catch(
      () => undefined,
    );
    throw error;
  }
  const session: RecordingSession = {
    ...input,
    id: randomUUID(),
    title: input.title.trim().slice(0, 180),
    channel,
    connection,
    startedAt: Date.now(),
    tempDirectory,
    segments: [],
    pendingSegments: new Set(),
    activeSpeakers: new Set(),
    hadHumanParticipant: humanCount(channel) > 0,
    emptyTimer: null,
    finishing: false,
  };
  connection.receiver.speaking.on("start", (userId) =>
    subscribeToSpeaker(session, userId),
  );
  sessions.set(input.guildId, session);
  updateEmptyChannelTimer(session);
  console.info(
    JSON.stringify({
      event: "discord.voice.session_started",
      sessionId: session.id,
      guildId: session.guildId,
      channelId: session.channelId,
      title: session.title,
    }),
  );
  return session;
}

client.on("voiceStateUpdate", (oldState, newState) => {
  const guildId = newState.guild.id || oldState.guild.id;
  const session = sessions.get(guildId);
  if (
    !session ||
    (oldState.channelId !== session.channelId &&
      newState.channelId !== session.channelId)
  ) {
    return;
  }
  updateEmptyChannelTimer(session);
});

client.on("messageCreate", (message) => {
  if (!message.inGuild() || message.author.bot) return;
  void (async () => {
    const siteUrl = (
      process.env.SITE_URL || "https://210robotics.com"
    ).replace(/\/$/, "");
    const secret = process.env.DISCORD_VOICE_WORKER_SECRET;
    if (!secret) return;
    const response = await fetch(
      `${siteUrl}/api/discord/message-events`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          guildId: message.guild.id,
          guildName: message.guild.name,
          channelId: message.channel.id,
          channelName:
            "name" in message.channel && message.channel.name
              ? message.channel.name
              : "unknown-channel",
          channelType: message.channel.type,
          messageId: message.id,
          content: message.content || "",
          timestamp: message.createdAt.toISOString(),
          editedTimestamp: message.editedAt?.toISOString() || null,
          author: {
            id: message.author.id,
            username: message.author.username,
            displayName:
              message.member?.displayName ||
              message.author.globalName ||
              message.author.username,
            avatar: message.author.avatar,
            roles: message.member?.roles.cache.map((role) => role.id) || [],
            joinedAt: message.member?.joinedAt?.toISOString() || null,
          },
          attachments: message.attachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            url: attachment.url,
            contentType: attachment.contentType,
            size: attachment.size,
          })),
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(
        `Website message log returned ${response.status}: ${detail}`,
      );
    }
    const result = (await response.json()) as {
      reaction?: string | null;
    };
    if (result.reaction) {
      await message.react(result.reaction);
    }
  })().catch((error) => {
    console.error(
      JSON.stringify({
        event: "discord.message.log_or_reaction_failed",
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
});

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return json(response, 200, {
      ok: client.isReady(),
      activeRecordings: sessions.size,
      speechReady: true,
      speakerAttributionReady: true,
      dynamicReactionsReady: true,
    });
  }
  if (!authorized(request)) {
    return json(response, 401, { error: "Unauthorized" });
  }
  if (request.method === "POST" && request.url === "/recordings/start") {
    try {
      const input = await requestJson(request);
      if (!validStartRequest(input)) {
        return json(response, 400, {
          error: "A valid guild, voice channel, title, and requester are required.",
        });
      }
      const session = await startSession(input);
      return json(response, 201, {
        sessionId: session.id,
        message: `The 210 Robotics bot joined ${session.channel.name} and started recording member audio.`,
      });
    } catch (error) {
      return json(response, 409, {
        error:
          error instanceof Error
            ? error.message
            : "The voice recording could not start.",
      });
    }
  }
  if (request.method === "POST" && request.url === "/recordings/stop") {
    try {
      const input = (await requestJson(request)) as { guildId?: string };
      const session = input.guildId ? sessions.get(input.guildId) : null;
      if (!session) {
        return json(response, 404, { error: "No active recording was found." });
      }
      void finishSession(session, "manual-stop");
      return json(response, 202, {
        ok: true,
        message: "The recording is being finalized and transcribed.",
      });
    } catch (error) {
      return json(response, 400, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (
    request.method === "POST" &&
    request.url === "/recordings/stop-all"
  ) {
    const activeSessions = [...sessions.values()].filter(
      (session) => !session.finishing,
    );
    for (const session of activeSessions) {
      void finishSession(session, "administrator-stop-all");
    }
    return json(response, 202, {
      ok: true,
      stopped: activeSessions.length,
      message: activeSessions.length
        ? `${activeSessions.length} recording${activeSessions.length === 1 ? "" : "s"} are being finalized and transcribed.`
        : "There were no active recordings to stop.",
    });
  }
  if (request.method === "POST" && request.url === "/speech") {
    try {
      const input = await requestJson(request);
      if (!validSpeechRequest(input)) {
        return json(response, 400, {
          error:
            "A valid guild, voice channel, requester, and message of 500 characters or fewer are required.",
        });
      }
      const result = await speakInChannel(input);
      return json(response, 200, {
        ok: true,
        message: `The bot spoke in ${result.channelName || "the selected voice channel"}.`,
      });
    } catch (error) {
      return json(response, 409, {
        error:
          error instanceof Error
            ? error.message
            : "The bot could not speak in that voice channel.",
      });
    }
  }
  return json(response, 404, { error: "Not found" });
});

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is required.");
  if (!process.env.DISCORD_VOICE_WORKER_SECRET) {
    throw new Error("DISCORD_VOICE_WORKER_SECRET is required.");
  }
  await client.login(token);
  server.listen(PORT, () => {
    console.info(
      JSON.stringify({
        event: "discord.voice.worker_ready",
        port: PORT,
        botUserId: client.user?.id,
      }),
    );
  });
}

process.on("SIGTERM", () => {
  for (const session of sessions.values()) {
    void finishSession(session, "worker-shutdown");
  }
  server.close();
  client.destroy();
});

void main().catch((error) => {
  console.error(
    JSON.stringify({
      event: "discord.voice.worker_failed",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
