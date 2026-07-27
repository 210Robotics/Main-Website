"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import {
  refreshSharedCalendar,
  type CalendarRefreshState,
} from "@/app/admin/actions";

const initialState: CalendarRefreshState = { status: "idle", message: "" };

function formatSyncTime(value: string | null) {
  if (!value) return "No manual refresh recorded yet";
  return `Last refreshed ${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))}`;
}

export function CalendarRefreshForm({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const [state, action, pending] = useActionState(refreshSharedCalendar, initialState);
  const displayedTime = state.refreshedAt ?? lastSyncedAt;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-5 border border-[#333] bg-black/30 p-5">
      <div>
        <h3 className="font-bold text-white">Live Google Calendar</h3>
        <p className="mt-2 text-sm leading-6 text-[#999]">
          Pull the newest shared-calendar events immediately and update the public Events page.
        </p>
        <p className="mt-2 font-mono text-[.68rem] uppercase tracking-wider text-[#777]">
          {formatSyncTime(displayedTime)}
        </p>
      </div>
      <form action={action} className="text-right">
        <button className="button secondary" disabled={pending} type="submit">
          <RefreshCw className={pending ? "animate-spin" : ""} size={16} />
          {pending ? "Refreshing calendar…" : "Refresh calendar now"}
        </button>
        {state.message && (
          <p
            className={`mt-3 max-w-sm text-xs leading-5 ${state.status === "error" ? "text-red-300" : "text-emerald-300"}`}
            role="status"
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}

