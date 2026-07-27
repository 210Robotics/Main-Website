"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export function TaskAlert({
  count,
  urgentTitle,
}: {
  count: number;
  urgentTitle?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!count || sessionStorage.getItem("operations-task-alert-seen") === "1")
      return;
    sessionStorage.setItem("operations-task-alert-seen", "1");
    dialog.current?.showModal();
  }, [count]);
  if (!count) return null;
  return (
    <>
      <div className="card border-[#fd7803]/45 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Action required</p>
            <h2 className="mt-2 text-xl font-bold">
              You have {count} open task{count === 1 ? "" : "s"}.
            </h2>
            {urgentTitle && (
              <p className="mt-2 text-sm text-[#999]">
                Highest priority: {urgentTitle}
              </p>
            )}
          </div>
          <Link className="button" href="/portal?tab=tasks">
            Open task hub
          </Link>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="m-auto w-[min(92vw,560px)] rounded-2xl border border-[#fd7803]/55 bg-[#111] p-0 text-white backdrop:bg-black/75"
      >
        <div className="p-7">
          <p className="eyebrow">New work queue</p>
          <h2 className="mt-3 text-2xl font-bold">
            You have {count} active assignment{count === 1 ? "" : "s"}.
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#aaa]">
            Open the task hub to review deadlines, post comments, and attach
            deliverables.
          </p>
          {urgentTitle && (
            <p className="mt-4 rounded-xl border border-[#333] p-4 text-sm">
              <span className="text-[#888]">Next up:</span> {urgentTitle}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="button"
              href="/portal?tab=tasks"
              onClick={() => dialog.current?.close()}
            >
              View tasks
            </Link>
            <button
              className="button secondary"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Later
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
