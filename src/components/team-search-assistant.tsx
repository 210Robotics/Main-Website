"use client";

import { Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Source = { id: string; title: string; excerpt: string; href: string };

export function TeamSearchAssistant() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/team-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const result = (await response.json()) as {
        answer?: string;
        sources?: Source[];
        message?: string;
      };
      if (!response.ok) throw new Error(result.message || "Search failed.");
      setAnswer(result.answer || "No answer was generated.");
      setSources(result.sources || []);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex min-h-12 flex-1 items-center gap-3 border border-[#444] bg-black/30 px-4">
          <Search className="size-4 text-[#fd7803]" />
          <span className="sr-only">Ask the team knowledge base</span>
          <input
            className="w-full bg-transparent outline-none placeholder:text-[#666]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void search();
            }}
            placeholder="What is the drivetrain verification status?"
          />
        </label>
        <button className="button" disabled={loading} onClick={() => void search()}>
          <Sparkles className="size-4" /> {loading ? "Searching…" : "Ask team"}
        </button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {answer && (
        <div className="border border-[#333] bg-black/25 p-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#ddd]">{answer}</p>
        </div>
      )}
      {!!sources.length && (
        <div className="grid gap-3 md:grid-cols-2">
          {sources.map((source, index) => (
            <Link
              className="border border-[#333] p-4 transition hover:border-[#fd7803]"
              href={source.href}
              key={source.id}
            >
              <span className="font-mono text-xs text-[#fd7803]">SOURCE {index + 1}</span>
              <strong className="mt-2 block">{source.title}</strong>
              <span className="mt-2 line-clamp-3 block text-xs leading-5 text-[#777]">{source.excerpt}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
