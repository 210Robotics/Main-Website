"use client";

import { ArrowUpRight, FileSearch, Search, UsersRound, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Feature = readonly [title: string, keywords: string, href: string];
type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  href: string;
};

const memberFeatures: readonly Feature[] = [
  ["Dashboard", "overview quick add alerts home", "/portal"],
  ["Attendance", "check in meeting event presence", "/portal?tab=attendance"],
  ["Hours", "time clock enter work log contributions", "/portal?tab=hours"],
  ["Completed forms", "forms submissions responses", "/portal?tab=forms"],
  ["Scheduling polls", "availability edit responses meetings", "/portal?tab=polls"],
  ["Tasks", "jobs deliverables comments approvals assignments", "/portal?tab=tasks"],
  ["My portfolio", "contributions recognition resume export work", "/portal?tab=portfolio"],
  ["Engineering", "notebook design parts manufacturing CAD CAM", "/portal?tab=engineering"],
  ["Templates", "checklists meetings projects entries", "/portal?tab=templates"],
  ["Scouting", "enter matches statistics VEX U Override", "/portal?tab=scouting"],
  ["Glossary", "acronyms roles terms metrics definitions", "/portal?tab=glossary"],
  ["Documentation", "team code engineering notebook doxygen", "https://docs.210robotics.com"],
];

const adminFeatures: readonly Feature[] = [
  ["Engineering notebook", "studio pages review versions PDF DOCX import", "/admin/operations?tool=notebook"],
  ["Connected accounts", "github sign in link account repository analytics AI assistant", "/portal?tab=connections"],
  ["Finance", "enter budget expenses income sponsors export", "/admin/operations?tool=finance"],
  ["Parts and manufacturing", "inventory BOM shop queue QR labels", "/admin/operations?tool=engineering"],
  ["Internal documents", "Google Drive upload archive edit files", "/admin?tab=documents"],
  ["Media galleries", "events photos Drive carousel albums", "/admin?tab=media"],
  ["News editor", "articles gallery embeds social posts", "/admin?tab=content"],
  ["Sponsors", "companies outreach analytics email templates contacts", "/admin/control-center?tab=sponsors"],
  ["Leadership dashboard", "risks blockers deadlines staffing health", "/admin/control-center?tab=dashboard"],
  ["Competition command center", "competition event match pit readiness checklist", "/admin/control-center?tab=team-os&view=competition"],
  ["Battery tracking", "battery voltage charge cycles robot power", "/admin/control-center?tab=team-os&view=competition"],
  ["Robot configurations", "robot hardware firmware software configuration", "/admin/control-center?tab=team-os&view=competition"],
  ["Approval inbox", "approve review tasks notebook design finance", "/admin/control-center?tab=team-os&view=approvals"],
  ["Engineering controls", "questions assumptions technical debt corrective action dependency", "/admin/control-center?tab=team-os&view=engineering"],
  ["Skills and cross-training", "knowledge gaps training mentor skills", "/admin/control-center?tab=team-os&view=training"],
  ["Ask the team", "search assistant source links team knowledge", "/admin/control-center?tab=team-os&view=assistant"],
  ["Season rollover", "new season clone projects subsystems impact report", "/admin/control-center?tab=team-os&view=season"],
  ["GitHub analytics", "repository account commits contributors issues code", "/admin/control-center?tab=team-os&view=github"],
  ["Website editor", "pages tabs navigation photos text copy", "/admin?tab=website"],
];

function featureScore(feature: Feature, terms: string[]) {
  const title = feature[0].toLowerCase();
  const searchable = `${feature[0]} ${feature[1]}`.toLowerCase();
  return terms.reduce((score, term) => {
    if (title === term) return score + 12;
    if (title.startsWith(term)) return score + 8;
    if (title.includes(term)) return score + 5;
    if (searchable.includes(term)) return score + 2;
    return score;
  }, 0);
}

