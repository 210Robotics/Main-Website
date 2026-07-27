import type { ReactNode } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { NotebookEditor } from "@/components/notebook-editor";
import { NotebookFileImport } from "@/components/notebook-file-import";
import { NotebookPageOrganizer } from "@/components/notebook-page-organizer";
import { CalendarInput } from "@/components/calendar-input";
import type {
  designChanges,
  engineeringNotebookComments,
  engineeringNotebookCompilations,
  engineeringNotebookEntries,
  engineeringNotebookVersions,
  engineeringParts,
  engineeringProjects,
  engineeringSeasons,
  engineeringSubsystems,
  financePlans,
  inventoryItems,
  purchaseRequests,
  scoutingMatches,
} from "@/db/schema";
import {
  deleteInventoryItem,
  resolveNotebookComment,
  restoreNotebookVersion,
  reviewDesignChange,
  reviewPurchaseRequest,
  saveDesignChange,
  saveEngineeringProject,
  saveEngineeringSeason,
  saveEngineeringSubsystem,
  saveInventoryItem,
  saveNotebookComment,
  saveNotebookEntry,
  savePurchaseRequest,
} from "@/app/admin/operations/engineering-actions";
import {
  designChangeStatuses,
  financeCategories,
  inventoryAvailable,
  inventoryCategories,
  notebookCommentKinds,
  notebookEntryTypes,
  notebookStatuses,
  projectStatuses,
  purchaseStatuses,
  seasonStatuses,
} from "@/lib/engineering-operations";
import { centsToMoney, displayStatus } from "@/lib/operations";

type Season = typeof engineeringSeasons.$inferSelect;
type Project = typeof engineeringProjects.$inferSelect;
type Subsystem = typeof engineeringSubsystems.$inferSelect;
type Entry = typeof engineeringNotebookEntries.$inferSelect;
type Version = typeof engineeringNotebookVersions.$inferSelect;
type Comment = typeof engineeringNotebookComments.$inferSelect;
type Compilation = typeof engineeringNotebookCompilations.$inferSelect;
type Inventory = typeof inventoryItems.$inferSelect;
type Purchase = typeof purchaseRequests.$inferSelect;
type Change = typeof designChanges.$inferSelect;
type Part = typeof engineeringParts.$inferSelect;
type Plan = typeof financePlans.$inferSelect;
type Scout = typeof scoutingMatches.$inferSelect;
type Person = { id: string; name: string; role: string };

