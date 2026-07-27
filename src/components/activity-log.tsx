"use client";

import { useMemo, useState } from "react";
import {
  updateTeamContribution,
  updateTeamHour,
  voidTeamContribution,
  voidTeamHour,
} from "@/app/admin/actions";
import { ActionForm } from "@/components/action-form";
import { CalendarInput } from "@/components/calendar-input";
import {
  filterActivityRecords,
  type ActivityLogFilters,
  type ActivityLogRecord,
} from "@/lib/activity-log";

const emptyFilters: ActivityLogFilters = {
  person: "",
  type: "all",
  from: "",
  to: "",
  search: "",
};

export function ActivityLog({
  records,
  canEdit,
}: {
  records: ActivityLogRecord[];
  canEdit: boolean;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const people = useMemo(
    () =>
      Array.from(
        new Map(
          records.map((record) => [
            record.memberId,
            { id: record.memberId, name: record.memberName },
          ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [records],
  );
  const filtered = useMemo(
    () => filterActivityRecords(records, filters),
    [filters, records],
  );
  const visible = filtered.slice(0, visibleCount);
  const filteredMinutes = filtered.reduce(
    (total, record) => total + (record.minutes ?? 0),
    0,
  );

  function setFilter<K extends keyof ActivityLogFilters>(
    key: K,
    value: ActivityLogFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(25);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setVisibleCount(25);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-sm border border-[#333] bg-[#0c0c0c] p-4 md:grid-cols-2 xl:grid-cols-6">
        <FilterLabel label="Person" className="xl:col-span-2">
          <select
            className="input"
            value={filters.person}
            onChange={(event) => setFilter("person", event.target.value)}
          >
            <option value="">All members</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </FilterLabel>
        <FilterLabel label="Record type">
          <select
            className="input"
            value={filters.type}
            onChange={(event) =>
              setFilter(
                "type",
                event.target.value as ActivityLogFilters["type"],
              )
            }
          >
            <option value="all">Hours + contributions</option>
            <option value="hour">Hours only</option>
            <option value="contribution">Contributions only</option>
          </select>
        </FilterLabel>
        <FilterLabel label="From date">
          <CalendarInput
            type="date"
            value={filters.from}
            onChange={(event) => setFilter("from", event.target.value)}
          />
        </FilterLabel>
        <FilterLabel label="Through date">
          <CalendarInput
            type="date"
            value={filters.to}
            onChange={(event) => setFilter("to", event.target.value)}
          />
        </FilterLabel>
        <FilterLabel label="Search" className="md:col-span-2 xl:col-span-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="input flex-1"
              type="search"
              placeholder="Search member, project, category, title, or description"
              value={filters.search}
              onChange={(event) => setFilter("search", event.target.value)}
            />
            <button className="button secondary" type="button" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        </FilterLabel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#333] pb-4 text-sm text-[#999]">
        <p>
          <strong className="text-white">{filtered.length}</strong> records
          {filteredMinutes > 0 && (
            <> &middot; <strong className="text-[#fd7803]">{formatHours(filteredMinutes)}</strong> hours</>
          )}
        </p>
        <p>{canEdit ? "Expand a record to edit or delete it." : "Your access is read-only."}</p>
      </div>

      {visible.length ? (
        <div className="divide-y divide-[#2d2d2d] border-y border-[#2d2d2d]">
          {visible.map((record) => {
            const key = `${record.type}-${record.id}`;
            const isExpanded = expanded === key;
            return (
              <article key={key} className="bg-[#0b0b0b] transition-colors hover:bg-[#101010]">
                <div className="grid items-center gap-3 px-4 py-4 md:grid-cols-[110px_minmax(150px,1fr)_minmax(180px,1.4fr)_110px_auto]">
                  <div>
                    <span className={`inline-flex border px-2 py-1 font-mono text-[.6rem] font-bold uppercase tracking-wider ${record.type === "hour" ? "border-[#fd7803]/50 bg-[#fd7803]/10 text-[#fd9b47]" : "border-sky-700/60 bg-sky-950/40 text-sky-300"}`}>
                      {record.type === "hour" ? "Hours" : "Contribution"}
                    </span>
                    <p className="mt-2 font-mono text-[.65rem] text-[#777]">{formatDate(record.date)}</p>
                  </div>
                  <div>
                    <strong className="text-sm text-white">{record.memberName}</strong>
                    <p className="mt-1 text-xs text-[#777]">{record.memberRole}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#ddd]">
                      {record.type === "hour" ? record.project : record.title}
                    </p>
                    <p className="mt-1 text-xs text-[#777]">{record.project} &middot; {record.category}</p>
                  </div>
                  <strong className="text-sm text-[#fd7803]">
                    {record.type === "hour" ? `${formatHours(record.minutes ?? 0)} hrs` : "Work log"}
                  </strong>
                  <button
                    className="button secondary whitespace-nowrap"
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`activity-${key}`}
                    onClick={() => setExpanded(isExpanded ? null : key)}
                  >
                    {isExpanded ? "Hide details" : "View more"}
                  </button>
                </div>

                {isExpanded && (
                  <div id={`activity-${key}`} className="border-t border-[#2d2d2d] bg-[#080808] px-4 py-5 md:px-6">
                    <div className="mb-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Detail label="Submitted">{formatDateTime(record.createdAt)}</Detail>
                      <Detail label="Project">{record.project}</Detail>
                      <Detail label="Category">{record.category}</Detail>
                      <Detail label="Record ID"><span className="font-mono text-[.65rem]">{record.id}</span></Detail>
                    </div>
                    <div className="mb-6 rounded-sm border border-[#292929] bg-[#0e0e0e] p-4">
                      <p className="font-mono text-[.65rem] uppercase tracking-wider text-[#777]">Description</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#bbb]">{record.description}</p>
                      {record.evidenceUrl && (
                        <a className="mt-3 inline-block text-sm text-[#fd7803] hover:text-white" href={record.evidenceUrl} target="_blank" rel="noreferrer">
                          Open evidence link
                        </a>
                      )}
                    </div>
                    {canEdit && (
                      record.type === "hour" ? (
                        <HourEditor record={record} />
                      ) : (
                        <ContributionEditor record={record} />
                      )
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-sm border border-dashed border-[#333] py-12 text-center text-sm text-[#777]">
          No activity matches these filters.
        </p>
      )}

      {visibleCount < filtered.length && (
        <div className="text-center">
          <button className="button secondary" type="button" onClick={() => setVisibleCount((count) => count + 25)}>
            Show 25 more
          </button>
        </div>
      )}
    </div>
  );
}

function HourEditor({ record }: { record: ActivityLogRecord }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
      <ActionForm action={updateTeamHour} successMessage="Hour entry updated." className="grid gap-4">
        <input type="hidden" name="hourId" value={record.id} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterLabel label="Date"><CalendarInput name="date" type="date" defaultValue={record.date} required /></FilterLabel>
          <FilterLabel label="Hours"><input className="input" name="hours" type="number" min="0.01" max="24" step="0.01" defaultValue={((record.minutes ?? 0) / 60).toFixed(2)} required /></FilterLabel>
          <FilterLabel label="Project"><input className="input" name="project" defaultValue={record.project} required /></FilterLabel>
          <FilterLabel label="Category"><input className="input" name="category" defaultValue={record.category} required /></FilterLabel>
        </div>
        <FilterLabel label="Description"><textarea className="input min-h-24" name="description" defaultValue={record.description} required /></FilterLabel>
        <button className="button w-fit">Save hour changes</button>
      </ActionForm>
      <DeleteForm action={voidTeamHour} idName="hourId" id={record.id} label="Delete hour entry" />
    </div>
  );
}

function ContributionEditor({ record }: { record: ActivityLogRecord }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
      <ActionForm action={updateTeamContribution} successMessage="Contribution updated." className="grid gap-4">
        <input type="hidden" name="contributionId" value={record.id} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterLabel label="Date"><CalendarInput name="date" type="date" defaultValue={record.date} required /></FilterLabel>
          <FilterLabel label="Title"><input className="input" name="title" defaultValue={record.title} required /></FilterLabel>
          <FilterLabel label="Project"><input className="input" name="project" defaultValue={record.project} required /></FilterLabel>
          <FilterLabel label="Category"><input className="input" name="category" defaultValue={record.category} required /></FilterLabel>
        </div>
        <FilterLabel label="Description"><textarea className="input min-h-24" name="description" defaultValue={record.description} required /></FilterLabel>
        <FilterLabel label="Evidence link"><input className="input" name="link" type="url" defaultValue={record.evidenceUrl ?? ""} /></FilterLabel>
        <button className="button w-fit">Save contribution changes</button>
      </ActionForm>
      <DeleteForm action={voidTeamContribution} idName="contributionId" id={record.id} label="Delete contribution" />
    </div>
  );
}

function DeleteForm({
  action,
  idName,
  id,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  idName: string;
  id: string;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name={idName} value={id} />
      <button
        className="button border-red-900/70 bg-red-950/30 text-red-300 hover:border-red-500"
        onClick={(event) => {
          if (!window.confirm(`${label}? This will remove it from totals but preserve its audit history.`)) event.preventDefault();
        }}
      >
        {label}
      </button>
    </form>
  );
}

function FilterLabel({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-2 text-sm text-[#aaa] ${className}`}>
      <span className="font-mono text-[.65rem] font-bold uppercase tracking-wider text-[#999]">{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="font-mono text-[.65rem] uppercase tracking-wider text-[#666]">{label}</p><div className="mt-1 text-[#bbb]">{children}</div></div>;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHours(minutes: number) {
  return (minutes / 60).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
