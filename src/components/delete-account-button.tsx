"use client";

import { useActionState, useRef } from "react";
import { deleteMember, type AdminFormState } from "@/app/admin/actions";

const initialState: AdminFormState = { status: "idle", message: "" };

export function DeleteAccountButton({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(deleteMember, initialState);
  return (
    <>
      <button
        className="text-xs text-red-400 hover:text-red-300"
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        Delete account
      </button>
      <dialog
        ref={dialog}
        className="admin-dialog w-[min(520px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/80"
      >
        <div className="border border-red-900/70 p-6 md:p-8">
          <p className="font-mono text-[.65rem] uppercase tracking-wider text-red-400">Permanent action</p>
          <h2 className="mt-3 text-2xl font-bold">Delete {memberName}?</h2>
          <p className="mt-4 text-sm leading-6 text-[#aaa]">
            This permanently removes the Clerk identity, active sessions, portal account, hours, contributions, and project assignments. Audit history remains.
          </p>
          <form action={action} className="mt-6 grid gap-4">
            <input type="hidden" name="memberId" value={memberId} />
            <div className="flex flex-wrap gap-3">
              <button className="button border-red-600 bg-red-600 text-white hover:bg-red-500" disabled={pending}>
                {pending ? "Deleting..." : "Permanently delete"}
              </button>
              <button className="button secondary" type="button" onClick={() => dialog.current?.close()}>
                Cancel
              </button>
            </div>
            <p
              className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"}
              aria-live="polite"
            >
              {state.message}
            </p>
          </form>
        </div>
      </dialog>
    </>
  );
}
