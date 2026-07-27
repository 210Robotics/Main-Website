"use client";

import { useActionState, useState } from "react";
import {
  sendDiscordVoiceSpeech,
  stopAllDiscordRecordings,
  type DiscordMessageState,
} from "@/app/admin/discord-actions";

const initialState: DiscordMessageState = {
  status: "idle",
  message: "",
};

function StatusMessage({ state }: { state: DiscordMessageState }) {
  if (!state.message) return null;
  return (
    <p
      className={
        state.status === "success"
          ? "text-sm text-emerald-400"
          : state.status === "error"
            ? "text-sm text-red-400"
            : "text-sm text-[#888]"
      }
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function DiscordVoiceSpeaker({
  guildId,
  voiceChannels,
  configured,
}: {
  guildId: string;
  voiceChannels: Array<{ id: string; name: string; type: number }>;
  configured: boolean;
}) {
  const [text, setText] = useState("");
  const [speechState, speechAction, speechPending] = useActionState(
    sendDiscordVoiceSpeech,
    initialState,
  );
  const [stopState, stopAction, stopPending] = useActionState(
    stopAllDiscordRecordings,
    initialState,
  );

  return (
    <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.52fr)]">
      <form
        action={speechAction}
        className="min-w-0 border border-[#343434] bg-black p-4 sm:p-5"
      >
        <input type="hidden" name="guildId" value={guildId} />
        <p className="text-sm font-bold text-white">Bot voice speaker</p>
        <p className="mt-2 text-sm leading-6 text-[#888]">
          Choose a voice channel and type what the bot should say. The worker
          joins, speaks the message, and leaves when it is not recording.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="field">
            <span>Voice channel</span>
            <select className="input" name="channelId" required>
              <option value="">Choose a voice channel…</option>
              {voiceChannels.map((channel) => (
                <option value={channel.id} key={channel.id}>
                  {channel.type === 13 ? "Stage: " : ""}
                  {channel.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>What should the bot say?</span>
            <textarea
              className="input min-h-28"
              name="text"
              value={text}
              maxLength={500}
              onChange={(event) => setText(event.target.value)}
              placeholder="Practice starts in ten minutes."
              required
            />
            <span className="text-right text-xs text-[#777]">
              {text.length}/500
            </span>
          </label>
          <button
            className="button w-full justify-center sm:w-fit"
            disabled={
              speechPending ||
              !configured ||
              !voiceChannels.length ||
              !text.trim()
            }
          >
            {speechPending ? "Speaking…" : "Speak in voice channel"}
          </button>
          <StatusMessage state={speechState} />
        </div>
      </form>

      <form
        action={stopAction}
        className="flex min-w-0 flex-col justify-between border border-red-900/60 bg-red-950/10 p-4 sm:p-5"
      >
        <input type="hidden" name="guildId" value={guildId} />
        <div>
          <p className="text-sm font-bold text-white">
            Recording safety control
          </p>
          <p className="mt-2 text-sm leading-6 text-[#999]">
            Stop every active bot recording, finalize captured audio, and
            begin transcript processing. This is the Admin Hub equivalent of
            <strong className="ml-1 text-white">/stopall</strong>.
          </p>
        </div>
        <div className="mt-5 grid gap-3">
          <button
            className="button secondary w-full justify-center border-red-800 text-red-200 hover:border-red-500"
            disabled={stopPending || !configured}
          >
            {stopPending ? "Stopping recordings…" : "Stop all recordings"}
          </button>
          <StatusMessage state={stopState} />
        </div>
      </form>
    </div>
  );
}
