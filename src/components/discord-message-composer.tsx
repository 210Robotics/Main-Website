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
  people,
}: {
  guildId: string;
  channels: Array<{ id: string; name: string; type: number }>;
  people: Array<{
    discordUserId: string;
    displayName: string;
    username: string;
  }>;
}) {
  const [content, setContent] = useState("");
  const [mentionEveryone, setMentionEveryone] = useState(false);
  const [state, action, pending] = useActionState(
    sendDiscordAdminMessage,
    initialState,
  );

  function insertMention(token: string) {
    if (!token) return;
    setContent((current) => `${current}${current ? " " : ""}${token} `);
  }

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="guildId" value={guildId} />
      <div className="grid gap-4 md:grid-cols-2">
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
        <label className="field">
          <span>Insert a person mention</span>
          <select
            className="input"
            value=""
            onChange={(event) => insertMention(event.target.value)}
          >
            <option value="">Choose a Discord member…</option>
            {people.map((person) => (
              <option
                value={`<@${person.discordUserId}>`}
                key={person.discordUserId}
              >
                {person.displayName} (@{person.username})
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
          maxLength={mentionEveryone ? 1989 : 2000}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write an announcement, reminder, or team update…"
          required
        />
        <span className="flex items-center justify-between gap-4 text-xs text-[#777]">
          <span>
            Person mentions selected above will notify them. Role mentions
            remain disabled.
          </span>
          <strong className={content.length > 1900 ? "text-amber-300" : ""}>
            {content.length}/{mentionEveryone ? 1989 : 2000}
          </strong>
        </span>
      </label>
      <label className="flex items-start gap-3 border border-amber-900/60 bg-amber-950/20 p-4 text-sm leading-6 text-amber-100/80">
        <input
          className="mt-1"
          type="checkbox"
          name="mentionEveryone"
          checked={mentionEveryone}
          onChange={(event) => setMentionEveryone(event.target.checked)}
        />
        <span>
          <strong className="text-amber-100">Mention @everyone</strong>
          <span className="mt-1 block text-xs text-amber-100/60">
            Sends a server-wide notification to members who can view the
            selected channel. Use only for important team announcements.
          </span>
        </span>
      </label>
      {content && (
        <div className="border border-[#333] bg-black p-4">
          <p className="text-xs font-bold uppercase tracking-[.1em] text-[#777]">
            Preview
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#ddd]">
            {mentionEveryone ? `@everyone\n${content}` : content}
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
