"use client";

import { useActionState, useRef } from "react";
import { restoreMember, type AdminFormState } from "@/app/admin/actions";

const initialState: AdminFormState = { status: "idle", message: "" };

export function RestoreAccountButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(restoreMember, initialState);
  return (
    <>
      <button className="text-xs text-emerald-400 hover:text-emerald-300" type="button" onClick={() => dialog.current?.showModal()}>
        Restore account
      </button>
      <dialog ref={dialog} className="admin-dialog w-[min(520px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/80">
        <div className="border border-emerald-900/70 p-6 md:p-8">
          <p className="font-mono text-[.65rem] uppercase tracking-wider text-emerald-400">Account access</p>
          <h2 className="mt-3 text-2xl font-bold">Restore {memberName}?</h2>
          <p className="mt-4 text-sm leading-6 text-[#aaa]">
            This reactivates portal access. Their public-directory visibility remains off until an admin enables it in Edit Account.
          </p>
          <form action={action} className="mt-6 grid gap-4">
            <input type="hidden" name="memberId" value={memberId} />
            <div className="flex flex-wrap gap-3">
              <button className="button" disabled={pending}>{pending ? "Restoring…" : "Restore account"}</button>
              <button className="button secondary" type="button" onClick={() => dialog.current?.close()}>Cancel</button>
            </div>
            <p className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"} aria-live="polite">
              {state.message}
            </p>
          </form>
        </div>
      </dialog>
    </>
  );
}