export function SharedEngineeringModelWorkspace({
  seasons,
  projects,
  subsystems,
  members,
}: {
  seasons: Season[];
  projects: Project[];
  subsystems: Subsystem[];
  members: Person[];
}) {
  return (
    <div className="grid gap-8">
      <Intro
        eyebrow="Shared engineering structure"
        title="One season, project, and subsystem model."
        body="Notebook entries, parts, tests, purchasing, inventory, finance, scouting, and design changes all use this structure so evidence stays connected."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Create season">
          <SeasonForm />
        </Card>
        <Card title="Create project">
          <ProjectForm seasons={seasons} members={members} />
        </Card>
        <Card title="Create subsystem">
          <SubsystemForm projects={projects} members={members} />
        </Card>
      </div>
      <section className="grid gap-5">
        {seasons.map((season) => (
          <details className="card p-6 open:border-[#fd7803]/50" key={season.id} open={season.isDefault}>
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <Status value={season.status} />
                  <h2 className="mt-3 text-2xl font-bold">{season.name}</h2>
                  <p className="mt-2 text-sm text-[#888]">
                    {season.competition} · {season.gameName} · Manual v{season.gameManualVersion}
                  </p>
                </div>
                {season.isDefault && <span className="tag border-[#fd7803] text-[#fd7803]">Current season</span>}
              </div>
            </summary>
            <div className="mt-6 grid gap-6 border-t border-[#333] pt-6">
              <SeasonForm season={season} />
              <div className="grid gap-4 md:grid-cols-2">
                {projects.filter((project) => project.seasonId === season.id).map((project) => (
                  <div className="border border-[#333] p-5" key={project.id}>
                    <Status value={project.status} />
                    <h3 className="mt-3 text-lg font-bold">{project.code} · {project.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#888]">{project.description || "No project description."}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {subsystems.filter((subsystem) => subsystem.projectId === project.id).map((subsystem) => (
                        <span className="tag" key={subsystem.id}>{subsystem.code} · {subsystem.name}</span>
                      ))}
                    </div>
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-semibold text-[#aaa]">Edit project and subsystems</summary>
                      <div className="mt-4 grid gap-4">
                        <ProjectForm project={project} seasons={seasons} members={members} />
                        {subsystems.filter((subsystem) => subsystem.projectId === project.id).map((subsystem) => (
                          <SubsystemForm key={subsystem.id} subsystem={subsystem} projects={projects} members={members} />
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          </details>
        ))}
        {!seasons.length && <Empty title="No season configured" body="Create the 2026-27 Override season to connect the engineering workspace." />}
      </section>
    </div>
  );
}

export function NotebookWorkspace({
  seasons,
  projects,
  subsystems,
  entries,
  versions,
  comments,
  compilations,
  nameById,
  canEdit,
  uploaderId,
  selectedEntryId,
}: {
  seasons: Season[];
  projects: Project[];
  subsystems: Subsystem[];
  entries: Entry[];
  versions: Version[];
  comments: Comment[];
  compilations: Compilation[];
  nameById: Map<string, string>;
  canEdit: boolean;
  uploaderId: string;
  selectedEntryId?: string;
}) {
  const openComments = comments.filter((comment) => comment.status === "OPEN").length;
  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];
  const showNew = canEdit && (selectedEntryId === "new" || !selectedEntry);
  return (
    <div className="grid gap-6">
      <Intro
        eyebrow="Private engineering notebook"
        title="Notebook Studio"
        body="Choose a page and write. Formatting, evidence, uploads, version history, reviews, imports, and exports stay in this focused workspace."
      />
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-[#292929] py-4">
          <p className="font-mono text-xs uppercase tracking-wider text-[#777]">
            {entries.length} pages · {versions.length} versions · {openComments} open reviews
          </p>
          <p className="text-sm text-[#888]">Scroll through every page below. Add and import controls stay at the end.</p>
        </div>
      )}
      <Card title="Export the branded engineering notebook" subtitle="PDF and Word exports use the same live notebook, engineering, manufacturing, inventory, purchasing, design-change, finance, task, meeting, hour, and scouting data.">
        <form className="grid gap-4" action="/api/exports/notebook" method="get">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Season" name="seasonId" value={seasons.find((season) => season.isDefault)?.id ?? seasons[0]?.id ?? ""}>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
            </SelectField>
            <SelectField label="Project (optional)" name="projectId" value="">
              <option value="">All season projects</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}
            </SelectField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["includeEngineering", "BOM and manufacturing"],
              ["includeTesting", "Testing and verification"],
              ["includeLogistics", "Inventory and purchasing"],
              ["includeChanges", "Design changes"],
              ["includeFinance", "Budget and expenses"],
              ["includeOperations", "Meetings, tasks, and hours"],
              ["includeScouting", "Override scouting"],
            ].map(([name, label]) => <Check key={name} name={name} label={label} checked />)}
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="button">Export polished PDF</button>
            <button className="button-ghost" formAction="/api/exports/notebook/docx">
              Export editable Word (.docx)
            </button>
          </div>
        </form>
        {!!compilations.length && (
          <p className="mt-4 text-xs text-[#777]">
            Last exported {compilations[0].createdAt.toLocaleString()} by {nameById.get(compilations[0].compiledByMemberId ?? "") || "Former member"}: {compilations[0].filename}.
          </p>
        )}
      </Card>
      {!!entries.length && (
        <nav className="flex gap-2 overflow-x-auto border-y border-[#292929] py-3" aria-label="Notebook pages">
          {entries.map((entry, index) => (
            <Link
              className={`min-w-[210px] border p-3 ${selectedEntry?.id === entry.id && !showNew ? "border-[#fd7803] bg-[#fd7803]/10" : "border-[#333] bg-[#101010]"}`}
              href={`/admin/operations?tool=notebook&entry=${entry.id}`}
              key={entry.id}
            >
              <span className="font-mono text-[.62rem] text-[#fd7803]">PAGE {String(index + 1).padStart(2, "0")}</span>
              <strong className="mt-1 block truncate text-sm">{entry.title}</strong>
              <span className="mt-1 block text-[.65rem] text-[#777]">{displayStatus(entry.entryType)} · v{entry.currentVersion}</span>
            </Link>
          ))}
        </nav>
      )}
      <section className="grid gap-5">
        {entries.map((entry) => {
          const entryIndex = entries.findIndex((candidate) => candidate.id === entry.id);
          const entryVersions = versions.filter((version) => version.entryId === entry.id).sort((a, b) => b.versionNumber - a.versionNumber);
          const entryComments = comments.filter((comment) => comment.entryId === entry.id);
          const isSelected = entry.id === selectedEntry?.id && !showNew;
          return (
            <details id={`notebook-page-${entry.id}`} className="card scroll-mt-28 p-6 open:border-[#fd7803]/50" key={entry.id} open={isSelected}>
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-[#fd7803]">PAGE {String(entryIndex + 1).padStart(2, "0")}</span><Status value={entry.status} /><span className="tag">{displayStatus(entry.entryType)}</span></div>
                    <h2 className="mt-3 text-2xl font-bold">{entry.title}</h2>
                    <p className="mt-2 text-sm text-[#888]">
                      {entry.entryDate.toLocaleDateString()} · Version {entry.currentVersion} · Updated by {nameById.get(entry.updatedByMemberId ?? "") || "Former member"}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-[#fd7803]">{entry.tags.join(" · ")}</span>
                </div>
              </summary>
              <div className="mt-6 grid gap-6 border-t border-[#333] pt-6">
                {(!canEdit || !isSelected) && <div className="prose-editor border border-[#333] p-6" dangerouslySetInnerHTML={{ __html: entry.contentHtml }} />}
                {(!canEdit || !isSelected) && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Note label="Objective" value={entry.objective} />
                  <Note label="Decisions" value={entry.decisions} />
                  <Note label="Results" value={entry.results} />
                  <Note label="Next steps" value={entry.nextSteps} />
                </div>}
                {canEdit && !isSelected && <Link className="button w-fit" href={`/admin/operations?tool=notebook&entry=${entry.id}#notebook-page-${entry.id}`}>Edit this page</Link>}
                {canEdit && isSelected && (
                  <details className="border border-[#333] p-5" open>
                    <summary className="cursor-pointer font-semibold">Edit and create version {entry.currentVersion + 1}</summary>
                    <div className="mt-5"><NotebookEntryForm entry={entry} seasons={seasons} projects={projects} subsystems={subsystems} uploaderId={uploaderId} /></div>
                  </details>
                )}
                {isSelected && <div className="grid gap-6 xl:grid-cols-2">
                  <Card title="Review plans and comments">
                    <div className="grid gap-3">
                      {entryComments.map((comment) => (
                        <div className="border border-[#333] p-4" key={comment.id}>
                          <div className="flex flex-wrap justify-between gap-2"><Status value={comment.kind} /><span className="text-xs text-[#777]">{nameById.get(comment.memberId) || "Former member"}</span></div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#bbb]">{comment.body}</p>
                          {comment.status === "OPEN" && canEdit && <ActionForm action={resolveNotebookComment} successMessage="Comment resolved." className="mt-3"><input type="hidden" name="id" value={comment.id} /><button className="text-xs font-semibold text-[#fd7803]">Resolve</button></ActionForm>}
                        </div>
                      ))}
                      {!entryComments.length && <p className="text-sm text-[#777]">No review notes yet.</p>}
                    </div>
                    {canEdit && <NotebookCommentForm entryId={entry.id} />}
                  </Card>
                  <Card title="Version history">
                    <div className="grid gap-3">
                      {entryVersions.map((version) => (
                        <div className="flex items-start justify-between gap-4 border border-[#333] p-4" key={version.id}>
                          <div><strong>Version {version.versionNumber}</strong><p className="mt-1 text-xs text-[#777]">{version.changeSummary} · {nameById.get(version.createdByMemberId ?? "") || "Former member"}</p></div>
                          {canEdit && version.versionNumber !== entry.currentVersion && <ActionForm action={restoreNotebookVersion} successMessage={`Version ${version.versionNumber} restored.`}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="versionId" value={version.id} /><button className="text-xs font-semibold text-[#fd7803]">Restore</button></ActionForm>}
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>}
              </div>
            </details>
          );
        })}
        {!entries.length && <Empty title="No notebook entries" body="Create the first season planning entry to begin the versioned notebook." />}
      </section>
      {canEdit && (
        <NotebookPageOrganizer key={entries.map((entry) => `${entry.id}:${entry.sortOrder}`).join("|")} pages={entries.map((entry) => ({ id: entry.id, title: entry.title, entryType: entry.entryType, currentVersion: entry.currentVersion }))} />
      )}
      {canEdit && (
        <section className="grid gap-4 border border-[#fd7803]/40 bg-[#120c08] p-5 md:p-6" id="notebook-pages-end">
          <div>
            <p className="eyebrow">End of notebook</p>
            <h3 className="mt-2 text-xl font-bold">Add the next page</h3>
            <p className="mt-2 text-sm text-[#888]">Create a blank editable page or import a DOCX, PDF, or shared Google Drive document as the next page in order.</p>
          </div>
          {!showNew && <Link className="button w-fit" href="/admin/operations?tool=notebook&entry=new#new-notebook-page">+ Add page</Link>}
          {showNew && (
            <div id="new-notebook-page" className="scroll-mt-28">
              <Card title="Create a notebook page" subtitle="The first Heading 1, 2, or 3 in the editor becomes the page name.">
                <NotebookEntryForm seasons={seasons} projects={projects} subsystems={subsystems} uploaderId={uploaderId} />
              </Card>
            </div>
          )}
          <details className="border border-[#333] bg-[#0d0d0d] p-5">
            <summary className="cursor-pointer font-semibold">Import a page from a file or Google Drive</summary>
            <p className="mt-2 text-sm text-[#888]">Upload a DOCX/PDF or paste a shared Drive link. Google Docs and DOCX content become editable; PDF originals stay in Documents while extracted content becomes an editable page.</p>
            <div className="mt-5"><NotebookFileImport uploaderId={uploaderId} seasons={seasons} projects={projects} subsystems={subsystems} /></div>
          </details>
        </section>
      )}
    </div>
  );
}

export function InventoryWorkspace({
  items,
  seasons,
  projects,
  subsystems,
  parts,
}: {
  items: Inventory[];
  seasons: Season[];
  projects: Project[];
  subsystems: Subsystem[];
  parts: Part[];
}) {
  const lowStock = items.filter((item) => inventoryAvailable(item) <= item.reorderPoint);
  return (
    <div className="grid gap-8">
      <Intro eyebrow="Inventory control" title="Know what is available before buying or building." body="Reserve stock for subsystems, set reorder points, connect master parts, and keep locations and suppliers current." />
      <div className="grid gap-4 sm:grid-cols-3"><Metric value={String(items.length)} label="Stock records" /><Metric value={String(lowStock.length)} label="At / below reorder" /><Metric value={centsToMoney(items.reduce((sum, item) => sum + item.quantityOnHand * item.unitCostCents, 0))} label="Inventory value" /></div>
      <Card title="Add inventory item"><InventoryForm seasons={seasons} projects={projects} subsystems={subsystems} parts={parts} /></Card>
      <section className="grid gap-4">
        {items.map((item) => (
          <details className="card p-5 open:border-[#fd7803]/50" key={item.id}>
            <summary className="cursor-pointer list-none"><div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]"><div><Status value={item.status} /><h3 className="mt-2 text-lg font-bold">{item.sku} · {item.name}</h3><p className="mt-1 text-xs text-[#777]">{item.category} · {item.location} · {item.supplier || "No supplier"}</p></div><Mini label="Available" value={inventoryAvailable(item)} alert={inventoryAvailable(item) <= item.reorderPoint} /><Mini label="Reserved" value={item.quantityReserved} /></div></summary>
            <div className="mt-5 border-t border-[#333] pt-5"><InventoryForm item={item} seasons={seasons} projects={projects} subsystems={subsystems} parts={parts} /><ActionForm action={deleteInventoryItem} successMessage="Inventory item deleted." className="mt-3"><input type="hidden" name="id" value={item.id} /><button className="text-xs font-semibold text-red-300">Delete item</button></ActionForm></div>
          </details>
        ))}
      </section>
    </div>
  );
}

export function PurchasingWorkspace({
  requests,
  seasons,
  projects,
  subsystems,
  inventory,
  plans,
  nameById,
}: {
  requests: Purchase[];
  seasons: Season[];
  projects: Project[];
  subsystems: Subsystem[];
  inventory: Inventory[];
  plans: Plan[];
  nameById: Map<string, string>;
}) {
  return (
    <div className="grid gap-8">
      <Intro eyebrow="Purchasing workflow" title="Request, approve, order, receive, and reconcile." body="Receiving linked stock updates inventory and creates the matching paid expense in the selected budget plan once, automatically." />
      <Card title="New purchase request"><PurchaseForm seasons={seasons} projects={projects} subsystems={subsystems} inventory={inventory} plans={plans} /></Card>
      <section className="grid gap-5">
        {requests.map((request) => (
          <details className="card p-6 open:border-[#fd7803]/50" key={request.id}>
            <summary className="cursor-pointer list-none"><div className="flex flex-wrap justify-between gap-5"><div><Status value={request.status} /><h3 className="mt-3 text-xl font-bold">{request.item}</h3><p className="mt-2 text-sm text-[#888]">Qty {request.quantity} · {request.vendor || "Vendor TBD"} · requested by {nameById.get(request.requestedByMemberId) || "Former member"}</p></div><strong className="font-mono text-xl text-[#fd7803]">{centsToMoney(request.quantity * request.estimatedUnitCostCents)}</strong></div></summary>
            <div className="mt-6 grid gap-5 border-t border-[#333] pt-6"><PurchaseForm request={request} seasons={seasons} projects={projects} subsystems={subsystems} inventory={inventory} plans={plans} /><div className="flex flex-wrap gap-2">{purchaseStatuses.filter((status) => status !== request.status).map((status) => <ActionForm action={reviewPurchaseRequest} successMessage={`Purchase marked ${displayStatus(status)}.`} key={status}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="status" value={status} /><button className={status === "REJECTED" || status === "CANCELED" ? "button secondary" : "button"}>{displayStatus(status)}</button></ActionForm>)}</div></div>
          </details>
        ))}
        {!requests.length && <Empty title="No purchase requests" body="Submit parts, subscriptions, event supplies, or marketing materials for approval." />}
      </section>
    </div>
  );
}

export function DesignChangesWorkspace({
  changes,
  seasons,
  projects,
  subsystems,
  parts,
  nameById,
}: {
  changes: Change[];
  seasons: Season[];
  projects: Project[];
  subsystems: Subsystem[];
  parts: Part[];
  nameById: Map<string, string>;
}) {
  return (
    <div className="grid gap-8">
      <Intro eyebrow="Engineering change control" title="Make design revisions deliberate and reviewable." body="Capture the reason, revision delta, cost, schedule, risk, verification plan, approval, and implementation evidence for every controlled change." />
      <Card title="Propose design change"><DesignChangeForm seasons={seasons} projects={projects} subsystems={subsystems} parts={parts} /></Card>
      <section className="grid gap-5">
        {changes.map((change) => (
          <details className="card p-6 open:border-[#fd7803]/50" key={change.id}>
            <summary className="cursor-pointer list-none"><div className="flex flex-wrap justify-between gap-5"><div><div className="flex flex-wrap gap-2"><Status value={change.status} /><span className="tag">Risk {change.risk}</span></div><h3 className="mt-3 text-xl font-bold">{change.changeNumber} · {change.title}</h3><p className="mt-2 text-sm text-[#888]">Rev {change.revisionFrom || "—"} → {change.revisionTo || "—"} · requested by {nameById.get(change.requestedByMemberId) || "Former member"}</p></div><div className="text-right"><strong className="font-mono text-lg text-[#fd7803]">{centsToMoney(change.costImpactCents)}</strong><p className="mt-1 text-xs text-[#777]">{change.scheduleImpactDays} day impact</p></div></div></summary>
            <div className="mt-6 grid gap-5 border-t border-[#333] pt-6"><div className="grid gap-4 md:grid-cols-2"><Note label="Reason" value={change.reason} /><Note label="Impact" value={change.impact} /><Note label="Verification plan" value={change.verificationPlan} /><Note label="Verification results" value={change.verificationResults} /></div><DesignChangeForm change={change} seasons={seasons} projects={projects} subsystems={subsystems} parts={parts} /><div className="flex flex-wrap gap-2">{designChangeStatuses.filter((status) => status !== change.status).map((status) => <ActionForm action={reviewDesignChange} successMessage={`Change marked ${displayStatus(status)}.`} key={status}><input type="hidden" name="id" value={change.id} /><input type="hidden" name="status" value={status} /><button className={status === "REJECTED" ? "button secondary" : "button"}>{displayStatus(status)}</button></ActionForm>)}</div></div>
          </details>
        ))}
      </section>
    </div>
  );
}

export function ScoutingAdminWorkspace({ records }: { records: Scout[] }) {
  const teams = new Set(records.map((record) => record.observedTeam));
  return <div className="grid gap-8"><Intro eyebrow="Scouting review" title="Turn match observations into design evidence." body="Members submit observations in their portal. Officers and scouting leads can review coverage here; the same structured data feeds notebook compilation." /><div className="grid gap-4 sm:grid-cols-3"><Metric value={String(records.length)} label="Match observations" /><Metric value={String(teams.size)} label="Teams observed" /><Metric value={`${records.length ? Math.round((records.filter((record) => record.autonomousWinPoint).length / records.length) * 100) : 0}%`} label="VEX U AWP rate" /></div><Link className="button w-fit" href="/portal?tab=scouting">Open scouting entry and comparison portal</Link><div className="overflow-x-auto card"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#101010] font-mono text-[.65rem] uppercase tracking-wider text-[#777]"><tr>{["Event / match", "Team", "Score", "Auto Pins", "Pins", "Yellow", "Toggles", "Midfield", "AWP", "Reliability"].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{records.map((record) => <tr className="border-t border-[#2d2d2d]" key={record.id}><td className="px-4 py-4">{record.eventName} {record.matchNumber}</td><td className="px-4 py-4 font-bold text-[#fd7803]">{record.observedTeam}</td><td className="px-4 py-4">{record.score}</td><td className="px-4 py-4">{record.autoPinsScored}</td><td className="px-4 py-4">{record.alliancePinsScored}</td><td className="px-4 py-4">{record.yellowPinsOwned}</td><td className="px-4 py-4">{record.togglesOwned}</td><td className="px-4 py-4">{record.robotsMidfield}</td><td className="px-4 py-4">{record.autonomousWinPoint ? "Yes" : "No"}</td><td className="px-4 py-4">{record.reliabilityRating}/5</td></tr>)}</tbody></table></div></div>;
}

function SeasonForm({ season }: { season?: Season }) {
  return <ActionForm action={saveEngineeringSeason} successMessage={season ? "Season updated." : "Season created."} className="grid gap-4">{season && <input type="hidden" name="id" value={season.id} />}<Input label="Season name" name="name" value={season?.name ?? "2026-27 Override"} required /><div className="grid gap-4 sm:grid-cols-2"><Input label="Competition" name="competition" value={season?.competition ?? "VEX U"} /><Input label="Game" name="gameName" value={season?.gameName ?? "Override"} /><Input label="Manual version" name="gameManualVersion" value={season?.gameManualVersion ?? "1.0"} /><SelectField label="Status" name="status" value={season?.status ?? "ACTIVE"}>{seasonStatuses.map((status) => <option key={status}>{status}</option>)}</SelectField><DateInput label="Starts" name="startsAt" value={season?.startsAt ?? new Date("2026-05-01T12:00:00Z")} /><DateInput label="Ends" name="endsAt" value={season?.endsAt ?? new Date("2027-05-15T12:00:00Z")} /></div><Check name="isDefault" label="Use as the current default season" checked={season?.isDefault} /><button className="button w-fit">{season ? "Save season" : "Create season"}</button></ActionForm>;
}
function ProjectForm({ project, seasons, members }: { project?: Project; seasons: Season[]; members: Person[] }) {
  return <ActionForm action={saveEngineeringProject} successMessage={project ? "Project updated." : "Project created."} className="grid gap-4">{project && <input type="hidden" name="id" value={project.id} />}<SelectField label="Season" name="seasonId" value={project?.seasonId ?? seasons.find((season) => season.isDefault)?.id ?? seasons[0]?.id ?? ""}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</SelectField><div className="grid gap-4 sm:grid-cols-2"><Input label="Code" name="code" value={project?.code} placeholder="VEXU" required /><Input label="Name" name="name" value={project?.name} placeholder="Override competition robot" required /><SelectField label="Status" name="status" value={project?.status ?? "ACTIVE"}>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</SelectField><MemberSelect label="Project lead" name="leadMemberId" value={project?.leadMemberId} members={members} /></div><Textarea label="Description" name="description" value={project?.description} /><button className="button w-fit">Save project</button></ActionForm>;
}
function SubsystemForm({ subsystem, projects, members }: { subsystem?: Subsystem; projects: Project[]; members: Person[] }) {
  return <ActionForm action={saveEngineeringSubsystem} successMessage={subsystem ? "Subsystem updated." : "Subsystem created."} className="grid gap-4">{subsystem && <input type="hidden" name="id" value={subsystem.id} />}<SelectField label="Project" name="projectId" value={subsystem?.projectId ?? projects[0]?.id ?? ""}>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</SelectField><div className="grid gap-4 sm:grid-cols-2"><Input label="Code" name="code" value={subsystem?.code} placeholder="DRIVE" required /><Input label="Name" name="name" value={subsystem?.name} placeholder="Drivetrain" required /><SelectField label="Status" name="status" value={subsystem?.status ?? "ACTIVE"}>{projectStatuses.map((status) => <option key={status}>{status}</option>)}</SelectField><MemberSelect label="Subsystem lead" name="leadMemberId" value={subsystem?.leadMemberId} members={members} /></div><Textarea label="Scope and interfaces" name="description" value={subsystem?.description} /><button className="button w-fit">Save subsystem</button></ActionForm>;
}
function NotebookEntryForm({ entry, seasons, projects, subsystems, uploaderId }: { entry?: Entry; seasons: Season[]; projects: Project[]; subsystems: Subsystem[]; uploaderId: string }) {
  return (
    <ActionForm action={saveNotebookEntry} successMessage={entry ? "New notebook version saved." : "Notebook page created."} className="grid gap-7">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <section className="border border-[#303030] bg-[#111] p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-mono text-[.65rem] uppercase tracking-[.18em] text-[#fd7803]">Page identity</p><h4 className="mt-1 text-lg font-bold">Scope and publication metadata</h4></div>
          {entry && <span className="tag">Current version {entry.currentVersion}</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-xs font-semibold text-[#aaa] xl:col-span-2">Page title<input className="input" name="title" defaultValue={entry?.title} placeholder="A specific decision, test, build, or lesson" required /></label>
          <SelectField label="Entry type" name="entryType" value={entry?.entryType ?? "DESIGN"}>{notebookEntryTypes.map((type) => <option key={type}>{type}</option>)}</SelectField>
          <SelectField label="Publication status" name="status" value={entry?.status ?? "DRAFT"}>{notebookStatuses.map((status) => <option key={status}>{status}</option>)}</SelectField>
          <SelectField label="Season" name="seasonId" value={entry?.seasonId ?? seasons.find((season) => season.isDefault)?.id ?? seasons[0]?.id ?? ""}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</SelectField>
          <SelectField label="Project" name="projectId" value={entry?.projectId ?? ""}><option value="">Season-wide</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</SelectField>
          <SelectField label="Subsystem" name="subsystemId" value={entry?.subsystemId ?? ""}><option value="">All / unassigned</option>{subsystems.map((subsystem) => <option key={subsystem.id} value={subsystem.id}>{subsystem.code} · {subsystem.name}</option>)}</SelectField>
          <DateInput label="Entry date" name="entryDate" value={entry?.entryDate ?? new Date()} />
          <label className="grid gap-2 text-xs font-semibold text-[#aaa] md:col-span-2 xl:col-span-4">Searchable tags<input className="input" name="tags" defaultValue={entry?.tags.join(", ")} placeholder="drivetrain, prototype, test, iteration-3" /></label>
        </div>
      </section>
      <NotebookEditor key={entry?.id ?? "new"} initial={entry?.contentHtml} uploaderId={uploaderId} />
      <details className="border border-[#303030] bg-[#111] p-5">
        <summary className="cursor-pointer font-semibold">Optional structured evidence callouts</summary>
        <div className="mt-5"><p className="font-mono text-[.65rem] uppercase tracking-[.18em] text-[#fd7803]">Structured evidence</p><p className="mt-2 max-w-3xl text-sm leading-6 text-[#888]">Use these when you want consistent objective, decision, result, and next-step callouts in exports.</p></div>
        <div className="grid gap-4 md:grid-cols-2"><Textarea label="Objective / engineering question" name="objective" value={entry?.objective} /><Textarea label="Decision and rationale" name="decisions" value={entry?.decisions} /><Textarea label="Test results and evidence" name="results" value={entry?.results} /><Textarea label="Next steps and owner" name="nextSteps" value={entry?.nextSteps} /></div>
      </details>
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#303030] pt-5">
        <div className="min-w-[280px] flex-1"><Input label="Version note" name="changeSummary" placeholder={entry ? "Summarize exactly what changed in this version" : "Initial notebook page"} required={Boolean(entry)} /></div>
        <button className="button min-h-12">{entry ? `Save as version ${entry.currentVersion + 1}` : "Create notebook page"}</button>
      </div>
    </ActionForm>
  );
}
function NotebookCommentForm({ entryId }: { entryId: string }) {
  return <ActionForm action={saveNotebookComment} successMessage="Review note added." className="mt-5 grid gap-3"><input type="hidden" name="entryId" value={entryId} /><SelectField label="Note type" name="kind" value="COMMENT">{notebookCommentKinds.map((kind) => <option key={kind}>{kind}</option>)}</SelectField><Textarea label="Comment, planned addition, or requested change" name="body" required /><button className="button secondary w-fit">Add review note</button></ActionForm>;
}
function InventoryForm({ item, seasons, projects, subsystems, parts }: { item?: Inventory; seasons: Season[]; projects: Project[]; subsystems: Subsystem[]; parts: Part[] }) {
  return <ActionForm action={saveInventoryItem} successMessage={item ? "Inventory updated." : "Inventory item added."} className="grid gap-4">{item && <input type="hidden" name="id" value={item.id} />}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Input label="SKU / stock number" name="sku" value={item?.sku} required /><Input label="Item" name="name" value={item?.name} required /><CategorySelect label="Category" name="category" value={item?.category ?? "Robot parts"} options={inventoryCategories} /><Input label="Location" name="location" value={item?.location ?? "Shop"} /><NumberInput label="On hand" name="quantityOnHand" value={item?.quantityOnHand ?? 0} /><NumberInput label="Reserved" name="quantityReserved" value={item?.quantityReserved ?? 0} /><NumberInput label="Reorder at" name="reorderPoint" value={item?.reorderPoint ?? 0} /><MoneyInput label="Unit cost" name="unitCost" cents={item?.unitCostCents ?? 0} /><Input label="Supplier" name="supplier" value={item?.supplier} /><SelectField label="Status" name="status" value={item?.status ?? "ACTIVE"}><option>ACTIVE</option><option>DISCONTINUED</option><option>QUARANTINED</option></SelectField><SelectField label="Season" name="seasonId" value={item?.seasonId ?? ""}><option value="">Unassigned</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</SelectField><SelectField label="Project" name="projectId" value={item?.projectId ?? ""}><option value="">Unassigned</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code}</option>)}</SelectField><SelectField label="Subsystem" name="subsystemId" value={item?.subsystemId ?? ""}><option value="">Unassigned</option>{subsystems.map((subsystem) => <option key={subsystem.id} value={subsystem.id}>{subsystem.code}</option>)}</SelectField><SelectField label="Master part" name="partId" value={item?.partId ?? ""}><option value="">Unlinked</option>{parts.map((part) => <option key={part.id} value={part.id}>{part.partNumber} · {part.name}</option>)}</SelectField></div><Textarea label="Notes" name="notes" value={item?.notes} /><button className="button w-fit">Save inventory</button></ActionForm>;
}
function PurchaseForm({ request, seasons, projects, subsystems, inventory, plans }: { request?: Purchase; seasons: Season[]; projects: Project[]; subsystems: Subsystem[]; inventory: Inventory[]; plans: Plan[] }) {
  return <ActionForm action={savePurchaseRequest} successMessage={request ? "Purchase request updated." : "Purchase request created."} className="grid gap-4">{request && <input type="hidden" name="id" value={request.id} />}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Input label="Item / service" name="item" value={request?.item} required /><CategorySelect label="Use / category" name="category" value={request?.category ?? "Robot parts"} options={financeCategories} /><Input label="Vendor" name="vendor" value={request?.vendor} /><NumberInput label="Quantity" name="quantity" value={request?.quantity ?? 1} min={1} /><MoneyInput label="Estimated unit cost" name="estimatedUnitCost" cents={request?.estimatedUnitCostCents ?? 0} /><SelectField label="Priority" name="priority" value={request?.priority ?? "NORMAL"}><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></SelectField><SelectField label="Status" name="status" value={request?.status ?? "SUBMITTED"}>{purchaseStatuses.map((status) => <option key={status}>{status}</option>)}</SelectField><DateInput label="Needed by" name="neededBy" value={request?.neededBy} optional /><SelectField label="Inventory item" name="inventoryItemId" value={request?.inventoryItemId ?? ""}><option value="">Do not add to stock</option>{inventory.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</SelectField><SelectField label="Budget plan" name="financePlanId" value={request?.financePlanId ?? ""}><option value="">Unassigned</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</SelectField><SelectField label="Season" name="seasonId" value={request?.seasonId ?? ""}><option value="">Unassigned</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</SelectField><SelectField label="Project" name="projectId" value={request?.projectId ?? ""}><option value="">Unassigned</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code}</option>)}</SelectField><SelectField label="Subsystem" name="subsystemId" value={request?.subsystemId ?? ""}><option value="">Unassigned</option>{subsystems.map((subsystem) => <option key={subsystem.id} value={subsystem.id}>{subsystem.code}</option>)}</SelectField></div><Textarea label="Justification, links, and notes" name="notes" value={request?.notes} /><button className="button w-fit">Save request</button></ActionForm>;
}
function DesignChangeForm({ change, seasons, projects, subsystems, parts }: { change?: Change; seasons: Season[]; projects: Project[]; subsystems: Subsystem[]; parts: Part[] }) {
  return <ActionForm action={saveDesignChange} successMessage={change ? "Design change updated." : "Design change proposed."} className="grid gap-4">{change && <input type="hidden" name="id" value={change.id} />}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Input label="Change number" name="changeNumber" value={change?.changeNumber} placeholder="ECN-001" required /><Input label="Title" name="title" value={change?.title} required /><SelectField label="Status" name="status" value={change?.status ?? "IN_REVIEW"}>{designChangeStatuses.map((status) => <option key={status}>{status}</option>)}</SelectField><SelectField label="Risk" name="risk" value={change?.risk ?? "MEDIUM"}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></SelectField><Input label="Revision from" name="revisionFrom" value={change?.revisionFrom} /><Input label="Revision to" name="revisionTo" value={change?.revisionTo} /><MoneyInput label="Cost impact" name="costImpact" cents={change?.costImpactCents ?? 0} /><NumberInput label="Schedule impact (days)" name="scheduleImpactDays" value={change?.scheduleImpactDays ?? 0} /><SelectField label="Season" name="seasonId" value={change?.seasonId ?? ""}><option value="">Unassigned</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</SelectField><SelectField label="Project" name="projectId" value={change?.projectId ?? ""}><option value="">Unassigned</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code}</option>)}</SelectField><SelectField label="Subsystem" name="subsystemId" value={change?.subsystemId ?? ""}><option value="">Unassigned</option>{subsystems.map((subsystem) => <option key={subsystem.id} value={subsystem.id}>{subsystem.code}</option>)}</SelectField><SelectField label="Affected master part" name="partId" value={change?.partId ?? ""}><option value="">No single part</option>{parts.map((part) => <option key={part.id} value={part.id}>{part.partNumber} · {part.name}</option>)}</SelectField></div><div className="grid gap-4 md:grid-cols-2"><Textarea label="Reason for change" name="reason" value={change?.reason} required /><Textarea label="Detailed change" name="description" value={change?.description} required /><Textarea label="System, cost, and schedule impact" name="impact" value={change?.impact} /><Textarea label="Verification plan" name="verificationPlan" value={change?.verificationPlan} /><Textarea label="Verification results" name="verificationResults" value={change?.verificationResults} /></div><button className="button w-fit">Save design change</button></ActionForm>;
}

