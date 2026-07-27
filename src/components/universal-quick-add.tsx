"use client";

import { Plus, X, Zap } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { memberQuickAdd } from "@/app/admin/control-center/actions";
import { CalendarInput } from "@/components/calendar-input";

type State = { ok: boolean; message: string };
const initialState: State = { ok: false, message: "" };
const draftKey = "210-universal-quick-add-draft";

export function UniversalQuickAdd() {
  const pathname = usePathname();
  const enabled =
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(draftKey);
      return stored ? (JSON.parse(stored) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  const formRef = useRef<HTMLFormElement>(null);
  const [state, submit, pending] = useActionState(
    async (_previous: State, formData: FormData): Promise<State> => {
      try {
        await memberQuickAdd(formData);
        localStorage.removeItem(draftKey);
        setDraft({});
        formRef.current?.reset();
        return {
          ok: true,
          message: "Saved. It is now part of the team workspace.",
        };
      } catch (error) {
        console.error(error);
        return {
          ok: false,
          message:
            "This item could not be saved. Check the required fields and try again.",
        };
      }
    },
    initialState,
  );
  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("open-quick-add", listener);
    return () => window.removeEventListener("open-quick-add", listener);
  }, []);
  if (!enabled) return null;
  function saveDraft() {
    if (!formRef.current) return;
    const next = Object.fromEntries(
      [...new FormData(formRef.current).entries()].filter(
        ([, item]) => typeof item === "string",
      ),
    ) as Record<string, string>;
    setDraft(next);
    localStorage.setItem(draftKey, JSON.stringify(next));
  }
  return (
    <>
      <button
        className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-[#fd7803] px-5 font-bold text-black shadow-2xl transition hover:bg-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus className="h-5 w-5" />{" "}
        <span className="hidden sm:inline">Quick add</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[110] grid place-items-end bg-black/75 p-3 backdrop-blur-sm sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Universal quick add"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto border border-[#444] bg-[#101010] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">
                  <Zap className="mr-1 inline h-3 w-3" /> Universal quick add
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  Capture it before it gets lost.
                </h2>
                <p className="mt-2 text-sm text-[#888]">
                  Your draft is recovered automatically on this device.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            <form
              ref={formRef}
              action={submit}
              className="mt-6 grid gap-4"
              onInput={saveDraft}
            >
              <label className="field">
                <span>What are you adding?</span>
                <select
                  className="input"
                  name="quickKind"
                  defaultValue={draft.quickKind || "CONTRIBUTION"}
                >
                  <option value="CONTRIBUTION">
                    Contribution / outreach / code
                  </option>
                  <option value="NOTEBOOK_SUGGESTION">
                    Engineering notebook quick capture
                  </option>
                  <option value="ISSUE">Issue / test failure</option>
                </select>
              </label>
              <label className="field">
                <span>Title</span>
                <input
                  className="input"
                  name="title"
                  defaultValue={draft.title}
                  required
                />
              </label>
              <label className="field">
                <span>Details</span>
                <textarea
                  className="input min-h-32"
                  name="description"
                  defaultValue={draft.description}
                  placeholder="What happened, what changed, evidence, result, and next step…"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field">
                  <span>Date</span>
                  <CalendarInput
                    type="datetime-local"
                    name="occurredAt"
                    defaultValue={draft.occurredAt}
                  />
                </label>
                <label className="field">
                  <span>Priority</span>
                  <select
                    className="input"
                    name="priority"
                    defaultValue={draft.priority || "NORMAL"}
                  >
                    <option>LOW</option>
                    <option>NORMAL</option>
                    <option>HIGH</option>
                    <option>CRITICAL</option>
                  </select>
                </label>
                <label className="field">
                  <span>Project</span>
                  <input
                    className="input"
                    name="project"
                    defaultValue={draft.project}
                    placeholder="VEX U, RoboRowdy…"
                  />
                </label>
                <label className="field">
                  <span>Category</span>
                  <input
                    className="input"
                    name="category"
                    defaultValue={draft.category}
                    placeholder="Design, Code, Outreach…"
                  />
                </label>
              </div>
              <label className="field">
                <span>Evidence / reference link</span>
                <input
                  className="input"
                  name="sourceUrl"
                  type="url"
                  defaultValue={draft.sourceUrl}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button className="button" disabled={pending}>
                  {pending ? "Saving…" : "Save capture"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(draftKey);
                    setDraft({});
                    formRef.current?.reset();
                  }}
                >
                  Discard draft
                </button>
              </div>
              {state.message && (
                <p
                  className={
                    state.ok
                      ? "text-sm text-emerald-400"
                      : "text-sm text-red-400"
                  }
                  aria-live="polite"
                >
                  {state.message}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
