import Link from "next/link";
import type {
  designChanges,
  engineeringNotebookEntries,
  engineeringParts,
  engineeringProjects,
  manufacturingSteps,
} from "@/db/schema";

type NotebookEntry = typeof engineeringNotebookEntries.$inferSelect;
type Part = typeof engineeringParts.$inferSelect;
type Step = typeof manufacturingSteps.$inferSelect;
type Change = typeof designChanges.$inferSelect;
type Project = typeof engineeringProjects.$inferSelect;

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export function MemberEngineeringHub({
  notebook,
  parts,
  steps,
  changes,
  projects,
  memberNames,
  canEditNotebook,
  canEditEngineering,
  canEditChanges,
}: {
  notebook: NotebookEntry[];
  parts: Part[];
  steps: Step[];
  changes: Change[];
  projects: Project[];
  memberNames: Record<string, string>;
  canEditNotebook: boolean;
  canEditEngineering: boolean;
  canEditChanges: boolean;
}) {
  const incompleteSteps = steps.filter(
    (step) => !["COMPLETE", "VERIFIED"].includes(step.status),
  );
  const partsInProduction = parts.filter((part) =>
    ["RELEASED", "IN_MANUFACTURING", "READY"].includes(part.lifecycleStatus),
  );
  return (
    <div className="grid gap-7">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Member engineering view</p>
          <h2 className="mt-3 text-3xl font-bold">
            Notebook, design, and manufacturing
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">
            Review approved notebook evidence, the current part master, and
            manufacturing instructions. Editing controls are shown only when
            your role has the matching permission.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditNotebook && (
            <Link
              className="button secondary"
              href="/admin/operations?tool=notebook"
            >
              Edit notebook
            </Link>
          )}
          {canEditEngineering && (
            <Link
              className="button secondary"
              href="/admin/operations?tool=engineering"
            >
              Edit engineering
            </Link>
          )}
          {canEditChanges && (
            <Link
              className="button secondary"
              href="/admin/operations?tool=changes"
            >
              Edit design changes
            </Link>
          )}
          {!canEditNotebook && !canEditEngineering && !canEditChanges && (
            <span className="tag">Read-only access</span>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [notebook.length, "Notebook pages"],
          [parts.length, "Master parts"],
          [partsInProduction.length, "Released / manufacturing"],
          [incompleteSteps.length, "Open operations"],
        ].map(([value, title]) => (
          <div className="border border-[#333] bg-[#0d0d0d] p-5" key={title}>
            <strong className="text-3xl">{value}</strong>
            <p className="mt-2 text-xs uppercase tracking-wider text-[#777]">
              {title}
            </p>
          </div>
        ))}
      </div>

      <section className="border border-[#333] bg-[#0d0d0d] p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Engineering notebook</p>
            <h3 className="mt-3 text-2xl font-bold">Approved team evidence</h3>
          </div>
          <span className="tag">{notebook.length} visible pages</span>
        </div>
        <div className="mt-5 grid gap-4">
          {notebook.map((entry, index) => (
            <details
              className="border border-[#333] bg-black/20 p-5 open:border-[#fd7803]/50"
              key={entry.id}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-xs text-[#fd7803]">
                      PAGE {String(index + 1).padStart(2, "0")}
                    </span>
                    <h4 className="mt-2 text-xl font-bold">{entry.title}</h4>
                    <p className="mt-2 text-xs text-[#777]">
                      {entry.entryDate.toLocaleDateString()} ·{" "}
                      {label(entry.entryType)} · version {entry.currentVersion}
                    </p>
                  </div>
                  <span className="tag">{label(entry.status)}</span>
                </div>
              </summary>
              <div className="mt-5 border-t border-[#333] pt-5">
                <div
                  className="prose-editor border border-[#333] p-5"
                  dangerouslySetInnerHTML={{ __html: entry.contentHtml }}
                />
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Objective", entry.objective],
                    ["Decisions", entry.decisions],
                    ["Results", entry.results],
                    ["Next steps", entry.nextSteps],
                  ].map(([title, value]) => (
                    <div className="border border-[#292929] p-4" key={title}>
                      <strong className="text-xs uppercase tracking-wider text-[#fd7803]">
                        {title}
                      </strong>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#999]">
                        {value || "Not recorded"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
          {!notebook.length && (
            <p className="border border-dashed border-[#333] p-8 text-center text-sm text-[#777]">
              No approved notebook pages are available yet.
            </p>
          )}
        </div>
      </section>

      <section className="border border-[#333] bg-[#0d0d0d] p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Design and manufacturing</p>
            <h3 className="mt-3 text-2xl font-bold">
              Part master and shop instructions
            </h3>
          </div>
          <span className="tag">{projects.length} active project records</span>
        </div>
        <div className="mt-5 grid gap-4">
          {parts.map((part) => {
            const router = steps
              .filter((step) => step.partId === part.id)
              .sort((a, b) => a.sequence - b.sequence);
            return (
              <details
                className="border border-[#333] bg-black/20 p-5 open:border-[#fd7803]/50"
                key={part.id}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="tag">Qty {part.quantity}</span>
                        <span className="tag">{label(part.makeBuy)}</span>
                        <span className="tag">
                          {label(part.verificationStatus)}
                        </span>
                      </div>
                      <h4 className="mt-3 text-xl font-bold">
                        <span className="font-mono text-[#fd7803]">
                          {part.partNumber}
                        </span>{" "}
                        · {part.name}
                      </h4>
                      <p className="mt-2 text-sm text-[#888]">
                        {part.project} / {part.subsystem} · Rev {part.revision}{" "}
                        · {part.material || "Material TBD"}
                      </p>
                    </div>
                    <span className="tag">{label(part.lifecycleStatus)}</span>
                  </div>
                </summary>
                <div className="mt-5 grid gap-5 border-t border-[#333] pt-5 lg:grid-cols-[.7fr_1.3fr]">
                  <div className="grid content-start gap-3 text-sm">
                    {[
                      ["CAD", part.cadStatus],
                      ["CAM", part.camStatus],
                      ["CAE", part.caeStatus],
                      ["Drawing", part.drawingStatus],
                      [
                        "Owner",
                        memberNames[part.assignedToMemberId || ""] ||
                          "Unassigned",
                      ],
                    ].map(([title, value]) => (
                      <div
                        className="flex justify-between gap-4 border-b border-[#292929] pb-2"
                        key={title}
                      >
                        <span className="text-[#777]">{title}</span>
                        <strong>{label(value)}</strong>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {part.cadUrl && (
                        <a
                          className="text-[#fd7803] underline"
                          href={part.cadUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          CAD
                        </a>
                      )}
                      {part.drawingUrl && (
                        <a
                          className="text-[#fd7803] underline"
                          href={part.drawingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Drawing
                        </a>
                      )}
                      {part.sourceUrl && (
                        <a
                          className="text-[#fd7803] underline"
                          href={part.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <h5 className="font-bold">Manufacturing router</h5>
                    <div className="mt-3 grid gap-3">
                      {router.map((step) => (
                        <article
                          className="border border-[#333] p-4"
                          key={step.id}
                        >
                          <div className="flex flex-wrap justify-between gap-3">
                            <strong>
                              {step.sequence}. {step.process}
                            </strong>
                            <span className="tag">{label(step.status)}</span>
                          </div>
                          <p className="mt-2 text-xs text-[#777]">
                            {step.machine || "Workcenter TBD"} ·{" "}
                            {memberNames[step.assignedToMemberId || ""] ||
                              "Unassigned"}
                          </p>
                          {step.setup && (
                            <p className="mt-3 text-sm text-[#aaa]">
                              <strong>Setup:</strong> {step.setup}
                            </p>
                          )}
                          {step.instructions && (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#999]">
                              {step.instructions}
                            </p>
                          )}
                          {step.inspectionCriteria && (
                            <p className="mt-2 text-sm text-[#fd7803]">
                              <strong>Inspect:</strong>{" "}
                              {step.inspectionCriteria}
                            </p>
                          )}
                        </article>
                      ))}
                      {!router.length && (
                        <p className="text-sm text-[#777]">
                          No manufacturing operations recorded.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
          {!parts.length && (
            <p className="border border-dashed border-[#333] p-8 text-center text-sm text-[#777]">
              No current parts are available.
            </p>
          )}
        </div>
      </section>

      <section className="border border-[#333] bg-[#0d0d0d] p-5 md:p-6">
        <p className="eyebrow">Design-change control</p>
        <h3 className="mt-3 text-2xl font-bold">Approved and active changes</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {changes.map((change) => (
            <article
              className="border border-[#333] bg-black/20 p-5"
              key={change.id}
            >
              <div className="flex flex-wrap justify-between gap-3">
                <span className="tag">{label(change.status)}</span>
                <span className="tag">Risk {label(change.risk)}</span>
              </div>
              <h4 className="mt-3 text-lg font-bold">
                {change.changeNumber} · {change.title}
              </h4>
              <p className="mt-2 text-xs text-[#777]">
                Rev {change.revisionFrom || "—"} → {change.revisionTo || "—"}
              </p>
              <p className="mt-4 text-sm leading-6 text-[#aaa]">
                {change.description}
              </p>
              {change.verificationResults && (
                <p className="mt-3 text-sm leading-6 text-[#999]">
                  <strong className="text-[#fd7803]">Verification:</strong>{" "}
                  {change.verificationResults}
                </p>
              )}
            </article>
          ))}
          {!changes.length && (
            <p className="text-sm text-[#777]">
              No approved design changes are available.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