function Intro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) { return <div><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 text-3xl font-bold">{title}</h2><p className="mt-3 max-w-4xl text-sm leading-7 text-[#999]">{body}</p></div>; }
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) { return <section className="border border-[#333] bg-[#0d0d0d] p-5 md:p-6"><h3 className="text-lg font-bold">{title}</h3>{subtitle && <p className="mt-2 text-sm leading-6 text-[#888]">{subtitle}</p>}<div className="mt-5">{children}</div></section>; }
function Metric({ value, label }: { value: string; label: string }) { return <div className="card p-5"><strong className="font-mono text-2xl text-[#fd7803]">{value}</strong><p className="mt-2 text-xs uppercase tracking-wider text-[#777]">{label}</p></div>; }
function Mini({ value, label, alert = false }: { value: string | number; label: string; alert?: boolean }) { return <div className="min-w-24 border border-[#333] p-3 text-right"><strong className={`font-mono text-xl ${alert ? "text-red-300" : "text-[#fd7803]"}`}>{value}</strong><p className="text-[.6rem] uppercase tracking-wider text-[#777]">{label}</p></div>; }
function Status({ value }: { value: string }) { return <span className="tag">{displayStatus(value)}</span>; }
function Note({ label, value }: { label: string; value: string }) { return <div className="border border-[#333] p-4"><strong className="text-xs uppercase tracking-wider text-[#fd7803]">{label}</strong><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#aaa]">{value || "Not recorded."}</p></div>; }
function Empty({ title, body }: { title: string; body: string }) { return <div className="border border-dashed border-[#3a3a3a] p-8 text-center"><h3 className="text-lg font-bold">{title}</h3><p className="mt-2 text-sm text-[#777]">{body}</p></div>; }
function Input({ label, name, value, placeholder, required = false }: { label: string; name: string; value?: string; placeholder?: string; required?: boolean }) { return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<input className="input" name={name} defaultValue={value} placeholder={placeholder} required={required} /></label>; }
function NumberInput({ label, name, value, min = 0 }: { label: string; name: string; value: number; min?: number }) { return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<input className="input" name={name} type="number" min={min} step="1" defaultValue={value} /></label>; }
function MoneyInput({ label, name, cents }: { label: string; name: string; cents: number }) { return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<input className="input" name={name} type="number" min="0" step="0.01" defaultValue={cents / 100} /></label>; }
function Textarea({ label, name, value, required = false }: { label: string; name: string; value?: string; required?: boolean }) { return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<textarea className="input min-h-24" name={name} defaultValue={value} required={required} /></label>; }
function SelectField({ label, name, value, children }: { label: string; name: string; value?: string; children: ReactNode }) { return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<select className="input" name={name} defaultValue={value}>{children}</select></label>; }
function MemberSelect({ label, name, value, members }: { label: string; name: string; value?: string | null; members: Person[] }) { return <SelectField label={label} name={name} value={value ?? ""}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</SelectField>; }
function CategorySelect({ label, name, value, options }: { label: string; name: string; value: string; options: readonly string[] }) { return <SelectField label={label} name={name} value={value}>{!options.includes(value) && <option>{value}</option>}{options.map((option) => <option key={option}>{option}</option>)}</SelectField>; }
function DateInput({ label, name, value, optional = false }: { label: string; name: string; value?: Date | null; optional?: boolean }) { const formatted = value ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<CalendarInput type="datetime-local" name={name} defaultValue={formatted} required={!optional} /></label>; }
function Check({ name, label, checked = false }: { name: string; label: string; checked?: boolean }) { return <label className="flex items-center gap-3 border border-[#333] px-4 py-3 text-xs font-semibold text-[#aaa]"><input type="checkbox" name={name} defaultChecked={checked} />{label}</label>; }
