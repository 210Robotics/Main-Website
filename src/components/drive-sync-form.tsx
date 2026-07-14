"use client";

import { useActionState } from "react";
import { syncMedia, type SyncMediaState } from "@/app/admin/actions";

const initialState: SyncMediaState = { status: "idle", message: "" };

export function DriveSyncForm() {
  const [state, action, pending] = useActionState(syncMedia, initialState);
  return (
    <div className="text-right">
      <form action={action}>
        <button className="button" disabled={pending}>
          {pending ? "Refreshing…" : "Refresh Drive media"}
        </button>
      </form>
      {state.message && (
        <p
          className={`mt-3 max-w-sm text-xs leading-5 ${state.status === "error" ? "text-red-300" : "text-emerald-300"}`}
          role="status"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
