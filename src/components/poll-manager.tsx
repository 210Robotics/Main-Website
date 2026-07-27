"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  Plus,
  Printer,
  QrCode,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CalendarInput } from "@/components/calendar-input";
import QRCode from "qrcode";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createAvailabilityPoll,
  deleteAvailabilityPoll,
  deleteAvailabilityResponse,
  duplicateAvailabilityPoll,
  saveAvailabilityPoll,
  type PollManagerState,
} from "@/app/admin/poll-actions";
import {
  availabilityDateRange,
  availabilityOverlap,
  formatPollDate,
  formatPollTime,
  generateAvailabilitySlots,
} from "@/lib/availability";

type PollRecord = {
  id: string;
  accessKey: string;
  title: string;
  description: string;
  timezone: string;
  dates: string[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  responseCount: number;
  updatedAt: string;
};
type PollResponse = {
  id: string;
  pollId: string;
  name: string;
  email: string;
  availableSlots: string[];
  submittedAt: string;
  updatedAt: string;
  memberName: string | null;
};
const initial: PollManagerState = { status: "idle", message: "" };

export function PollManager({
  polls,
  responses,
}: {
  polls: PollRecord[];
  responses: PollResponse[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(polls[0]?.id ?? "");
  const createDialog = useRef<HTMLDialogElement>(null);
  const [createState, createAction, createPending] = useActionState(
    async (previous: PollManagerState, data: FormData) => {
      const result = await createAvailabilityPoll(previous, data);
      if (result.pollId) {
        setSelectedId(result.pollId);
        createDialog.current?.close();
        router.refresh();
      }
      return result;
    },
    initial,
  );
  const selected =
    polls.find((poll) => poll.id === selectedId) ?? polls[0] ?? null;
  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border border-[#333] bg-[#0b0b0b] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Poll library</p>
            <p className="mt-2 text-xs text-[#777]">{polls.length} total</p>
          </div>
          <button
            className="button !min-h-10 !px-3"
            type="button"
            onClick={() => createDialog.current?.showModal()}
          >
            <Plus size={16} /> New
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {polls.map((poll) => (
            <button
              key={poll.id}
              type="button"
              onClick={() => setSelectedId(poll.id)}
              className={`border p-3 text-left transition ${selected?.id === poll.id ? "border-[#fd7803] bg-[#17120d]" : "border-[#2e2e2e] bg-[#0e0e0e] hover:border-[#666]"}`}
            >
              <span className="block truncate font-semibold">{poll.title}</span>
              <span className="mt-2 flex justify-between gap-3 text-[11px] uppercase tracking-wider text-[#777]">
                <span
                  className={
                    poll.status === "OPEN"
                      ? "text-emerald-400"
                      : poll.status === "CLOSED"
                        ? "text-amber-300"
                        : ""
                  }
                >
                  {poll.status}
                </span>
                <span>{poll.responseCount} people</span>
              </span>
            </button>
          ))}
          {!polls.length && (
            <p className="border border-dashed border-[#333] p-5 text-center text-sm text-[#777]">
              No scheduling polls yet.
            </p>
          )}
        </div>
      </aside>
      {selected ? (
        <PollEditor
          key={selected.id}
          poll={selected}
          responses={responses.filter(
            (response) => response.pollId === selected.id,
          )}
        />
      ) : (
        <div className="grid min-h-96 place-items-center border border-dashed border-[#3a3a3a] p-8 text-center">
          <div>
            <CalendarDays className="mx-auto text-[#555]" size={44} />
            <h3 className="mt-5 text-xl font-bold">Find a meeting time</h3>
            <p className="mt-2 max-w-md text-sm text-[#777]">
              Offer candidate dates and time blocks, then share a private link
              for everyone to mark availability.
            </p>
            <button
              className="button mt-5"
              type="button"
              onClick={() => createDialog.current?.showModal()}
            >
              <Plus size={16} /> New poll
            </button>
          </div>
        </div>
      )}
      <dialog
        ref={createDialog}
        className="admin-dialog w-[min(520px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/85"
      >
        <form
          action={createAction}
          className="border border-[#383838] p-6 md:p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">New availability poll</p>
              <h2 className="mt-2 text-2xl font-bold">
                What are you scheduling?
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => createDialog.current?.close()}
            >
              <X />
            </button>
          </div>
          <label className="field mt-6">
            <span>Poll title</span>
            <input
              className="input"
              name="title"
              placeholder="VEX U design review"
              required
            />
          </label>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button className="button" disabled={createPending}>
              {createPending ? "Creating…" : "Create poll"}
            </button>
            <p
              className={
                createState.status === "error"
                  ? "text-sm text-red-400"
                  : "text-sm text-emerald-400"
              }
            >
              {createState.message}
            </p>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function PollEditor({
  poll,
  responses,
}: {
  poll: PollRecord;
  responses: PollResponse[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(poll.title);
  const [description, setDescription] = useState(poll.description);
  const [timezone, setTimezone] = useState(poll.timezone);
  const [dates, setDates] = useState(poll.dates);
  const [rangeStart, setRangeStart] = useState(poll.dates[0] ?? "");
  const [rangeEnd, setRangeEnd] = useState(poll.dates.at(-1) ?? "");
  const [rangeDirty, setRangeDirty] = useState(false);
  const [startTime, setStartTime] = useState(poll.startTime);
  const [endTime, setEndTime] = useState(poll.endTime);
  const [slotMinutes, setSlotMinutes] = useState(poll.slotMinutes);
  const [status, setStatus] = useState(poll.status);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const shareDialog = useRef<HTMLDialogElement>(null);
  const resultsDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  function save() {
    setMessage("");
    startTransition(async () => {
      try {
        const rangeDates = rangeDirty
          ? availabilityDateRange(rangeStart, rangeEnd)
          : dates;
        if (!rangeDates.length) {
          setMessage("Choose a valid date range with at least one day.");
          return;
        }
        const result = await saveAvailabilityPoll({
          id: poll.id,
          title,
          description,
          timezone,
          dates: rangeDates,
          startTime: startTime.slice(0, 5),
          endTime: endTime.slice(0, 5),
          slotMinutes,
          status,
        });
        setMessage(result.message);
        if (result.savedPoll) {
          setTitle(result.savedPoll.title);
          setDescription(result.savedPoll.description);
          setTimezone(result.savedPoll.timezone);
          setDates(result.savedPoll.dates);
          setRangeStart(result.savedPoll.dates[0] ?? "");
          setRangeEnd(result.savedPoll.dates.at(-1) ?? "");
          setRangeDirty(false);
          setStartTime(result.savedPoll.startTime);
          setEndTime(result.savedPoll.endTime);
          setSlotMinutes(result.savedPoll.slotMinutes);
          setStatus(result.savedPoll.status);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The poll could not be saved.");
      }
    });
  }
  function duplicate() {
    startTransition(async () =>
      setMessage((await duplicateAvailabilityPoll(poll.id)).message),
    );
  }
  function remove() {
    startTransition(async () => {
      const result = await deleteAvailabilityPoll(poll.id);
      setMessage(result.message);
      if (result.status === "success") {
        deleteDialog.current?.close();
        router.refresh();
      }
    });
  }
  function addDate() {
    const last = dates.at(-1);
    const next = new Date(last ? `${last}T12:00:00Z` : Date.now() + 86_400_000);
    next.setUTCDate(next.getUTCDate() + (last ? 1 : 0));
    setDates([...dates, next.toISOString().slice(0, 10)].slice(0, 14));
  }
  function applyDateRange() {
    if (!rangeStart || !rangeEnd || rangeEnd < rangeStart)
      return setMessage("Choose a valid start and end date.");
    const next: string[] = [];
    const cursor = new Date(`${rangeStart}T12:00:00Z`);
    const end = new Date(`${rangeEnd}T12:00:00Z`);
    while (cursor <= end && next.length < 14) {
      next.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    setDates(next);
    setRangeDirty(false);
    setMessage(
      end > new Date(`${next.at(-1)}T12:00:00Z`)
        ? "Date ranges are limited to 14 days."
        : "Candidate date range applied.",
    );
  }
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border border-[#333] bg-[#0d0d0d] p-4">
        <div>
          <p className="eyebrow">Availability poll</p>
          <p className="mt-2 text-xs text-[#777]">
            Updated {new Date(poll.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button secondary !min-h-10"
            type="button"
            onClick={() => resultsDialog.current?.showModal()}
          >
            <BarChart3 size={16} /> Results ({responses.length})
          </button>
          {status === "OPEN" && (
            <a
              className="button secondary !min-h-10"
              href={`/p/${poll.accessKey}`}
              target="_blank"
              rel="noreferrer"
            >
              <Eye size={16} /> Open poll
            </a>
          )}
          <button
            className="button secondary !min-h-10"
            type="button"
            onClick={() => shareDialog.current?.showModal()}
          >
            <QrCode size={16} /> Share
          </button>
          <button
            className="button !min-h-10"
            type="button"
            onClick={save}
            disabled={pending}
          >
            <Save size={16} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </header>
      <section className="grid gap-5 border border-[#333] bg-[#0d0d0d] p-5 md:p-7">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="field">
            <span>Title</span>
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              className="input"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as PollRecord["status"])
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Instructions (optional)</span>
          <textarea
            className="input min-h-24"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this meeting for?"
          />
        </label>
        <label className="field max-w-md">
          <span>Timezone</span>
          <select
            className="input"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            <option value="America/Chicago">America/Chicago (Central)</option>
            <option value="America/New_York">America/New_York (Eastern)</option>
            <option value="America/Denver">America/Denver (Mountain)</option>
            <option value="America/Los_Angeles">
              America/Los_Angeles (Pacific)
            </option>
          </select>
        </label>
      </section>
      <section className="border border-[#333] bg-[#0d0d0d] p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Candidate dates</p>
            <h3 className="mt-2 text-xl font-bold">Days people can choose.</h3>
          </div>
          <button
            className="button secondary !min-h-10"
            type="button"
            onClick={addDate}
            disabled={dates.length >= 14}
          >
            <Plus size={16} /> Add date
          </button>
        </div>
        <div className="mt-5 grid gap-3 border border-[#333] bg-[#111] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="field">
            <span>Range start</span>
            <CalendarInput
              type="date"
              value={rangeStart}
              onChange={(event) => { setRangeStart(event.target.value); setRangeDirty(true); }}
            />
          </label>
          <label className="field">
            <span>Range end</span>
            <CalendarInput
              type="date"
              value={rangeEnd}
              onChange={(event) => { setRangeEnd(event.target.value); setRangeDirty(true); }}
            />
          </label>
          <button
            className="button secondary"
            type="button"
            onClick={applyDateRange}
          >
            Use date range
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dates.map((date, index) => (
            <div className="flex gap-2" key={`${date}-${index}`}>
              <CalendarInput
                type="date"
                value={date}
                onChange={(event) =>
                  setDates(
                    dates.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  )
                }
              />
              <button
                className="calendar-control shrink-0 text-red-400"
                type="button"
                aria-label={`Remove ${date}`}
                onClick={() =>
                  setDates(dates.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-4 border border-[#333] bg-[#0d0d0d] p-5 md:grid-cols-3 md:p-7">
        <label className="field">
          <span>Start time</span>
          <input
            className="input"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label className="field">
          <span>End time</span>
          <input
            className="input"
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Time blocks</span>
          <select
            className="input"
            value={slotMinutes}
            onChange={(event) => setSlotMinutes(Number(event.target.value))}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </label>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#333] pt-5">
        <p
          className={
            message.toLowerCase().includes("could not")
              ? "text-sm text-red-400"
              : "text-sm text-[#999]"
          }
          aria-live="polite"
        >
          {message || "Save before sharing changes."}
        </p>
        <div className="flex gap-4">
          <button
            className="text-sm text-[#aaa]"
            type="button"
            onClick={duplicate}
          >
            <Copy className="inline" size={15} /> Duplicate
          </button>
          <button
            className="text-sm text-red-400"
            type="button"
            onClick={() => deleteDialog.current?.showModal()}
          >
            <Trash2 className="inline" size={15} /> Delete
          </button>
        </div>
      </div>
      <PollShareDialog dialogRef={shareDialog} poll={{ ...poll, title, status, dates, startTime, endTime, slotMinutes }} />
      <PollResultsDialog
        dialogRef={resultsDialog}
        poll={{ ...poll, title, dates, startTime, endTime, slotMinutes }}
        responses={responses}
      />
      <dialog
        ref={deleteDialog}
        className="admin-dialog w-[min(540px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/85"
      >
        <div className="border border-red-500/40 p-7">
          <h2 className="text-2xl font-bold">Delete this poll?</h2>
          <p className="mt-4 text-sm leading-7 text-[#bbb]">
            The private link and all availability responses will be permanently
            deleted.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              className="button !bg-red-500 !text-white"
              type="button"
              onClick={remove}
              disabled={pending}
            >
              <Trash2 size={16} /> Delete permanently
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => deleteDialog.current?.close()}
            >
              Keep poll
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function PollShareDialog({
  dialogRef,
  poll,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  poll: PollRecord;
}) {
  const url = `https://210robotics.com/p/${poll.accessKey}`;
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void QRCode.toDataURL(url, {
      width: 900,
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQr);
  }, [url]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      setMessage("Copy the link from the field.");
    }
  }
  function print() {
    if (!qr) return;
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) return setMessage("Allow popups to print the QR code.");
    popup.document.write(
      `<main style="font-family:Arial;text-align:center;padding:32px"><h1>${poll.title.replace(/[<>&]/g, "")}</h1><img style="width:min(620px,90vw)" src="${qr}" alt="Poll QR"><p>Scan to share your availability with 210 Robotics.</p></main>`,
    );
    popup.document.close();
    popup.addEventListener("load", () => popup.print());
  }
  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog w-[min(760px,calc(100vw-2rem))] bg-white p-0 text-[#111] backdrop:bg-black/90"
    >
      <div className="relative p-7 text-center md:p-10">
        <button
          className="absolute right-4 top-4"
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close"
        >
          <X />
        </button>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#bd5600]">
          Availability sharing
        </p>
        <h2 className="mt-3 text-3xl font-bold">{poll.title}</h2>
        {poll.status !== "OPEN" && (
          <p className="mx-auto mt-4 max-w-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Set this poll to Open and save before sharing.
          </p>
        )}
        {qr && (
          <Image
            className="mx-auto mt-5 h-auto w-full max-w-[440px]"
            src={qr}
            alt={`QR code for ${poll.title}`}
            width={900}
            height={900}
            unoptimized
          />
        )}
        <input
          className="mt-5 w-full border border-[#bbb] bg-[#f6f6f6] px-4 py-3 text-sm"
          readOnly
          value={url}
        />
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button className="button" type="button" onClick={() => void copy()}>
            <ClipboardCopy size={16} /> Copy link
          </button>
          <a
            className="button"
            href={qr || undefined}
            download={`${poll.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-availability-qr.png`}
          >
            <Download size={16} /> Download QR
          </a>
          <button className="button" type="button" onClick={print}>
            <Printer size={16} /> Print QR
          </button>
          {poll.status === "OPEN" && (
            <a
              className="button secondary !border-[#999] !text-[#222]"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              <Eye size={16} /> Open poll
            </a>
          )}
        </div>
        <p className="mt-4 text-sm text-[#555]">
          {message ||
            "Anyone with this private link can respond without an account."}
        </p>
      </div>
    </dialog>
  );
}

function PollResultsDialog({
  dialogRef,
  poll,
  responses,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  poll: PollRecord;
  responses: PollResponse[];
}) {
  const [message, setMessage] = useState("");
  const [selectedResponseId, setSelectedResponseId] = useState(
    responses[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();
  const slots = useMemo(() => {
    try {
      return generateAvailabilitySlots(poll);
    } catch {
      return [];
    }
  }, [poll]);
  const overlap = useMemo(
    () => availabilityOverlap(slots, responses),
    [slots, responses],
  );
  const peak = Math.max(1, ...overlap.map((item) => item.count));
  const times = [...new Set(slots.map((slot) => slot.split("|")[1]))];
  const counts = new Map(overlap.map((item) => [item.slot, item.count]));
  const selectedResponse =
    responses.find((response) => response.id === selectedResponseId) ?? null;
  function remove(id: string) {
    if (!confirm("Delete this availability response?")) return;
    startTransition(async () =>
      setMessage((await deleteAvailabilityResponse(id)).message),
    );
  }
  function exportCsv() {
    const rows = [
      ["Name", "Email", "Account", "Available times", "Updated"],
      ...responses.map((response) => [
        response.name,
        response.email,
        response.memberName ?? "Anonymous",
        response.availableSlots.join("; "),
        response.updatedAt,
      ]),
    ];
    const safe = (value: string) =>
      /^[=+\-@]/.test(value) ? `'${value}` : value;
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${safe(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `${poll.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-availability.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }
  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog h-[min(88vh,900px)] w-[min(1080px,calc(100vw-2rem))] bg-[#0d0d0d] p-0 text-white backdrop:bg-black/90"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-[#333] p-6">
          <div>
            <p className="eyebrow">Overlap & responses</p>
            <h2 className="mt-2 text-2xl font-bold">{poll.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
          >
            <X />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {overlap.slice(0, 5).map(({ slot, count }, index) => {
              const [date, time] = slot.split("|");
              return (
                <article
                  className="border border-[#333] bg-[#111] p-4"
                  key={slot}
                >
                  <span className="font-mono text-xs text-[#fd7803]">
                    #{index + 1}
                  </span>
                  <strong className="mt-2 block">{formatPollDate(date)}</strong>
                  <span className="text-sm text-[#aaa]">
                    {formatPollTime(time)}
                  </span>
                  <div className="mt-3 h-2 bg-[#262626]">
                    <div
                      className="h-full bg-[#fd7803]"
                      style={{ width: `${(count / peak) * 100}%` }}
                    />
                  </div>
                  <span className="mt-2 block text-xs text-[#777]">
                    {count} of {responses.length} available
                  </span>
                </article>
              );
            })}
          </div>
          <PollHeatmap
            poll={poll}
            times={times}
            counts={counts}
            peak={peak}
            title="Group availability heatmap"
            subtitle="Darker orange means more people overlap."
          />
          {responses.length > 0 && (
            <section className="mt-7 border border-[#333] bg-[#111] p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Individual view</p>
                  <h3 className="mt-2 text-xl font-bold">
                    Inspect one participant
                  </h3>
                </div>
                <label className="field min-w-[240px]">
                  <span>Participant</span>
                  <select
                    className="input"
                    value={selectedResponseId}
                    onChange={(event) =>
                      setSelectedResponseId(event.target.value)
                    }
                  >
                    {responses.map((response) => (
                      <option value={response.id} key={response.id}>
                        {response.name} · {response.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedResponse && (
                <PollHeatmap
                  poll={poll}
                  times={times}
                  counts={
                    new Map(
                      slots.map((slot) => [
                        slot,
                        selectedResponse.availableSlots.includes(slot) ? 1 : 0,
                      ]),
                    )
                  }
                  peak={1}
                  title={selectedResponse.name}
                  subtitle={`${selectedResponse.email} · ${selectedResponse.memberName ? "Linked account" : "Guest response"}`}
                  individual
                />
              )}
            </section>
          )}
          <div className="mt-7 flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Participants</p>
              <h3 className="mt-2 text-xl font-bold">
                {responses.length} responses
              </h3>
            </div>
            <button
              className="button secondary"
              type="button"
              onClick={exportCsv}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {responses.map((response) => (
              <details
                className="border border-[#333] bg-[#111] p-4"
                key={response.id}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <strong>{response.name}</strong>
                    <p className="mt-1 text-xs text-[#777]">
                      {response.email} · {response.memberName ?? "Guest"} ·{" "}
                      {response.availableSlots.length} time blocks
                    </p>
                  </div>
                  <span className="tag">
                    <Users size={13} /> View
                  </span>
                </summary>
                <div className="mt-4 border-t border-[#333] pt-4">
                  <div className="flex flex-wrap gap-2">
                    {response.availableSlots.map((slot) => {
                      const [date, time] = slot.split("|");
                      return (
                        <span className="tag" key={slot}>
                          {formatPollDate(date)} · {formatPollTime(time)}
                        </span>
                      );
                    })}
                  </div>
                  <button
                    className="mt-4 text-xs text-red-400"
                    type="button"
                    disabled={pending}
                    onClick={() => remove(response.id)}
                  >
                    <Trash2 className="inline" size={14} /> Delete response
                  </button>
                </div>
              </details>
            ))}
            {!responses.length && (
              <p className="border border-dashed border-[#333] p-8 text-center text-sm text-[#777]">
                No one has responded yet.
              </p>
            )}
          </div>
        </div>
        <footer
          className="border-t border-[#333] px-5 py-3 text-xs text-[#888]"
          aria-live="polite"
        >
          {pending
            ? "Updating…"
            : message ||
              "Ranked by the highest number of available participants."}
        </footer>
      </div>
    </dialog>
  );
}

function PollHeatmap({
  poll,
  times,
  counts,
  peak,
  title,
  subtitle,
  individual = false,
}: {
  poll: PollRecord;
  times: string[];
  counts: Map<string, number>;
  peak: number;
  title: string;
  subtitle: string;
  individual?: boolean;
}) {
  return (
    <div className="mt-7">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <strong>{title}</strong>
        <span className="text-xs text-[#777]">{subtitle}</span>
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
                const strength = count
                  ? individual
                    ? 1
                    : 0.18 + (count / peak) * 0.82
                  : 0;
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
                  >
                    {individual ? (count ? "Available" : "–") : count || "–"}
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
