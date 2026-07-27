"use client";

import { useActionState, useMemo, useState } from "react";
import {
  sendDiscordSelectedMemberDm,
  type DiscordMessageState,
} from "@/app/admin/discord-actions";

const initialState: DiscordMessageState = {
  status: "idle",
  message: "",
};

export function DiscordMemberDmComposer({
  guildId,
  recipients,
  configured,
}: {
  guildId: string;
  recipients: Array<{
    id: string;
    displayName: string;
    username: string;
    linked: boolean;
  }>;
  configured: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [state, action, pending] = useActionState(
    sendDiscordSelectedMemberDm,
    initialState,
  );
  const visibleRecipients = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return recipients;
    return recipients.filter(
      (recipient) =>
        recipient.displayName.toLowerCase().includes(search) ||
        recipient.username.toLowerCase().includes(search),
    );
  }, [query, recipients]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form
      action={action}
      className="mb-7 grid gap-5 border border-[#343434] bg-[#0d0d0d] p-5 sm:p-6"
    >
      <input type="hidden" name="guildId" value={guildId} />
      <div>
        <p className="eyebrow">Individual or selected batch DM</p>
        <h3 className="mt-3 text-xl font-bold">
          Message selected Discord members
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">
          Select one person for an individual DM or several people for a
          private batch. Each recipient receives a separate message.
        </p>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(16rem,.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 border border-[#303030] bg-black p-3">
          <label className="field">
            <span>Find a Discord member</span>
            <input
              className="input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or username"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="button secondary px-3 py-2 text-xs"
              type="button"
              onClick={() =>
                setSelected((current) => {
                  const next = new Set(current);
                  visibleRecipients.forEach((recipient) =>
                    next.add(recipient.id),
                  );
                  return next;
                })
              }
            >
              Select visible
            </button>
            <button
              className="button secondary px-3 py-2 text-xs"
              type="button"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleRecipients.map((recipient) => (
              <label
                className="flex cursor-pointer items-start gap-3 border border-[#292929] p-3 text-sm hover:border-[#555]"
                key={recipient.id}
              >
                <input
                  className="mt-1"
                  type="checkbox"
                  name="guildMemberIds"
                  value={recipient.id}
                  checked={selected.has(recipient.id)}
                  onChange={() => toggle(recipient.id)}
                />
                <span className="min-w-0">
                  <strong className="block truncate text-white">
                    {recipient.displayName}
                  </strong>
                  <span className="block truncate text-xs text-[#777]">
                    @{recipient.username} ·{" "}
                    {recipient.linked ? "Portal linked" : "Discord only"}
                  </span>
                </span>
              </label>
            ))}
            {!visibleRecipients.length && (
              <p className="p-3 text-sm text-[#777]">
                No members match that search.
              </p>
            )}
          </div>
        </div>
        <label className="field min-w-0">
          <span>Private message</span>
          <textarea
            className="input min-h-52"
            name="message"
            maxLength={1_800}
            placeholder="Write the private message these members should receive…"
            required
          />
          <span className="text-xs text-[#777]">
            The bot adds each recipient&apos;s display name to their private
            copy.
          </span>
        </label>
      </div>
      <button
        className="button w-full justify-center sm:w-fit"
        disabled={pending || !configured || !selected.size}
      >
        {pending
          ? "Sending private DMs…"
          : selected.size
            ? `Send ${selected.size} private DM${selected.size === 1 ? "" : "s"}`
            : "Select members to DM"}
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
          "Discord may block delivery when a member has disabled server DMs."}
      </p>
    </form>
  );
}