export function PortalSearch({
  canAdmin,
}: {
  canAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const normalized = query.trim().toLowerCase();
  useEffect(() => {
    if (!normalized) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/command-palette?q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        const data = response.ok
          ? ((await response.json()) as { items?: SearchResult[] })
          : { items: [] };
        setRecords(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setRecords([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 140);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalized]);
  const matches = useMemo(() => {
    const features: readonly Feature[] = canAdmin
      ? [...memberFeatures, ...adminFeatures]
      : memberFeatures;
    if (!normalized)
      return {
        features: features.slice(0, canAdmin ? 6 : 5),
      };
    const terms = normalized.split(/\s+/).filter(Boolean);
    return {
      features: features
        .map((feature) => ({ feature, score: featureScore(feature, terms) }))
        .filter((item) => item.score > 0)
        .sort(
          (a, b) =>
            b.score - a.score || a.feature[0].localeCompare(b.feature[0]),
        )
        .slice(0, 10)
        .map((item) => item.feature),
    };
  }, [canAdmin, normalized]);
  const visibleRecords = normalized ? records : [];
  const memberResults = visibleRecords.filter((item) => item.type === "Member");
  const recordResults = visibleRecords.filter((item) => item.type !== "Member");
  const hasResults = matches.features.length || visibleRecords.length;

  return (
    <section className="portal-feature-search relative mb-7 overflow-hidden border border-[#3a3a3a] bg-[#0d0d0d] p-4 shadow-[0_20px_60px_rgba(0,0,0,.25)] md:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#fd7803]/10 blur-3xl" />
      <div className="relative">
        <p className="eyebrow">Portal finder</p>
        <h2 className="mt-3 text-xl font-bold md:text-2xl">
          Where do you want to go?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#888]">
          Search by feature, job, keyword, member, or what you need to enter.
        </p>
        <label className="mt-5 flex min-h-14 items-center gap-3 border border-[#454545] bg-black/55 px-4 focus-within:border-[#fd7803]">
          <Search className="size-5 shrink-0 text-[#fd7803]" />
          <span className="sr-only">Search portal features and members</span>
          <input
            className="min-w-0 w-full bg-transparent text-base text-white outline-none placeholder:text-[#777]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try ‘battery’, ‘enter expenses’, ‘notebook’, or a member name"
            type="search"
          />
          <kbd className="hidden shrink-0 border border-[#444] px-2 py-1 text-[.65rem] text-[#888] sm:block">
            Search
          </kbd>
        </label>
        <div className="mt-4 grid gap-4 border-t border-[#292929] pt-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#888]">
              <Wrench className="size-3" />
              {normalized ? "Related features" : "Popular features"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {matches.features.map(([title, keywords, href]) => (
                <Link
                  className="group flex items-start justify-between gap-3 border border-[#292929] bg-black/30 p-3 transition hover:border-[#fd7803] hover:bg-[#15100c]"
                  href={href}
                  key={title}
                >
                  <span className="min-w-0">
                    <strong className="block text-sm">{title}</strong>
                    <span className="mt-1 line-clamp-1 block text-xs text-[#777]">
                      {keywords}
                    </span>
                  </span>
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-[#666] transition group-hover:text-[#fd7803]" />
                </Link>
              ))}
            </div>
          </div>
          {normalized && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#888]">
                <UsersRound className="size-3" /> Members
              </p>
              <div className="grid gap-2">
                {memberResults.map((member) => (
                  <Link
                    className="border border-[#292929] bg-black/30 p-3 transition hover:border-[#fd7803]"
                    href={canAdmin ? member.href : "/members"}
                    key={member.id}
                  >
                    <strong className="block text-sm">{member.title}</strong>
                    <span className="text-xs text-[#777]">{member.subtitle}</span>
                  </Link>
                ))}
                {!loading && !memberResults.length && (
                  <p className="border border-dashed border-[#333] p-4 text-sm text-[#777]">
                    No member names match this search.
                  </p>
                )}
              </div>
            </div>
          )}
          {normalized && recordResults.length > 0 && (
            <div className="lg:col-span-2">
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#888]">
                <FileSearch className="size-3" /> Workspace records
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {recordResults.slice(0, 12).map((item) => (
                  <Link
                    className="group flex items-start justify-between gap-3 border border-[#292929] bg-black/30 p-3 transition hover:border-[#fd7803]"
                    href={item.href}
                    key={`${item.type}-${item.id}`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{item.title}</strong>
                      <span className="mt-1 block truncate text-xs text-[#777]">
                        {item.type}{item.subtitle ? ` · ${item.subtitle}` : ""}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-[#666] transition group-hover:text-[#fd7803]" />
                  </Link>
                ))}
              </div>
            </div>
          )}
          {normalized && loading && (
            <p className="text-sm text-[#888] lg:col-span-2" aria-live="polite">
              Searching team records…
            </p>
          )}
          {!hasResults && (
            <p className="text-sm text-[#888] lg:col-span-2">
              No portal feature or member matches “{query}”. Try a shorter job
              word such as “budget,” “part,” or “meeting.”
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
