"use client";

import { useActionState } from "react";
import {
  connectDiscordGuildWithState,
  type DiscordConnectState,
} from "@/app/admin/discord-actions";

const initialState: DiscordConnectState = {
  status: "idle",
  message: "",
};

export function DiscordConnectForm({
  installUrl,
  botTokenConfigured,
}: {
  installUrl: string | null;
  botTokenConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(
    connectDiscordGuildWithState,
    initialState,
  );
  return (
    <div className="mt-5 grid gap-5">
      <ol className="grid gap-3 text-sm leading-6 text-[#aaa]">
        <li className="flex gap-3">
          <strong className="text-[#fd7803]">1.</strong>
          <span>
            {installUrl ? (
              <a
                className="font-semibold text-white underline decoration-[#fd7803] underline-offset-4"
                href={installUrl}
                target="_blank"
                rel="noreferrer"
              >
                Add the 210 bot to Discord
              </a>
            ) : (
              "Configure the Discord Application ID"
            )}
            , then select the team server.
          </span>
        </li>
        <li className="flex gap-3">
          <strong className="text-[#fd7803]">2.</strong>
          <span>
            Add the private bot token to Vercel as{" "}
            <code>DISCORD_BOT_TOKEN</code>.
            <strong
              className={
                botTokenConfigured
                  ? "ml-2 text-emerald-400"
                  : "ml-2 text-amber-300"
              }
            >
              {botTokenConfigured ? "Detected" : "Not detected"}
            </strong>
          </span>
        </li>
        <li className="flex gap-3">
          <strong className="text-[#fd7803]">3.</strong>
          <span>
            Enable Server Members Intent and Message Content Intent in the
            Discord Developer Portal.
          </span>
        </li>
      </ol>
      <form action={action} className="grid gap-3">
        <label className="field">
          <span>Discord Server ID</span>
          <input
            className="input"
            name="guildId"
            inputMode="numeric"
            pattern="\d{15,22}"
            placeholder="Right-click the server, then Copy Server ID"
            required
          />
        </label>
        <button
          className="button justify-center sm:w-fit"
          aria-disabled={pending}
          disabled={pending}
        >
          {pending ? "Connecting…" : "Connect server and install commands"}
        </button>
        <p
          className={
            state.status === "success"
              ? "text-sm leading-6 text-emerald-400"
              : state.status === "warning"
                ? "text-sm leading-6 text-amber-300"
                : state.status === "error"
                  ? "text-sm leading-6 text-red-400"
                  : "text-sm leading-6 text-[#777]"
          }
          aria-live="polite"
        >
          {state.message ||
            "This check now reports the exact configuration or Discord permission problem."}
        </p>
      </form>
    </div>
  );
}

