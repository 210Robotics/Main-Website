"use client";

import Link from "next/link";
import {
  Command,
  FileText,
  FolderKanban,
  Package,
  Search,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Result = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  href: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    function custom() {
      setOpen(true);
    }
    window.addEventListener("keydown", keyboard);
    window.addEventListener("open-command-palette", custom);
    return () => {
      window.removeEventListener("keydown", keyboard);
      window.removeEventListener("open-command-palette", custom);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/command-palette?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const data = response.ok
          ? ((await response.json()) as { items?: Result[] })
          : { items: [] };
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setItems([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);
  return (
    <>
      <button
        className="hidden min-h-10 items-center gap-2 border border-[#333] px-3 text-xs font-semibold text-[#bbb] transition hover:border-[#fd7803] hover:text-white lg:flex"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" /> Search{" "}
        <kbd className="border border-[#444] px-1.5 py-0.5 text-[10px]">
          Ctrl K
        </kbd>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 px-4 pt-[10vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="mx-auto max-w-2xl overflow-hidden border border-[#444] bg-[#101010] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[#333] p-4">
              <Search className="h-5 w-5 text-[#fd7803]" />
              <input
                ref={input}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#666]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a project, member, part, document, or action…"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-[#292929] p-3">
              <button
                className="tag"
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event("open-quick-add"));
                }}
              >
                <Zap className="mr-1 inline h-3 w-3" /> Quick add
              </button>
              <Link
                className="tag"
                href="/admin/operations?tool=tasks"
                onClick={() => setOpen(false)}
              >
                New task
              </Link>
              <Link
                className="tag"
                href="/admin/operations?tool=notebook&entry=new"
                onClick={() => setOpen(false)}
              >
                Notebook page
              </Link>
              <Link
                className="tag"
                href="/admin/control-center"
                onClick={() => setOpen(false)}
              >
                Leadership
              </Link>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {items.map((item) => (
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 border border-transparent p-3 transition hover:border-[#3b3b3b] hover:bg-[#181818]"
                  key={`${item.type}-${item.id}`}
                >
                  <ResultIcon type={item.type} />
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">
                      {item.title}
                    </strong>
                    <p className="mt-1 truncate text-xs text-[#777]">
                      {item.type}
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
              {loading && (
                <p className="p-8 text-center text-sm text-[#777]">
                  Searching…
                </p>
              )}
              {!loading && !items.length && (
                <p className="p-8 text-center text-sm text-[#777]">
                  Sign in to search the team workspace, or try another phrase.
                </p>
              )}
            </div>
            <p className="border-t border-[#292929] px-4 py-3 text-[11px] text-[#666]">
              <Command className="mr-1 inline h-3 w-3" /> Type to filter · Esc
              to close
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ResultIcon({ type }: { type: string }) {
  const className = "h-4 w-4";
  if (type === "Member") return <UserRound className={className} />;
  if (type === "Project") return <FolderKanban className={className} />;
  if (type === "Part") return <Package className={className} />;
  return <FileText className={className} />;
}
