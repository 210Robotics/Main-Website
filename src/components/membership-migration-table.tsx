"use client";

import { useMemo, useState } from "react";
import { grantUniversityEmailOverride, revokeUniversityEmailOverride } from "@/app/admin/actions";

type Row = {
  id: string; name: string; email: string; accessRole: string; organizationRole: string;
  status: string; accessState: string; universityVerified: boolean; universityOverride: boolean; profileComplete: boolean;
  discordLinked: boolean; discordSync: string; duesStatus: string; fundraisingRaisedCents: number; lastSync: string | null;
};

const filters = ["ALL", "NEEDS_VERIFICATION", "DISCORD_NOT_LINKED", "DUES_PENDING", "WAIVED", "SUSPENDED", "DUPLICATE"] as const;

export function MembershipMigrationTable({ rows, period, canManageOverrides }: { rows: Row[]; period: string; canManageOverrides: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL");
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = row.name.trim().toLowerCase().replace(/\s+/g, " ");
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }, [rows]);
  const visible = useMemo(() => rows.filter((row) => {
    const text = `${row.name} ${row.email} ${row.organizationRole} ${row.accessRole} ${row.accessState}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (filter === "NEEDS_VERIFICATION") return !row.universityVerified || !row.profileComplete;
    if (filter === "DISCORD_NOT_LINKED") return !row.discordLinked;
    if (filter === "DUES_PENDING") return !["PAID", "WAIVED", "WAIVED_FUNDRAISING"].includes(row.duesStatus);
    if (filter === "WAIVED") return ["WAIVED", "WAIVED_FUNDRAISING"].includes(row.duesStatus);
    if (filter === "SUSPENDED") return row.status === "SUSPENDED";
    if (filter === "DUPLICATE") return duplicateKeys.has(row.name.trim().toLowerCase().replace(/\s+/g, " "));
    return true;
  }), [duplicateKeys, filter, query, rows]);
  const verified = rows.filter((row) => row.universityVerified && row.profileComplete && row.discordLinked).length;
  return (
    <section className="card p-5 sm:p-7">
      <div><p className="eyebrow">Controlled migration</p><h2 className="mt-3 text-2xl font-bold">Member verification status</h2><p className="mt-3 text-sm leading-6 text-[#999]">Existing accounts remain in grace mode until enforcement is intentionally enabled. Review identity, Discord, and {period} dues without deleting historical records.</p></div>
      <div className="mt-6 grid gap-3 grid-cols-2 xl:grid-cols-4"><Metric label="Ready" value={verified} /><Metric label="Need UTSA/profile" value={rows.filter((row) => !row.universityVerified || !row.profileComplete).length} /><Metric label="Discord missing" value={rows.filter((row) => !row.discordLinked).length} /><Metric label="Duplicate names" value={duplicateKeys.size} /></div>
      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]"><input className="input" type="search" placeholder="Search member, email, role, or status…" value={query} onChange={(event) => setQuery(event.target.value)} /><select className="input" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>{filters.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {visible.map((row) => <article className="border border-[#333] bg-[#0d0d0d] p-4" key={row.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{row.name}</strong><p className="mt-1 text-xs text-[#777]">{row.email}</p></div><span className="tag">{row.accessState.replaceAll("_", " ")}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><Check label={row.universityOverride ? "UTSA override" : "UTSA"} ok={row.universityVerified} /><Check label="Profile" ok={row.profileComplete} /><Check label="Discord" ok={row.discordLinked} /><Check label="Dues" ok={["PAID", "WAIVED", "WAIVED_FUNDRAISING"].includes(row.duesStatus)} /></div><p className="mt-3 text-xs text-[#777]">{row.organizationRole} · {row.accessRole.replaceAll("_", " ")} · Discord {row.discordSync.toLowerCase()}</p>{canManageOverrides && (!row.universityVerified || row.universityOverride) && <details className="mt-4 border-t border-[#333] pt-3"><summary className="cursor-pointer text-xs font-semibold text-[#fd7803]">University email exception</summary>{row.universityOverride ? <form className="mt-3" action={revokeUniversityEmailOverride}><input type="hidden" name="memberId" value={row.id} /><button className="button secondary min-h-10">Revoke override</button></form> : <form className="mt-3 grid gap-3" action={grantUniversityEmailOverride}><input type="hidden" name="memberId" value={row.id} /><label className="field"><span>Required exception reason</span><input className="input" name="reason" minLength={10} maxLength={500} required /></label><button className="button min-h-10 w-fit">Grant controlled override</button></form>}</details>}</article>)}
      </div>
      {!visible.length && <p className="mt-5 border border-dashed border-[#444] p-5 text-sm text-[#888]">No members match this search and filter.</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="border border-[#333] p-4"><strong className="text-2xl text-[#fd7803]">{value}</strong><p className="mt-1 text-[.65rem] uppercase tracking-wider text-[#777]">{label}</p></div>; }
function Check({ label, ok }: { label: string; ok: boolean }) { return <span className={ok ? "text-emerald-300" : "text-amber-300"}>{ok ? "✓" : "○"} {label}</span>; }
