"use client";

import QRCode from "qrcode";
import Image from "next/image";
import {
  CalendarPlus,
  CheckCircle2,
  Download,
  ExternalLink,
  Pencil,
  Printer,
  QrCode,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  archiveActivity,
  closeAttendance,
  deleteActivity,
  openAttendance,
  saveActivity,
  setManualAttendance,
  voidAttendance,
  type ActivityFormState,
} from "@/app/admin/activity-actions";
import { activityTypeLabels, trainingTopics } from "@/lib/activity-options";

type ActivityRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: keyof typeof activityTypeLabels;
  topic: string | null;
  location: string;
  startsAt: string;
  endsAt: string;
  isPublic: boolean;
  status: "SCHEDULED" | "CANCELED" | "COMPLETED";
  archivedAt: string | null;
  attendanceOpenedAt: string | null;
  attendanceClosesAt: string | null;
  checkInUrl: string | null;
  attendees: Array<{
    id: string;
    memberId: string;
    name: string;
    role: string;
    checkedInAt: string;
    method: string;
    status: "PRESENT" | "VOID";
  }>;
};

const initial: ActivityFormState = { status: "idle", message: "" };

export function ActivityManager({
  activities,
  members,
  canExport,
}: {
  activities: ActivityRecord[];
  members: Array<{ id: string; name: string; role: string }>;
  canExport: boolean;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const createDialog = useRef<HTMLDialogElement>(null);
  const filtered = useMemo(
    () =>
      activities.filter(
        (activity) =>
          (type === "ALL" || activity.type === type) &&
          `${activity.title} ${activity.topic ?? ""} ${activity.description}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [activities, query, type],
  );

  function exportCsv() {
    const lines = [
      ["Activity", "Type", "Topic", "Member", "Role", "Checked in", "Method"],
      ...activities.flatMap((activity) =>
        activity.attendees
          .filter((row) => row.status === "PRESENT")
          .map((row) => [
            activity.title,
            activityTypeLabels[activity.type],
            activity.topic ?? "",
            row.name,
            row.role,
            row.checkedInAt,
            row.method,
          ]),
      ),
    ];
    const csv = lines
      .map((line) =>
        line
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "210-robotics-attendance.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(240px,1fr)_190px]">
          <label className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]"
              size={17}
            />
            <input
              className="input pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search attendance logs"
            />
          </label>
          <select
            className="input"
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="Activity type"
          >
            <option value="ALL">All activity types</option>
            {Object.entries(activityTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          {canExport && (
            <button className="button secondary" type="button" onClick={exportCsv}>
              <Download size={16} /> Export CSV
            </button>
          )}
          <button
            className="button"
            type="button"
            onClick={() => createDialog.current?.showModal()}
          >
            <CalendarPlus size={17} /> New attendance log
          </button>
        </div>
      </div>
      <dialog
        ref={createDialog}
        className="admin-dialog w-[min(680px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/85"
      >
        <ActivityForm onClose={() => createDialog.current?.close()} />
      </dialog>
      <div className="mt-6 grid gap-5">
        {filtered.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} members={members} />
        ))}
        {!filtered.length && (
          <p className="border border-dashed border-[#333] p-8 text-center text-sm text-[#777]">
            No attendance logs match these filters.
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityCard({
  activity,
  members,
}: {
  activity: ActivityRecord;
  members: Array<{ id: string; name: string; role: string }>;
}) {
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const qrDialog = useRef<HTMLDialogElement>(null);
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const present = activity.attendees.filter((row) => row.status === "PRESENT");

  useEffect(() => {
    if (!activity.checkInUrl) return;
    void QRCode.toDataURL(activity.checkInUrl, {
      width: 900,
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setQr);
  }, [activity.checkInUrl]);

  function toggleAttendance(action: typeof openAttendance | typeof closeAttendance) {
    const formData = new FormData();
    formData.set("activityId", activity.id);
    startTransition(async () => {
      const result = await action(formData);
      setMessage(result.message);
    });
  }

  function permanentlyDelete() {
    const formData = new FormData();
    formData.set("activityId", activity.id);
    startTransition(async () => {
      const result = await deleteActivity(formData);
      setDeleteMessage(result.status === "error" ? result.message : "");
      if (result.status === "success") deleteDialog.current?.close();
    });
  }

  function printQr() {
    if (!qr) return;
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) {
      setMessage("Allow popups to print this QR code.");
      return;
    }
    const page = popup.document;
    page.title = `${activity.title} attendance QR`;
    const wrapper = page.createElement("main");
    wrapper.style.cssText =
      "font-family:Arial,sans-serif;text-align:center;padding:32px;color:#111";
    const heading = page.createElement("h1");
    heading.textContent = activity.title;
    const image = page.createElement("img");
    image.src = qr;
    image.alt = `Attendance QR code for ${activity.title}`;
    image.style.cssText = "width:min(620px,90vw);height:auto";
    const note = page.createElement("p");
    note.textContent = "Scan, sign in, and attendance will be recorded automatically.";
    wrapper.append(heading, image, note);
    page.body.append(wrapper);
    image.addEventListener("load", () => {
      popup.focus();
      popup.print();
    });
  }

  return (
    <article className="border border-[#353535] bg-[#0c0c0c] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="tag">{activityTypeLabels[activity.type]}</span>
            {activity.topic && <span className="tag">{activity.topic}</span>}
          </div>
          <h3 className="mt-4 text-2xl font-bold">{activity.title}</h3>
          <p className="mt-2 text-sm text-[#777]">
            Attendance log · {present.length} member{present.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button secondary !min-h-10"
            type="button"
            onClick={() => editDialog.current?.showModal()}
          >
            <Pencil size={16} /> Edit activity
          </button>
          <button
            className="button secondary !min-h-10 !border-red-500/50 !text-red-300 hover:!border-red-400 hover:!text-red-200"
            type="button"
            onClick={() => {
              setDeleteMessage("");
              deleteDialog.current?.showModal();
            }}
          >
            <Trash2 size={16} /> Delete
          </button>
          {activity.checkInUrl && (
            <button
              className="button !min-h-10"
              type="button"
              onClick={() => qrDialog.current?.showModal()}
            >
              <QrCode size={16} /> Show QR
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-[#aaa]">
        {activity.description || "No event notes yet."}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#2d2d2d] pt-5">
        {activity.checkInUrl ? (
          <>
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => toggleAttendance(closeAttendance)}
            >
              Close attendance
            </button>
            <span className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 size={16} /> Check-in open
            </span>
          </>
        ) : (
          <button
            className="button"
            type="button"
            disabled={pending}
            onClick={() => toggleAttendance(openAttendance)}
          >
            {pending ? "Opening…" : "Reopen and generate QR"}
          </button>
        )}
        {message && (
          <p className="text-sm text-[#aaa]" aria-live="polite">
            {message}
          </p>
        )}
      </div>
      <details className="mt-5 border-t border-[#2d2d2d] pt-5">
        <summary className="cursor-pointer font-semibold text-[#ddd]">
          Attendance roster ({present.length})
        </summary>
        <div className="mt-4">
          <form
            action={setManualAttendance}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input type="hidden" name="activityId" value={activity.id} />
            <select className="input" name="memberId" required defaultValue="">
              <option value="" disabled>
                Add active member…
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
            <input className="input" name="note" placeholder="Optional attendance note" />
            <button className="button secondary">Mark present</button>
          </form>
          <div className="mt-4 divide-y divide-[#2b2b2b]">
            {present.map((row) => (
              <div className="flex items-center justify-between gap-4 py-3" key={row.id}>
                <div>
                  <strong>{row.name}</strong>
                  <p className="mt-1 text-xs text-[#777]">
                    {row.role} · {new Date(row.checkedInAt).toLocaleString()} ·{" "}
                    {row.method.replaceAll("_", " ")}
                  </p>
                </div>
                <form action={voidAttendance}>
                  <input type="hidden" name="attendanceId" value={row.id} />
                  <button className="text-xs text-red-400">Void</button>
                </form>
              </div>
            ))}
            {!present.length && (
              <p className="py-4 text-sm text-[#777]">No one has checked in yet.</p>
            )}
          </div>
        </div>
      </details>
      <dialog
        ref={editDialog}
        className="admin-dialog w-[min(680px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/85"
      >
        <ActivityForm activity={activity} onClose={() => editDialog.current?.close()} />
      </dialog>
      <dialog
        ref={deleteDialog}
        className="admin-dialog w-[min(540px,calc(100vw-2rem))] bg-[#101010] p-0 text-white backdrop:bg-black/85"
      >
        <div className="border border-red-500/40 p-6 md:p-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="eyebrow !text-red-400">Permanent action</p>
              <h2 className="mt-2 text-2xl font-bold">Delete this activity?</h2>
            </div>
            <button
              onClick={() => deleteDialog.current?.close()}
              type="button"
              aria-label="Close delete confirmation"
            >
              <X />
            </button>
          </div>
          <p className="mt-5 text-sm leading-7 text-[#bbb]">
            <strong className="text-white">{activity.title}</strong> will be permanently deleted,
            including its QR sign-in links and all recorded attendance. This cannot be undone. Use
            Archive activity instead if you may need this record later.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              className="button !border-red-500 !bg-red-500 !text-white hover:!border-red-400 hover:!bg-red-400"
              type="button"
              disabled={pending}
              onClick={permanentlyDelete}
            >
              <Trash2 size={16} /> {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => deleteDialog.current?.close()}
            >
              Keep activity
            </button>
            {deleteMessage && (
              <p className="w-full text-sm text-red-300" aria-live="polite">
                {deleteMessage}
              </p>
            )}
          </div>
        </div>
      </dialog>
      <dialog
        ref={qrDialog}
        className="admin-dialog w-[min(760px,calc(100vw-2rem))] bg-white p-0 text-[#111] backdrop:bg-black/90"
      >
        <div className="relative p-7 text-center md:p-10">
          <button
            className="absolute right-4 top-4"
            onClick={() => qrDialog.current?.close()}
            aria-label="Close QR code"
          >
            <X />
          </button>
          {qr ? (
            <Image
              className="mx-auto w-full max-w-[500px]"
              src={qr}
              alt={`Attendance QR code for ${activity.title}`}
              width={900}
              height={900}
              unoptimized
            />
          ) : (
            <div className="mx-auto grid aspect-square w-full max-w-[500px] place-items-center bg-[#f4f4f4] text-sm text-[#666]">
              Generating QR code…
            </div>
          )}
          <h3 className="mt-4 text-3xl font-bold">{activity.title}</h3>
          <p className="mt-2 text-sm text-[#555]">
            Scan and sign in to record attendance automatically.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              className={`button ${qr ? "" : "pointer-events-none opacity-50"}`}
              href={qr || undefined}
              download={`${activity.slug}-attendance.png`}
            >
              <Download size={16} /> Download QR
            </a>
            <button className="button" type="button" disabled={!qr} onClick={printQr}>
              <Printer size={16} /> Print QR
            </button>
            <a
              className="button secondary !border-[#bbb] !text-[#222]"
              href={activity.checkInUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Open sign-in link
            </a>
          </div>
        </div>
      </dialog>
    </article>
  );
}

function ActivityForm({
  activity,
  onClose,
}: {
  activity?: ActivityRecord;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveActivity, initial);
  return (
    <div className="border border-[#383838] p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow">Attendance</p>
          <h2 className="mt-2 text-2xl font-bold">
            {activity ? "Edit attendance log" : "Create attendance log"}
          </h2>
        </div>
        <button onClick={onClose} type="button" aria-label="Close activity editor">
          <X />
        </button>
      </div>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="activityId" value={activity?.id ?? ""} />
        <Field label="Event name">
          <input
            className="input"
            name="title"
            defaultValue={activity?.title}
            placeholder="Weekly build meeting"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Activity type">
            <select className="input" name="type" defaultValue={activity?.type ?? "MEETING"}>
              {Object.entries(activityTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Training topic (optional)">
            <input
              className="input"
              name="topic"
              list="training-topics"
              defaultValue={activity?.topic ?? ""}
              placeholder="Programming, CAD, design…"
            />
            <datalist id="training-topics">
              {trainingTopics.map((topic) => (
                <option value={topic} key={topic} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Event notes">
          <textarea
            className="input min-h-36"
            name="notes"
            defaultValue={activity?.description}
            placeholder="Agenda, decisions, follow-up work, or anything members should remember."
          />
        </Field>
        {!activity && (
          <p className="border-l-2 border-[#fd7803] bg-[#17120d] px-4 py-3 text-sm leading-6 text-[#bbb]">
            Saving creates the attendance link and QR code automatically. The code stays open
            until an admin closes it.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : activity ? "Save changes" : "Create and generate QR"}
          </button>
          {activity && (
            <button className="text-sm text-red-400" formAction={archiveActivity}>
              Archive activity
            </button>
          )}
          <p
            className={
              state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"
            }
            aria-live="polite"
          >
            {state.message}
          </p>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
