"use client";

import { upload } from "@vercel/blob/client";
import { Download, LoaderCircle, Radio, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  transcribeMeetingRecording,
  type MeetingTranscriptionState,
} from "@/app/admin/discord-actions";

const idle: MeetingTranscriptionState = { status: "idle", message: "" };

function elapsedLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function DiscordBrowserRecorder({
  guildId,
  uploaderId,
  voiceChannels,
  initialTitle = "",
  initialVoiceChannelId = "",
}: {
  guildId: string;
  uploaderId: string;
  voiceChannels: Array<{ id: string; name: string }>;
  initialTitle?: string;
  initialVoiceChannelId?: string;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const downloadUrlRef = useRef("");
  const [title, setTitle] = useState(initialTitle);
  const [voiceChannelId, setVoiceChannelId] = useState(
    voiceChannels.some((channel) => channel.id === initialVoiceChannelId)
      ? initialVoiceChannelId
      : voiceChannels[0]?.id || "",
  );
  const [consent, setConsent] = useState(true);
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [includeSharedVideo, setIncludeSharedVideo] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [state, setState] = useState(idle);

  function cleanupCapture() {
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamsRef.current = [];
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current = null;
    setIsRecording(false);
  }

  useEffect(
    () => () => {
      for (const stream of streamsRef.current) {
        for (const track of stream.getTracks()) track.stop();
      }
      if (audioContextRef.current) void audioContextRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (downloadUrlRef.current)
        URL.revokeObjectURL(downloadUrlRef.current);
    },
    [],
  );

  async function archiveRecording(file: File, channelName: string) {
    setWorking(true);
    setState({
      status: "idle",
      message:
        "Uploading the recording and asking Gemini to create the transcript.",
    });
    try {
      if (file.size > 15 * 1024 * 1024)
        throw new Error(
          "This recording is larger than 15 MB. Download the backup and upload a shorter or compressed audio file.",
        );
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname =
        `uploads/meeting-recording/${uploaderId}/` +
        `${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "meeting-recording" }),
      });
      const result = await transcribeMeetingRecording({
        guildId,
        title: `${title.trim()} · ${channelName}`,
        pathname: blob.pathname,
        filename: file.name,
        mimeType:
          file.type === "video/webm" ? "video/webm" : "audio/webm",
        bytes: file.size,
        consentConfirmed: true,
      });
      setState(result);
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The recording could not be archived.",
      });
    } finally {
      setWorking(false);
    }
  }

  async function startRecording() {
    if (!title.trim() || !voiceChannelId || !consent) return;
    setWorking(true);
    setState({
      status: "idle",
      message:
        "Choose the Discord window or screen and enable system audio when your browser asks.",
    });
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const displayAudio = display.getAudioTracks();
      if (!displayAudio.length) {
        display.getTracks().forEach((track) => track.stop());
        throw new Error(
          "No shared audio was selected. Start again and enable system/window audio in the share dialog.",
        );
      }
      const microphone = includeMicrophone
        ? await navigator.mediaDevices.getUserMedia({ audio: true })
        : null;
      streamsRef.current = microphone ? [display, microphone] : [display];
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      audioContext
        .createMediaStreamSource(new MediaStream(displayAudio))
        .connect(destination);
      if (microphone)
        audioContext.createMediaStreamSource(microphone).connect(destination);

      const recordingTracks = [
        ...(includeSharedVideo ? display.getVideoTracks() : []),
        ...destination.stream.getAudioTracks(),
      ];
      const recordingStream = new MediaStream(recordingTracks);
      const preferredMimeType = includeSharedVideo
        ? "video/webm;codecs=vp8,opus"
        : "audio/webm;codecs=opus";
      const mimeType = MediaRecorder.isTypeSupported(preferredMimeType)
        ? preferredMimeType
        : includeSharedVideo
          ? "video/webm"
          : "audio/webm";
      const recorder = new MediaRecorder(recordingStream, {
        mimeType,
        audioBitsPerSecond: 48_000,
        ...(includeSharedVideo ? { videoBitsPerSecond: 250_000 } : {}),
      });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const storedMimeType = includeSharedVideo
          ? "video/webm"
          : "audio/webm";
        const blob = new Blob(chunksRef.current, { type: storedMimeType });
        const file = new File(
          [blob],
          `${title.trim().replace(/[^a-zA-Z0-9._-]/g, "-") || "meeting"}-${includeSharedVideo ? "video" : "audio"}.webm`,
          { type: storedMimeType },
        );
        if (downloadUrlRef.current)
          URL.revokeObjectURL(downloadUrlRef.current);
        const nextDownloadUrl = URL.createObjectURL(blob);
        downloadUrlRef.current = nextDownloadUrl;
        setDownloadUrl(nextDownloadUrl);
        const channelName =
          voiceChannels.find((channel) => channel.id === voiceChannelId)
            ?.name || "Discord voice";
        cleanupCapture();
        void archiveRecording(file, channelName);
      };
      display.getVideoTracks()[0]?.addEventListener(
        "ended",
        () => {
          if (recorder.state === "recording") recorder.stop();
        },
        { once: true },
      );
      recorder.start(1_000);
      recorderRef.current = recorder;
      setElapsed(0);
      timerRef.current = setInterval(
        () => setElapsed((value) => value + 1),
        1_000,
      );
      setIsRecording(true);
      setState({
        status: "success",
        message:
          `Recording the ${includeSharedVideo ? "video and audio" : "audio"} you explicitly shared` +
          (microphone ? " plus your microphone." : "."),
      });
    } catch (error) {
      cleanupCapture();
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Browser recording could not start.",
      });
    } finally {
      setWorking(false);
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }

  return (
    <div className="mt-6 border-t border-[#303030] pt-6">
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Admin-only screen share</p>
          <h4 className="mt-3 text-lg font-bold">
            Screen-share capture and transcription
          </h4>
          <p className="mt-3 text-sm leading-7 text-[#999]">
            This is separate from the bot&apos;s <strong>/record</strong>{" "}
            command. An administrator selects a voice channel for the archive,
            then explicitly shares a Discord window or screen with system audio
            enabled. The website records the selected video, system audio, and
            optional microphone, then archives the recording and transcript.
          </p>
        </div>
        <div className="grid gap-4 border border-[#343434] bg-black/40 p-4 sm:p-5">
          <label className="field">
            <span>Meeting title</span>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={180}
              placeholder="General meeting · August 2026"
              disabled={isRecording || working}
            />
          </label>
          <label className="field">
            <span>Discord voice channel</span>
            <select
              className="input"
              value={voiceChannelId}
              onChange={(event) => setVoiceChannelId(event.target.value)}
              disabled={isRecording || working}
            >
              <option value="">Select a synchronized voice channel</option>
              {voiceChannels.map((channel) => (
                <option value={channel.id} key={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
            {!voiceChannels.length && (
              <span className="text-xs leading-5 text-amber-300">
                No voice channels were returned by Discord. Confirm the bot can
                view the channel, then use Sync now in Discord Overview.
              </span>
            )}
          </label>
          <label className="flex items-center gap-3 text-sm text-[#bbb]">
            <input
              type="checkbox"
              checked={includeMicrophone}
              onChange={(event) =>
                setIncludeMicrophone(event.target.checked)
              }
              disabled={isRecording || working}
            />
            Include this administrator&apos;s microphone
          </label>
          <label className="flex items-center gap-3 text-sm text-[#bbb]">
            <input
              type="checkbox"
              checked={includeSharedVideo}
              onChange={(event) =>
                setIncludeSharedVideo(event.target.checked)
              }
              disabled={isRecording || working}
            />
            Save the shared Discord window or screen video
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#bbb]">
            <input
              className="mt-1"
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={isRecording || working}
            />
            This recording is covered by the team&apos;s signed consent forms
            and posted voice-channel recording notice.
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isRecording ? (
              <button
                className="button w-full justify-center sm:w-auto"
                type="button"
                disabled={
                  working ||
                  !title.trim() ||
                  !voiceChannelId ||
                  !consent ||
                  !voiceChannels.length
                }
                onClick={startRecording}
              >
                {working ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Radio className="size-4" />
                )}
                {working ? "Preparing" : "Start consented recording"}
              </button>
            ) : (
              <button
                className="button w-full justify-center border-red-700 bg-red-950 text-red-100 sm:w-auto"
                type="button"
                onClick={stopRecording}
              >
                <Square className="size-4 fill-current" />
                Stop · {elapsedLabel(elapsed)}
              </button>
            )}
            {downloadUrl && (
              <a
                className="button secondary justify-center"
                href={downloadUrl}
                download
              >
                <Download className="size-4" />
                Download backup
              </a>
            )}
          </div>
          {state.message && (
            <p
              className={
                state.status === "error"
                  ? "text-sm leading-6 text-red-300"
                  : state.status === "success"
                    ? "text-sm leading-6 text-emerald-300"
                    : "text-sm leading-6 text-[#999]"
              }
              aria-live="polite"
            >
              {state.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
