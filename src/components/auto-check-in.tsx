"use client";

import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { recordSelfAttendance, type CheckInState } from "@/app/attendance/check-in/[token]/actions";

const initial: CheckInState = { status: "idle", message: "Checking you in…" };

export function AutoCheckIn({ token, method = "QR_LINK" }: { token: string; method?: "QR_CAMERA" | "QR_LINK" }) {
  const [state, action, pending] = useActionState(recordSelfAttendance, initial);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.requestSubmit(); }, []);
  return (
    <div className="card mx-auto max-w-xl p-8 text-center md:p-12">
      <form action={action} ref={form}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="method" value={method} />
      </form>
      {pending || state.status === "idle" ? <LoaderCircle className="mx-auto animate-spin text-[#fd7803]" size={42} /> : state.status === "success" ? <CheckCircle2 className="mx-auto text-emerald-400" size={48} /> : <TriangleAlert className="mx-auto text-red-400" size={48} />}
      <p className="eyebrow mt-7">210 Robotics attendance</p>
      <h1 className="mt-4 text-3xl font-bold">{state.activity ?? (state.status === "error" ? "Check-in unavailable" : "Recording attendance")}</h1>
      <p className="mt-4 text-sm leading-7 text-[#aaa]" aria-live="polite">{state.message}</p>
      {state.checkedInAt && <p className="mt-3 font-mono text-xs text-[#777]">{new Date(state.checkedInAt).toLocaleString()}</p>}
      <Link className="button secondary mt-8" href="/portal?tab=attendance">Return to attendance</Link>
    </div>
  );
}
