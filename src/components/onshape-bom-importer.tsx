"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { importOnshapeBom } from "@/app/admin/operations/actions";
import { parseOnshapeBom } from "@/lib/onshape-bom";

type Choice = { id: string; label: string };

export function OnshapeBomImporter({
  seasons,
  projects,
  subsystems,
}: {
  seasons: (Choice & { isDefault?: boolean })[];
  projects: Choice[];
  subsystems: Choice[];
}) {
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("");
  const [guidance, setGuidance] = useState("");
  const [pending, startTransition] = useTransition();
  const parsed = useMemo(() => parseOnshapeBom(source), [source]);

  async function readFile(file?: File) {
    if (!file) return;
    setSource(await file.text());
    setMessage("");
    setGuidance("");
  }

  function importRows(formData: FormData) {
    formData.set("rows", JSON.stringify(parsed.rows));
    startTransition(async () => {
      try {
        const result = await importOnshapeBom(formData);
        setMessage(result.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The BOM could not be imported.");
      }
    });
  }

  function askAssistant() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/bom-assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ headers: parsed.headers, sample: parsed.rows.slice(0, 6) }),
        });
        const result = (await response.json()) as { guidance?: string; message?: string };
        if (!response.ok) throw new Error(result.message || "Assistant unavailable.");
        setGuidance(result.guidance || "No recommendations returned.");
      } catch (error) {
        setGuidance(error instanceof Error ? error.message : "Assistant unavailable.");
      }
    });
  }

  return (
    <details className="border border-[#333] bg-[#0d0d0d] p-5 open:border-[#fd7803]/45">
      <summary className="cursor-pointer list-none">
        <p className="eyebrow">Guided import</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold">Import an Onshape BOM</h3>
          <span className="tag">CSV or pasted table</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#888]">Export the BOM from Onshape as CSV, upload it here, review the detected rows, and merge by project + part number. Changed quantities, revisions, costs, materials, and part details automatically enter design-change review.</p>
      </summary>
      <div className="mt-6 grid gap-5 border-t border-[#333] pt-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="field"><span>Onshape BOM export</span><input className="input" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
          <label className="field"><span>Or paste rows from Onshape / a spreadsheet</span><textarea className="input min-h-32 font-mono text-xs" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Part number,Name,Quantity,Revision,Material…" /></label>
        </div>
        {!!parsed.headers.length && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#aaa]"><strong className="text-white">{parsed.rows.length}</strong> valid rows detected{parsed.skipped ? ` · ${parsed.skipped} skipped` : ""}</p>
              <button className="button secondary" type="button" disabled={pending || !parsed.rows.length} onClick={askAssistant}>Ask AI to review mapping</button>
            </div>
            {guidance && <div className="border-l-2 border-[#fd7803] bg-[#15100c] p-4 text-sm leading-6 text-[#bbb]"><strong className="block text-white">210 Assistant review</strong><p className="mt-2 whitespace-pre-wrap">{guidance}</p></div>}
            <div className="overflow-x-auto border border-[#333]">
              <table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#171717] text-[#aaa]"><tr><th className="p-3">Part #</th><th className="p-3">Name</th><th className="p-3">Qty</th><th className="p-3">Rev</th><th className="p-3">Material</th><th className="p-3">Make / buy</th></tr></thead><tbody>{parsed.rows.slice(0, 8).map((row, index) => <tr className="border-t border-[#2d2d2d]" key={`${row.partNumber}-${index}`}><td className="p-3 font-mono text-[#fd7803]">{row.partNumber}</td><td className="p-3">{row.name}</td><td className="p-3">{row.quantity}</td><td className="p-3">{row.revision}</td><td className="p-3">{row.material || "—"}</td><td className="p-3">{row.makeBuy}</td></tr>)}</tbody></table>
              {parsed.rows.length > 8 && <p className="border-t border-[#333] p-3 text-center text-xs text-[#777]">Previewing 8 of {parsed.rows.length} rows</p>}
            </div>
          </div>
        )}
        <form action={importRows} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="field"><span>Season</span><select className="input" name="seasonId" defaultValue={seasons.find((item) => item.isDefault)?.id || ""}><option value="">Unassigned</option>{seasons.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field"><span>Shared project</span><select className="input" name="engineeringProjectId"><option value="">Unassigned</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field"><span>Shared subsystem</span><select className="input" name="subsystemId"><option value="">Unassigned</option>{subsystems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="field"><span>Project name used for matching</span><input className="input" name="project" defaultValue="VEX U" required /></label>
          <label className="field"><span>Fallback subsystem</span><input className="input" name="subsystem" defaultValue="General" /></label>
          <label className="field md:col-span-2"><span>Onshape document or BOM link</span><input className="input" name="sourceUrl" type="url" placeholder="https://cad.onshape.com/documents/…" /></label>
          <div className="flex items-end"><button className="button w-full" disabled={pending || !parsed.rows.length}>{pending ? "Working…" : `Import ${parsed.rows.length || ""} parts`}</button></div>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#999]" aria-live="polite">{message}</p>{message.includes("design-change review") && <Link className="text-xs font-semibold text-[#fd7803] hover:underline" href="/admin/operations?tool=changes">Review detected changes →</Link>}</div>
      </div>
    </details>
  );
}
