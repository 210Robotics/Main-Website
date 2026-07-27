"use client";

import { GripVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteNotebookPage,
  reorderNotebookPages,
} from "@/app/admin/operations/engineering-actions";

type NotebookPage = {
  id: string;
  title: string;
  entryType: string;
  currentVersion: number;
};

export function NotebookPageOrganizer({ pages }: { pages: NotebookPage[] }) {
  const router = useRouter();
  const [ordered, setOrdered] = useState(pages);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function stage(next: NotebookPage[]) {
    setOrdered(next);
    setDirty(true);
    setMessage("Order changed. Save to apply it to the notebook.");
  }

  function save() {
    setMessage("Saving page order…");
    startTransition(async () => {
      try {
        const result = await reorderNotebookPages(ordered.map((page) => page.id));
        setMessage(result.message);
        setDirty(false);
        router.refresh();
      } catch (error) {
        setOrdered(pages);
        setDirty(false);
        setMessage(error instanceof Error ? error.message : "Page order could not be saved.");
      }
    });
  }

  function move(id: string, targetId: string) {
    if (id === targetId) return;
    const next = [...ordered];
    const from = next.findIndex((page) => page.id === id);
    const target = next.findIndex((page) => page.id === targetId);
    if (from < 0 || target < 0) return;
    const [page] = next.splice(from, 1);
    next.splice(target, 0, page);
    stage(next);
  }

  function nudge(id: string, direction: -1 | 1) {
    const index = ordered.findIndex((page) => page.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    stage(next);
  }

  function remove(page: NotebookPage) {
    if (!window.confirm(`Delete “${page.title}” and its version history? This cannot be undone.`))
      return;
    startTransition(async () => {
      try {
        const result = await deleteNotebookPage(page.id);
        setOrdered((current) => current.filter((candidate) => candidate.id !== page.id));
        setMessage(result.message);
        setDirty(false);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Page could not be deleted.");
      }
    });
  }

  return (
    <section className="border border-[#333] bg-[#0d0d0d] p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Notebook pages</h3>
          <p className="mt-2 text-sm text-[#888]">
            Drag pages into order or use the arrow buttons, then save. Page names follow the first heading in each page.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="text-xs text-[#777]" aria-live="polite">
            {pending ? "Saving…" : message}
          </p>
          <button className="button min-h-10 px-4 text-xs" type="button" disabled={pending || !dirty} onClick={save}>
            {pending ? "Saving…" : "Save page order"}
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {ordered.map((page, index) => (
          <div
            className={`flex items-center gap-2 border bg-[#111] p-2 transition ${draggedId === page.id ? "border-[#fd7803] opacity-60" : "border-[#303030] hover:border-[#555]"}`}
            draggable={!pending}
            key={page.id}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", page.id);
              setDraggedId(page.id);
            }}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
              if (sourceId) move(sourceId, page.id);
              setDraggedId(null);
            }}
          >
            <GripVertical className="size-4 shrink-0 cursor-grab text-[#666]" aria-hidden="true" />
            <span className="w-10 shrink-0 font-mono text-[.65rem] text-[#fd7803]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Link className="min-w-0 flex-1 py-2" href={`/admin/operations?tool=notebook&entry=${page.id}#notebook-page-${page.id}`}>
              <strong className="block truncate text-sm">{page.title}</strong>
              <span className="mt-1 block text-[.65rem] uppercase tracking-wider text-[#777]">
                {page.entryType} · version {page.currentVersion}
              </span>
            </Link>
            <button className="button-ghost min-h-9 px-2" type="button" disabled={pending || index === 0} aria-label={`Move ${page.title} up`} onClick={() => nudge(page.id, -1)}>↑</button>
            <button className="button-ghost min-h-9 px-2" type="button" disabled={pending || index === ordered.length - 1} aria-label={`Move ${page.title} down`} onClick={() => nudge(page.id, 1)}>↓</button>
            <button className="button-ghost min-h-9 px-2 text-red-300" type="button" disabled={pending} aria-label={`Delete ${page.title}`} onClick={() => remove(page)}><Trash2 className="size-4" /></button>
          </div>
        ))}
        {!ordered.length && (
          <p className="border border-dashed border-[#333] p-5 text-center text-sm text-[#777]">
            No pages yet. Create or import the first page below.
          </p>
        )}
      </div>
    </section>
  );
}
