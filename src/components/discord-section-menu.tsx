"use client";

import { useEffect, useState } from "react";

const sections = [
  { id: "discord-overview", label: "Overview & setup" },
  { id: "discord-calendar", label: "Calendar reminders & digest" },
  {
    id: "discord-transcription",
    label: "Voice recordings & screen share",
  },
  { id: "discord-moderation", label: "Timeout, mute & slowmode" },
  { id: "discord-channel-messages", label: "Channel messages" },
  { id: "discord-private-dms", label: "Gemini private-DM inbox" },
  { id: "discord-member-dms", label: "Members & DM settings" },
  { id: "discord-message-log", label: "Message archive" },
];

export function DiscordSectionMenu() {
  const [section, setSection] = useState(sections[0].id);

  useEffect(() => {
    const synchronizeHash = () => {
      const requested = window.location.hash.slice(1);
      if (sections.some((item) => item.id === requested)) {
        setSection(requested);
      }
    };
    const timer = window.setTimeout(synchronizeHash, 0);
    window.addEventListener("hashchange", synchronizeHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", synchronizeHash);
    };
  }, []);

  useEffect(() => {
    for (const item of sections) {
      const target = document.getElementById(item.id);
      if (!target) continue;
      target.hidden = item.id !== section;
      target.setAttribute(
        "aria-hidden",
        item.id === section ? "false" : "true",
      );
    }
  }, [section]);

  function openSection(id: string, scroll = true) {
    setSection(id);
    window.history.replaceState(null, "", `#${id}`);
    if (!scroll) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="mt-5 border border-[#4a321e] bg-[#0d0d0d]/95 p-4 shadow-2xl backdrop-blur sm:p-5">
      <label className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <span className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[.1em] text-[#999]">
            Discord workspace section
          </span>
          <select
            className="input"
            value={section}
            onChange={(event) => openSection(event.target.value)}
          >
            {sections.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </span>
        <button
          className="button secondary min-h-12 justify-center"
          type="button"
          onClick={() => openSection(section)}
        >
          Show selected section
        </button>
      </label>
      <p className="mt-3 text-xs leading-5 text-[#777]">
        Only the selected workspace is shown, keeping member lists, recording,
        calendar announcements, messages, and logs easy to find.
      </p>
    </div>
  );
}
