"use client";

import { useActionState, useState } from "react";
import {
  sendDiscordAdminMessage,
  type DiscordMessageState,
} from "@/app/admin/discord-actions";

const initialState: DiscordMessageState = {
  status: "idle",
  message: "",
};

export function DiscordMessageComposer({
  guildId,
  channels,
}: {
  guildId: string;
  channels: Array<{ id: string; name: string; type: number }>;
}) {
  const [content, setContent] = useState("");
  const [state, action, pending] = useActionState(
    sendDiscordAdminMessage,
    initialState,
  );

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="guildId" value={guildId} />
      <div className="grid gap-4">
        <label className="field">
          <span>Discord channel</span>
          <select className="input" name="channelId" required>
            <option value="">Choose any channel…</option>
            {channels.map((channel) => (
              <option value={channel.id} key={channel.id}>
                {channel.type >= 10 ? "Thread: " : "#"}
                {channel.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Message</span>
        <textarea
          className="input min-h-40"
          name="content"
          value={content}
          maxLength={2000}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write an announcement, reminder, or team update…"
          required
        />
        <span className="flex items-center justify-between gap-4 text-xs text-[#777]">
          <span>
            Bot messages are sent silently. User, role, and everyone mentions
            never create notifications.
          </span>
          <strong className={content.length > 1900 ? "text-amber-300" : ""}>
            {content.length}/2000
          </strong>
        </span>
      </label>
      {content && (
        <div className="border border-[#333] bg-black p-4">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[#777]">
            Preview
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#ddd]">
            {content}
          </p>
        </div>
      )}
      <button
        className="button justify-center sm:w-fit"
        disabled={pending || !channels.length}
      >
        {pending ? "Sending…" : "Send as 210 Robotics BOT"}
      </button>
      <p
        className={
          state.status === "success"
            ? "text-sm text-emerald-400"
            : state.status === "error"
              ? "text-sm text-red-400"
              : "text-sm text-[#777]"
        }
        aria-live="polite"
      >
        {state.message ||
          (channels.length
            ? "Messages are recorded in the Discord log and website audit history."
            : "Authorize the bot and synchronize channels before sending.")}
      </p>
    </form>
  );
}
