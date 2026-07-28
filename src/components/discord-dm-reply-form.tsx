"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  sendDiscordConversationReply,
  type DiscordMessageState,
} from "@/app/admin/discord-actions";

const initialState: DiscordMessageState = {
  status: "idle",
  message: "",
};

type Recipient = {
  discordUserId: string;
  displayName: string;
  username: string;
};

export function DiscordDmReplyForm({
  guildId,
  recipient,
  recipients,
  replyToMessageId,
  configured,
}: {
  guildId: string;
  recipient?: Recipient;
  recipients?: Recipient[];
  replyToMessageId?: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(
    sendDiscordConversationReply,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const isNewConversation = !recipient;
  const availableRecipients = recipients ?? [];

  return (
    <form
      action={action}
      className="grid min-w-0 gap-3 border-t border-[#303030] bg-black/40 p-4 sm:p-5"
      ref={formRef}
    >
      <input type="hidden" name="guildId" value={guildId} />
      {recipient ? (
        <input
          type="hidden"
          name="discordUserId"
          value={recipient.discordUserId}
        />
      ) : (
        <label className="field min-w-0">
          <span>Discord member</span>
          <select
            className="input min-w-0"
            name="discordUserId"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select a person to message
            </option>
            {availableRecipients.map((option) => (
              <option
                value={option.discordUserId}
                key={option.discordUserId}
              >
                {option.displayName} (@{option.username})
              </option>
            ))}
          </select>
        </label>
      )}
      {replyToMessageId ? (
        <input
          type="hidden"
          name="replyToMessageId"
          value={replyToMessageId}
        />
      ) : null}
      <label className="field min-w-0">
        <span>
          {isNewConversation
            ? "Message from the 210 Robotics bot"
            : `Reply to ${recipient.displayName} as the bot`}
        </span>
        <textarea
          className="input min-h-28"
          name="message"
          maxLength={1_800}
          placeholder={
            isNewConversation
              ? "Start a private conversation..."
              : "Write a private reply..."
          }
          required
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="button w-full justify-center sm:w-fit"
          disabled={
            pending ||
            !configured ||
            (isNewConversation && !availableRecipients.length)
          }
        >
          {pending
            ? "Sending..."
            : isNewConversation
              ? "Start private conversation"
              : "Send as 210 Bot"}
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
            (configured
              ? "The reply will appear here and in the member's Discord DMs."
              : "Connect the Discord bot before sending messages.")}
        </p>
      </div>
    </form>
  );
}
