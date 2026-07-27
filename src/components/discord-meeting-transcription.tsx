"use client";

import { upload } from "@vercel/blob/client";
import { FileAudio, LoaderCircle, Mic2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  transcribeMeetingRecording,
  type MeetingTranscriptionState,
} from "@/app/admin/discord-actions";

const idle: MeetingTranscriptionState = { status: "idle", message: "" };

function mimeFromName(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/x-m4a";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "";
}

export function DiscordMeetingTranscription({
  guildId,
  uploaderId,
}: {
  guildId: string;
  uploaderId: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [state, setState] = useState(idle);

  async function transcribe() {
    if (!recording || !title.trim() || !consent) return;
    setWorking(true);
    setState({
      status: "idle",
      message: "Uploading and transcribing the meeting. This can take a few minutes.",
    });
    try {
      const mimeType = recording.type || mimeFromName(recording.name);
      const safeName = recording.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname =
        `uploads/meeting-recording/${uploaderId}/` +
        `${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, recording, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "meeting-recording" }),
      });
      const result = await transcribeMeetingRecording({
        guildId,
        title,
        pathname: blob.pathname,
        filename: recording.name,
        mimeType: mimeType as
          | "audio/mpeg"
          | "audio/mp4"
          | "audio/x-m4a"
          | "audio/wav"
          | "audio/x-wav"
          | "audio/ogg"
          | "audio/webm"
          | "video/mp4"
          | "video/webm",
        bytes: recording.size,
        consentConfirmed: true,
      });
      setState(result);
      if (result.status === "success") {
        setTitle("");
        setConsent(false);
        setRecording(null);
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch (error) {
      console.error("Meeting transcription upload failed", error);
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "The recording could not be uploaded.",
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center border border-[#3b3b3b] bg-black text-[#fd7803]">
            <Mic2 className="size-5" />
          </span>
          <div>
            <h3 className="text-xl font-bold">Meeting transcription</h3>
            <p className="text-xs uppercase tracking-[.12em] text-[#777]">
              Gemini + Internal Documents + #Botlog
            </p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#999]">
          Upload a recording after the meeting. Gemini identifies
          distinguishable speakers, creates editable Word and Markdown
          transcripts with decisions and action items, syncs both formats to
          the private archive and meeting Drive folder, and posts the Markdown
          transcript with download links in #Botlog.
        </p>
        <p className="mt-3 border-l-2 border-amber-500 pl-3 text-xs leading-6 text-amber-100/75">
          This tool never joins voice channels or records people
          automatically. Tell everyone before recording and obtain their
          consent.
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
            placeholder="General meeting — August 2026"
          />
        </label>
        <label className="field">
          <span>Recording (15 MB maximum)</span>
          <input
            ref={fileInput}
            className="input file:mr-3 file:border-0 file:bg-[#202020] file:px-3 file:py-2 file:text-white"
            type="file"
            accept=".mp3,.m4a,.wav,.ogg,.webm,.mp4,audio/*,video/mp4,video/webm"
            onChange={(event) =>
              setRecording(event.target.files?.[0] || null)
            }
          />
        </label>
        {recording && (
          <div className="flex items-center gap-2 text-xs text-[#888]">
            <FileAudio className="size-4 text-[#fd7803]" />
            <span className="min-w-0 truncate">{recording.name}</span>
            <span className="shrink-0">
              {(recording.size / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
        )}
        <label className="flex items-start gap-3 text-sm leading-6 text-[#bbb]">
          <input
            className="mt-1"
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          I confirm that every participant was informed of the recording and
          consented to it.
        </label>
        <button
          className="button w-full justify-center"
          type="button"
          disabled={
            working ||
            !recording ||
            !title.trim() ||
            !consent ||
            recording.size > 15 * 1024 * 1024
          }
          onClick={transcribe}
        >
          {working ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Mic2 className="size-4" />
          )}
          {working ? "Creating transcript" : "Transcribe and archive"}
        </button>
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
  );
}
