"use client";

import { useActionState } from "react";
import {
  sendOrganizationDebriefToJacob,
  type DiscordMessageState,
} from "@/app/admin/discord-actions";

const initialState: DiscordMessageState = {
  status: "idle",
  message: "",
};

export function DiscordOrganizationDebrief({
  guildId,
  configured,
}: {
  guildId: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(
    sendOrganizationDebriefToJacob,
    initialState,
  );

  return (
    <section className="border border-[#fd7803]/60 bg-[linear-gradient(135deg,rgba(253,120,3,.14),rgba(13,13,13,.96)_52%)] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#fd7803]">
            Executive organization debrief
          </p>
          <h3 className="mt-3 text-xl font-bold sm:text-2xl">
            Send Jacob the complete live operating picture
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#aaa]">
            Compiles current deadlines, warnings, tasks, approvals, finances,
            donations, dues, events, engineering work, inventory, purchasing,
            notebook reviews, forms, Discord linkage, and extracted
            internal-document content. Jacob receives a private executive
            summary plus the complete Markdown debrief as an attachment.
          </p>
        </div>
        <form action={action} className="min-w-0 lg:w-80" aria-busy={pending}>
          <input type="hidden" name="guildId" value={guildId} />
          <button
            className="button w-full justify-center px-5 py-3"
            disabled={!configured || pending}
          >
            {pending ? "Compiling full debrief…" : "Send full debrief to Jacob"}
          </button>
          <p
            className={`mt-3 text-sm leading-5 ${
              state.status === "error" ? "text-red-400" : "text-emerald-400"
            }`}
            aria-live="polite"
          >
            {!configured
              ? "Connect the Discord bot before sending a debrief."
              : state.message}
          </p>
        </form>
      </div>
    </section>
  );
}
