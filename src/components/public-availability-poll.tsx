"use client";

import { Check, Clock3, Eraser, Save } from "lucide-react";
import Image from "next/image";
import {
  type PointerEvent as ReactPointerEvent,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  submitAvailability,
  type AvailabilityState,
} from "@/app/p/[key]/actions";
import {
  availabilityOverlap,
  formatPollDate,
  formatPollTime,
  generateAvailabilitySlots,
  updateAvailabilitySelection,
  type AvailabilitySelectionMode,
} from "@/lib/availability";

const initial: AvailabilityState = { status: "idle", message: "" };
type Poll = {
  id: string;
  accessKey: string;
  title: string;
  description: string;
  timezone: string;
  dates: string[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
  status: "OPEN" | "CLOSED";
  responseCount: number;
};

export function PublicAvailabilityPoll({
  poll,
  responses,
  identity,
  initialResponse,
}: {
  poll: Poll;
  responses: Array<{ availableSlots: string[] }>;
  identity: { name: string; email: string } | null;
  initialResponse: {
    participantKey: string;
    name: string;
    email: string;
    availableSlots: string[];
  } | null;
}) {
  const [state, action, pending] = useActionState(submitAvailability, initial);
  const [participantKey, setParticipantKey] = useState(
    initialResponse?.participantKey ?? "",
  );
  const [name, setName] = useState(
    identity?.name ?? initialResponse?.name ?? "",
  );
  const [email, setEmail] = useState(
    identity?.email ?? initialResponse?.email ?? "",
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialResponse?.availableSlots ?? []),
  );
  const dragMode = useRef<AvailabilitySelectionMode | null>(null);
  const lastPaintedSlot = useRef<string | null>(null);
  const [mobileDate, setMobileDate] = useState(poll.dates[0] ?? "");
  const slots = useMemo(() => generateAvailabilitySlots(poll), [poll]);
  const times = useMemo(
    () => [...new Set(slots.map((slot) => slot.split("|")[1]))],
    [slots],
  );
  const overlap = useMemo(
    () => availabilityOverlap(slots, responses),
    [slots, responses],
  );
  const counts = useMemo(
    () => new Map(overlap.map((item) => [item.slot, item.count])),
    [overlap],
  );
  const peak = Math.max(1, ...overlap.map((item) => item.count));

  useEffect(() => {
    if (identity) {
      if (!participantKey) {
        const timer = window.setTimeout(
          () => setParticipantKey(crypto.randomUUID()),
          0,
        );
        return () => window.clearTimeout(timer);
      }
      return;
    }
    const keyName = `210-poll-${poll.id}`;
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(keyName) || "{}") as {
          participantKey?: string;
          name?: string;
          email?: string;
          slots?: string[];
        };
        const key =
          saved.participantKey && /^[0-9a-f-]{36}$/i.test(saved.participantKey)
            ? saved.participantKey
            : crypto.randomUUID();
        setParticipantKey(key);
        setName(saved.name ?? "");
        setEmail(saved.email ?? "");
        setSelected(
          new Set((saved.slots ?? []).filter((slot) => slots.includes(slot))),
        );
        localStorage.setItem(
          keyName,
          JSON.stringify({
            participantKey: key,
            name: saved.name ?? "",
            email: saved.email ?? "",
            slots: saved.slots ?? [],
          }),
        );
      } catch {
        setParticipantKey(crypto.randomUUID());
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [identity, participantKey, poll.id, slots]);

  useEffect(() => {
    if (!state.saved || !participantKey) return;
    if (!identity)
      localStorage.setItem(
        `210-poll-${poll.id}`,
        JSON.stringify({ participantKey, name, email, slots: [...selected] }),
      );
  }, [state.saved, participantKey, name, email, identity, poll.id, selected]);

  useEffect(() => {
    function endDrag() {
      dragMode.current = null;
      lastPaintedSlot.current = null;
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  function toggle(slot: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  function paintSlot(slot: string, mode: AvailabilitySelectionMode) {
    if (lastPaintedSlot.current === slot) return;
    lastPaintedSlot.current = slot;
    setSelected((current) => updateAvailabilitySelection(current, slot, mode));
  }
  function startDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    slot: string,
  ) {
    if (!event.isPrimary || event.button !== 0) return;
    const mode: AvailabilitySelectionMode = selected.has(slot)
      ? "clear"
      : "select";
    dragMode.current = mode;
    lastPaintedSlot.current = null;
    paintSlot(slot, mode);
  }
  function continueDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const mode = dragMode.current;
    if (!mode) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-availability-slot]");
    const slot = target?.dataset.availabilitySlot;
    if (slot) paintSlot(slot, mode);
  }
  function toggleDate(date: string) {
    const daySlots = slots.filter((slot) => slot.startsWith(`${date}|`));
    setSelected((current) => {
      const next = new Set(current);
      const all = daySlots.every((slot) => next.has(slot));
      daySlots.forEach((slot) => (all ? next.delete(slot) : next.add(slot)));
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-8 text-white grid-bg md:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <a
          href="https://210robotics.com"
          className="mb-7 inline-flex items-center gap-3"
          aria-label="210 Robotics home"
        >
          <span className="relative h-12 w-28">
            <Image
              src="/media/brand/210-banner.png"
              alt="210 Robotics"
              fill
              sizes="112px"
              className="object-contain"
              priority
            />
          </span>
          <span className="border-l border-[#333] pl-3 text-xs uppercase tracking-[.18em] text-[#888]">
            Availability poll
          </span>
        </a>
        <header className="border border-[#353535] bg-[#101010]">
          <div className="h-1.5 bg-[#fd7803]" />
          <div className="p-6 md:p-10">
            <p className="eyebrow">Find the best meeting time</p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-.04em] md:text-5xl">
              {poll.title}
            </h1>
            {poll.description && (
              <p className="mt-5 max-w-3xl leading-7 text-[#aaa]">
                {poll.description}
              </p>
            )}
            <p className="mt-5 text-xs uppercase tracking-wider text-[#777]">
              {poll.timezone.replaceAll("_", " ")} · {poll.responseCount}{" "}
              {poll.responseCount === 1 ? "response" : "responses"}
            </p>
          </div>
        </header>
        {poll.status === "CLOSED" ? (
          <section className="mt-5 border border-amber-500/40 bg-amber-500/5 p-7">
            <p className="eyebrow">Poll closed</p>
            <h2 className="mt-3 text-2xl font-bold">
              Availability is no longer being collected.
            </h2>
          </section>
        ) : (
          <form action={action} className="mt-5 grid gap-5">
            <input type="hidden" name="accessKey" value={poll.accessKey} />
            <input type="hidden" name="participantKey" value={participantKey} />
            {[...selected].map((slot) => (
              <input type="hidden" name="slots" value={slot} key={slot} />
            ))}
            <section className="border border-[#353535] bg-[#101010] p-5 md:p-7">
              <p className="eyebrow">Participant</p>
              {identity ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="border border-[#333] bg-[#0b0b0b] p-4">
                    <span className="text-xs uppercase tracking-wider text-[#777]">
                      Name
                    </span>
                    <strong className="mt-1 block">{identity.name}</strong>
                  </div>
                  <div className="border border-[#333] bg-[#0b0b0b] p-4">
                    <span className="text-xs uppercase tracking-wider text-[#777]">
                      Email
                    </span>
                    <strong className="mt-1 block break-all">
                      {identity.email}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    <span>Your name *</span>
                    <input
                      className="input"
                      name="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="First and last name"
                      autoComplete="name"
                      required
                      minLength={2}
                    />
                  </label>
                  <label className="field">
                    <span>Email *</span>
                    <input
                      className="input"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </label>
                </div>
              )}
              <p className="mt-3 text-sm text-[#888]">
                {identity
                  ? "This response is linked to your account. You can return from the member portal to update it while the poll is open."
                  : "Select every time you could attend. If this email belongs to a registered account, the response will appear in that member's portal. Otherwise, return with this browser to update it."}
              </p>
            </section>
            <section className="border border-[#353535] bg-[#101010] p-4 md:p-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Your availability</p>
                  <p className="mt-2 text-sm text-[#888]">
                    Orange means available. On the full grid, click and drag
                    across blocks to select or clear several at once.
                  </p>
                </div>
                <button
                  className="button secondary !min-h-10"
                  type="button"
                  onClick={() => setSelected(new Set())}
                >
                  <Eraser size={16} /> Clear all
                </button>
              </div>
              <div className="md:hidden">
                <div
                  className="flex gap-2 overflow-x-auto pb-3"
                  aria-label="Candidate dates"
                >
                  {poll.dates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      aria-pressed={mobileDate === date}
                      onClick={() => setMobileDate(date)}
                      className={`min-h-12 shrink-0 border px-4 py-2 text-sm font-semibold ${mobileDate === date ? "border-[#fd7803] bg-[#17120d] text-[#fd7803]" : "border-[#333] bg-[#0b0b0b]"}`}
                    >
                      {formatPollDate(date)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mb-3 w-full border border-[#444] bg-[#0b0b0b] px-4 py-3 text-sm text-[#aaa]"
                  onClick={() => toggleDate(mobileDate)}
                >
                  Select or clear this whole day
                </button>
                <div className="grid gap-2">
                  {times.map((time) => {
                    const slot = `${mobileDate}|${time}`;
                    const active = selected.has(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggle(slot)}
                        className={`flex min-h-14 items-center justify-between border px-4 py-3 text-left transition ${active ? "border-[#fd7803] bg-[#fd7803] text-black" : "border-[#333] bg-[#0b0b0b]"}`}
                      >
                        <span className="font-semibold">
                          {formatPollTime(time)}
                        </span>
                        <span className="flex items-center gap-2 text-sm">
                          {active ? (
                            <>
                              <Check size={18} /> Available
                            </>
                          ) : (
                            "Tap to select"
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="hidden overflow-x-auto pb-2 md:block">
                <div
                  className="grid min-w-[680px] select-none"
                  onPointerMove={continueDrag}
                  style={{
                    gridTemplateColumns: `110px repeat(${poll.dates.length}, minmax(130px, 1fr))`,
                  }}
                >
                  <div className="sticky left-0 z-20 border-b border-r border-[#333] bg-[#101010] p-3 text-xs text-[#777]">
                    Time
                  </div>
                  {poll.dates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggleDate(date)}
                      className="border-b border-r border-[#333] p-3 text-center transition hover:bg-[#17120d]"
                    >
                      <strong className="block text-sm">
                        {formatPollDate(date)}
                      </strong>
                      <span className="mt-1 block text-[10px] uppercase text-[#777]">
                        Select day
                      </span>
                    </button>
                  ))}
                  {times.map((time) => (
                    <div className="contents" key={time}>
                      <div className="sticky left-0 z-10 border-b border-r border-[#333] bg-[#101010] p-3 text-xs font-semibold">
                        {formatPollTime(time)}
                      </div>
                      {poll.dates.map((date) => {
                        const slot = `${date}|${time}`;
                        const active = selected.has(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            data-availability-slot={slot}
                            aria-pressed={active}
                            aria-label={`${active ? "Available" : "Unavailable"} ${formatPollDate(date)} at ${formatPollTime(time)}`}
                            onPointerDown={(event) => startDrag(event, slot)}
                            onClick={(event) => {
                              if (event.detail === 0) toggle(slot);
                            }}
                            className={`min-h-14 cursor-crosshair border-b border-r border-[#333] p-2 transition ${active ? "bg-[#fd7803] text-black hover:bg-[#ff9138]" : "bg-[#0c0c0c] hover:bg-[#24201b]"}`}
                          >
                            {active && <Check className="mx-auto" size={18} />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <div className="flex flex-wrap items-center gap-4 border border-[#333] bg-[#0d0d0d] p-5">
              <button className="button" disabled={pending || !participantKey}>
                <Save size={17} />{" "}
                {pending
                  ? "Saving…"
                  : state.saved
                    ? "Update availability"
                    : "Save availability"}
              </button>
              <p
                className={
                  state.status === "error"
                    ? "text-sm text-red-400"
                    : "text-sm text-emerald-400"
                }
                aria-live="polite"
              >
                {state.message}
              </p>
            </div>
          </form>
        )}
        <section className="mt-5 border border-[#353535] bg-[#101010] p-5 md:p-7">
          <div className="flex items-center gap-3">
            <Clock3 className="text-[#fd7803]" />
            <div>
              <p className="eyebrow">Best overlap</p>
              <h2 className="mt-1 text-2xl font-bold">Leading meeting times</h2>
            </div>
          </div>
          {responses.length ? (
            <div className="mt-5 grid gap-6">
              <AvailabilityHeatmap
                poll={poll}
                times={times}
                counts={counts}
                peak={peak}
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {overlap.slice(0, 5).map(({ slot, count }, index) => {
                  const [date, time] = slot.split("|");
                  return (
                    <article
                      className="border border-[#333] bg-[#0b0b0b] p-4"
                      key={slot}
                    >
                      <span className="font-mono text-xs text-[#fd7803]">
                        #{index + 1}
                      </span>
                      <strong className="mt-2 block">
                        {formatPollDate(date)}
                      </strong>
                      <span className="mt-1 block text-sm text-[#aaa]">
                        {formatPollTime(time)}
                      </span>
                      <div className="mt-4 h-2 bg-[#262626]">
                        <div
                          className="h-full bg-[#fd7803]"
                          style={{
                            width: `${((counts.get(slot) ?? 0) / peak) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="mt-2 block text-xs text-[#777]">
                        {count} available
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-5 border border-dashed border-[#333] p-6 text-center text-sm text-[#777]">
              The strongest times will appear after the first response.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function AvailabilityHeatmap({
  poll,
  times,
  counts,
  peak,
}: {
  poll: Poll;
  times: string[];
  counts: Map<string, number>;
  peak: number;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <strong>Group availability heatmap</strong>
        <span className="text-xs text-[#777]">
          Darker orange means more people are available.
        </span>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[620px]"
          style={{
            gridTemplateColumns: `100px repeat(${poll.dates.length}, minmax(110px, 1fr))`,
          }}
        >
          <div className="border-b border-r border-[#333] p-3 text-xs text-[#777]">
            Time
          </div>
          {poll.dates.map((date) => (
            <div
              className="border-b border-r border-[#333] p-3 text-center text-xs font-semibold"
              key={date}
            >
              {formatPollDate(date)}
            </div>
          ))}
          {times.map((time) => (
            <div className="contents" key={time}>
              <div className="border-b border-r border-[#333] p-3 text-xs font-semibold">
                {formatPollTime(time)}
              </div>
              {poll.dates.map((date) => {
                const slot = `${date}|${time}`;
                const count = counts.get(slot) ?? 0;
                const strength = count ? 0.18 + (count / peak) * 0.82 : 0;
                return (
                  <div
                    className="grid min-h-12 place-items-center border-b border-r border-[#333] text-xs font-bold"
                    key={slot}
                    style={{
                      backgroundColor: count
                        ? `rgb(253 120 3 / ${strength})`
                        : "#0b0b0b",
                      color: strength > 0.55 ? "#090909" : "#ddd",
                    }}
                    aria-label={`${count} people available ${formatPollDate(date)} at ${formatPollTime(time)}`}
                  >
                    {count || "–"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
