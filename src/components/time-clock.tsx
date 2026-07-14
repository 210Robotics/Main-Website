"use client";

import { useEffect, useState } from "react";
import { Clock3, LogIn, LogOut } from "lucide-react";
import { clockIn, clockOut } from "@/app/portal/actions";

type ActiveSession = {
  clockIn: string;
  project: string;
  category: string;
  description: string;
} | null;

export function TimeClock({ active }: { active: ActiveSession }) {
  const [elapsed, setElapsed] = useState(() =>
    active
      ? formatElapsed(Date.now() - new Date(active.clockIn).getTime())
      : "00:00:00",
  );
  useEffect(() => {
    if (!active) return;
    const tick = () =>
      setElapsed(
        formatElapsed(Date.now() - new Date(active.clockIn).getTime()),
      );
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (active)
    return (
      <div className="clock-active">
        <div>
          <p className="eyebrow">Currently signed in</p>
          <div className="mt-5 flex items-center gap-3">
            <Clock3 className="text-[#fd7803]" />
            <strong className="font-mono text-4xl tracking-tight">
              {elapsed}
            </strong>
          </div>
          <p className="mt-5 font-semibold">
            {active.project} · {active.category}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#999]">
            {active.description}
          </p>
          <p className="mt-3 text-xs text-[#666]">
            Started {new Date(active.clockIn).toLocaleString()}
          </p>
        </div>
        <form action={clockOut}>
          <button className="button" type="submit">
            <LogOut size={16} />
            Sign out and log hours
          </button>
        </form>
      </div>
    );

  return (
    <form action={clockIn} className="grid gap-4">
      <p className="text-sm leading-6 text-[#999]">
        Sign in when you start working. Signing out will calculate the exact
        elapsed time and add it to your hour history.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span>Project</span>
          <input
            className="input"
            name="project"
            placeholder="VEX U, RoboRowdy, Outreach…"
            required
          />
        </label>
        <label className="field">
          <span>Category</span>
          <input
            className="input"
            name="category"
            placeholder="Design, Build, Programming…"
            required
          />
        </label>
      </div>
      <label className="field">
        <span>What are you working on?</span>
        <textarea className="input min-h-24" name="description" required />
      </label>
      <button className="button w-fit" type="submit">
        <LogIn size={16} />
        Sign in now
      </button>
    </form>
  );
}

function formatElapsed(value: number) {
  const seconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
