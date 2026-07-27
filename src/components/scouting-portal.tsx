import { ActionForm } from "@/components/action-form";
import type {
  engineeringSeasons,
  scoutingMatches,
} from "@/db/schema";
import {
  estimatedOverrideScore,
  scoutingMatchTypes,
  scoutingResults,
} from "@/lib/engineering-operations";
import {
  deleteScoutingMatch,
  saveScoutingMatch,
} from "@/app/portal/scouting-actions";

type Season = typeof engineeringSeasons.$inferSelect;
type Scout = typeof scoutingMatches.$inferSelect;

export function ScoutingPortal({
  seasons,
  records,
  memberId,
}: {
  seasons: Season[];
  records: Scout[];
  memberId: string;
}) {
  const summaries = [...new Set(records.map((record) => record.observedTeam))]
    .map((team) => {
      const rows = records.filter((record) => record.observedTeam === team);
      const average = (key: keyof Scout) =>
        rows.reduce(
          (sum, row) => sum + globalThis.Number(row[key] || 0),
          0,
        ) / rows.length;
      return {
        team,
        matches: rows.length,
        score: average("score"),
        pins: average("alliancePinsScored"),
        yellow: average("yellowPinsOwned"),
        toggles: average("togglesOwned"),
        cycles: average("successfulCycles"),
        reliability: average("reliabilityRating"),
        awpRate:
          (rows.filter((row) => row.autonomousWinPoint).length / rows.length) * 100,
      };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">VEX U Override</p>
          <h2 className="mt-2 text-3xl font-bold">Match scouting portal</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">
            Record both robots, autonomous execution, scoring patterns, Loader
            cycles, Pin ownership, Toggles, Midfield control, reliability, and
            strategy. Structured records automatically feed the engineering
            notebook compilation.
          </p>
        </div>
        <a
          className="button secondary"
          href="https://www.vexrobotics.com/v5/competition/vrc-current-game"
          target="_blank"
          rel="noreferrer"
        >
          Official Override resources
        </a>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric value={String(records.length)} label="Matches observed" />
        <Metric value={String(summaries.length)} label="Teams observed" />
        <Metric
          value={`${records.length ? Math.round((records.filter((record) => record.autonomousWinPoint).length / records.length) * 100) : 0}%`}
          label="Recorded AWP rate"
        />
        <Metric
          value={records.length ? (records.reduce((sum, record) => sum + record.reliabilityRating, 0) / records.length).toFixed(1) : "0.0"}
          label="Average reliability"
        />
      </section>

      <section className="card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h3 className="text-2xl font-bold">Quick match entry</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#888]">Start with match identity, then open only the scoring, strategy, or notes sections you need. The AWP indicator is calculated from the current VEX U v1.0 criteria.</p></div>
          <span className="tag">Autosaved when submitted</span>
        </div>
        <div className="mt-6">
          <ScoutingForm seasons={seasons} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[#333] p-6">
          <h3 className="text-xl font-bold">Team comparison</h3>
          <p className="mt-2 text-sm text-[#888]">Averages across every submitted match.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#101010] font-mono text-[.65rem] uppercase tracking-wider text-[#777]">
              <tr>
                {[
                  "Team",
                  "Matches",
                  "Score",
                  "Alliance Pins",
                  "Yellow Pins",
                  "Toggles",
                  "Cycles",
                  "AWP",
                  "Reliability",
                ].map((label) => (
                  <th className="px-4 py-3" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr className="border-t border-[#2d2d2d]" key={summary.team}>
                  <td className="px-4 py-4 font-bold text-[#fd7803]">{summary.team}</td>
                  <td className="px-4 py-4">{summary.matches}</td>
                  <td className="px-4 py-4">{summary.score.toFixed(1)}</td>
                  <td className="px-4 py-4">{summary.pins.toFixed(1)}</td>
                  <td className="px-4 py-4">{summary.yellow.toFixed(1)}</td>
                  <td className="px-4 py-4">{summary.toggles.toFixed(1)}</td>
                  <td className="px-4 py-4">{summary.cycles.toFixed(1)}</td>
                  <td className="px-4 py-4">{summary.awpRate.toFixed(0)}%</td>
                  <td className="px-4 py-4">{summary.reliability.toFixed(1)}/5</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!summaries.length && (
            <p className="p-8 text-sm text-[#777]">No scouting records yet.</p>
          )}
        </div>
      </section>

      <section className="grid gap-5">
        {records.map((record) => (
          <details className="card p-6 open:border-[#fd7803]/50" key={record.id}>
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="tag">{record.matchType.replaceAll("_", " ")}</span>
                  <h3 className="mt-3 text-xl font-bold">
                    {record.observedTeam} · {record.eventName} {record.matchNumber}
                  </h3>
                  <p className="mt-2 text-sm text-[#888]">
                    {record.result} · {record.score}-{record.opponentScore} · {record.allianceColor}
                  </p>
                </div>
                <div className="text-right">
                  <strong className="font-mono text-xl text-[#fd7803]">
                    {estimatedOverrideScore(record)} est.
                  </strong>
                  <p className="mt-1 text-xs text-[#777]">structured score</p>
                </div>
              </div>
            </summary>
            <div className="mt-6 grid gap-5 border-t border-[#333] pt-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Mini value={record.alliancePinsScored} label="Alliance Pins" />
                <Mini value={record.yellowPinsOwned} label="Yellow owned" />
                <Mini value={record.togglesOwned} label="Toggles" />
                <Mini value={record.robotsMidfield} label="Midfield robots" />
                <Mini value={record.autonomousWinPoint ? "Yes" : "No"} label="VEX U AWP" />
              </div>
              {(record.scoringPattern || record.strengths || record.weaknesses || record.notes) && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Note label="Scoring pattern" value={record.scoringPattern} />
                  <Note label="Strengths" value={record.strengths} />
                  <Note label="Weaknesses" value={record.weaknesses} />
                  <Note label="Notes" value={record.notes} />
                </div>
              )}
              {record.submittedByMemberId === memberId && (
                <details className="border border-[#333] p-4">
                  <summary className="cursor-pointer font-semibold">Edit your observation</summary>
                  <div className="mt-5">
                    <ScoutingForm seasons={seasons} record={record} />
                    <ActionForm
                      action={deleteScoutingMatch}
                      successMessage="Scouting record deleted."
                      className="mt-3"
                    >
                      <input type="hidden" name="id" value={record.id} />
                      <button className="text-xs font-semibold text-red-300">Delete record</button>
                    </ActionForm>
                  </div>
                </details>
              )}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function ScoutingForm({ seasons, record }: { seasons: Season[]; record?: Scout }) {
  const number = (key: keyof Scout, fallback = 0) =>
    globalThis.Number(record?.[key] ?? fallback);
  return (
    <ActionForm
      action={saveScoutingMatch}
      successMessage={record ? "Scouting record updated." : "Scouting record saved."}
      className="grid gap-6"
    >
      {record && <input type="hidden" name="id" value={record.id} />}
      <Fieldset title="1. Match identity" hint="Required basics and final score" open>
        <SelectField label="Season" name="seasonId" value={record?.seasonId ?? ""}>
          <option value="">Current season</option>
          {seasons.map((season) => <option value={season.id} key={season.id}>{season.name}</option>)}
        </SelectField>
        <Input label="Event" name="eventName" value={record?.eventName} required />
        <SelectField label="Match type" name="matchType" value={record?.matchType ?? "QUALIFICATION"}>
          {scoutingMatchTypes.map((value) => <option key={value}>{value}</option>)}
        </SelectField>
        <Input label="Match number" name="matchNumber" value={record?.matchNumber} placeholder="Q12" required />
        <Input label="Observed team" name="observedTeam" value={record?.observedTeam} placeholder="210Y" required />
        <SelectField label="Alliance" name="allianceColor" value={record?.allianceColor ?? "RED"}>
          <option>RED</option><option>BLUE</option>
        </SelectField>
        <SelectField label="Result" name="result" value={record?.result ?? "UNKNOWN"}>
          {scoutingResults.map((value) => <option key={value}>{value}</option>)}
        </SelectField>
        <Number label="Team score" name="score" value={number("score")} />
        <Number label="Opponent score" name="opponentScore" value={number("opponentScore")} />
      </Fieldset>

      <Fieldset title="2. Autonomous" hint="Pins, Midfield, bonus, and violations">
        <Number label="Autonomous points" name="autonomousScore" value={number("autonomousScore")} />
        <Number label="Pins scored" name="autoPinsScored" value={number("autoPinsScored")} max={100} />
        <Number label="Goals with 2+ Pins" name="autoGoalsWithTwoPins" value={number("autoGoalsWithTwoPins")} max={9} />
        <Number label="Robots in Midfield" name="autoRobotsMidfield" value={number("autoRobotsMidfield")} max={2} />
        <Check label="Won autonomous bonus" name="autonomousWon" checked={record?.autonomousWon} />
        <Check label="Touched Field Perimeter" name="autoContactedPerimeter" checked={record?.autoContactedPerimeter} />
        <Check label="Autonomous violation" name="autoViolation" checked={record?.autoViolation} />
      </Fieldset>

      <Fieldset title="3. Scoring and field control" hint="Detailed cycles, ownership, and reliability signals">
        <Number label="Alliance-color Pins scored" name="alliancePinsScored" value={number("alliancePinsScored")} />
        <Number label="Yellow Pins owned" name="yellowPinsOwned" value={number("yellowPinsOwned")} />
        <Number label="Goals used" name="goalsUsed" value={number("goalsUsed")} max={9} />
        <Number label="Maximum stack height" name="maxStackHeight" value={number("maxStackHeight")} />
        <Number label="Cups used" name="cupsUsed" value={number("cupsUsed")} />
        <Number label="Toggles owned" name="togglesOwned" value={number("togglesOwned")} max={4} />
        <Number label="Robots ending in Midfield" name="robotsMidfield" value={number("robotsMidfield")} max={2} />
        <Number label="Loader Pins" name="loaderPins" value={number("loaderPins")} />
        <Number label="Loader Cups" name="loaderCups" value={number("loaderCups")} />
        <Number label="Successful cycles" name="successfulCycles" value={number("successfulCycles")} />
        <Number label="Failed cycles" name="failedCycles" value={number("failedCycles")} />
        <Number label="Average cycle seconds" name="averageCycleSeconds" value={number("averageCycleSeconds")} max={120} />
        <Number label="Descores" name="descores" value={number("descores")} />
        <Number label="Penalty points" name="penalties" value={number("penalties")} />
        <Number label="Breakdowns / disables" name="breakdowns" value={number("breakdowns")} />
      </Fieldset>

      <Fieldset title="4. Strategy and ratings" hint="Robot roles and a fast 1–5 evaluation">
        <Input label="Large robot role" name="largeRobotRole" value={record?.largeRobotRole} placeholder="Stacking / Loader / defense" />
        <Input label="Small robot role" name="smallRobotRole" value={record?.smallRobotRole} placeholder="Toggle / Midfield / support" />
        <Rating label="Offense" name="offensiveRating" value={number("offensiveRating", 3)} />
        <Rating label="Defense" name="defensiveRating" value={number("defensiveRating", 3)} />
        <Rating label="Coordination" name="coordinationRating" value={number("coordinationRating", 3)} />
        <Rating label="Reliability" name="reliabilityRating" value={number("reliabilityRating", 3)} />
      </Fieldset>

      <Fieldset title="5. Notes" hint="Patterns, strengths, weaknesses, and context">
        <Textarea label="Scoring pattern and preferred Goals" name="scoringPattern" value={record?.scoringPattern} />
        <Textarea label="Strengths" name="strengths" value={record?.strengths} />
        <Textarea label="Weaknesses" name="weaknesses" value={record?.weaknesses} />
        <Textarea label="Match notes" name="notes" value={record?.notes} />
      </Fieldset>
      <button className="button w-fit">{record ? "Save changes" : "Save match scouting"}</button>
    </ActionForm>
  );
}

function Fieldset({ title, hint, open = false, children }: { title: string; hint: string; open?: boolean; children: React.ReactNode }) {
  return <details className="group border border-[#333] bg-[#0d0d0d] open:border-[#fd7803]/50" open={open}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4"><span><strong className="text-sm text-[#fd7803]">{title}</strong><small className="mt-1 block text-xs font-normal text-[#777]">{hint}</small></span><span className="text-xl text-[#777] transition group-open:rotate-45" aria-hidden="true">+</span></summary><fieldset className="grid gap-4 border-t border-[#333] p-4 md:grid-cols-2 xl:grid-cols-4">{children}</fieldset></details>;
}
function Input({ label, name, value, placeholder, required = false }: { label: string; name: string; value?: string; placeholder?: string; required?: boolean }) {
  return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<input className="input" name={name} defaultValue={value} placeholder={placeholder} required={required} /></label>;
}
function Number({ label, name, value, max = 10000 }: { label: string; name: string; value: number; max?: number }) {
  return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<input className="input" name={name} type="number" min="0" max={max} step="1" defaultValue={value} /></label>;
}
function Rating({ label, name, value }: { label: string; name: string; value: number }) {
  return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<select className="input" name={name} defaultValue={value}>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>;
}
function SelectField({ label, name, value, children }: { label: string; name: string; value: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<select className="input" name={name} defaultValue={value}>{children}</select></label>;
}
function Check({ label, name, checked }: { label: string; name: string; checked?: boolean }) {
  return <label className="flex min-h-[50px] items-center gap-3 border border-[#333] px-4 text-xs font-semibold text-[#aaa]"><input name={name} type="checkbox" defaultChecked={checked} />{label}</label>;
}
function Textarea({ label, name, value }: { label: string; name: string; value?: string }) {
  return <label className="grid gap-2 text-xs font-semibold text-[#aaa]">{label}<textarea className="input min-h-28" name={name} defaultValue={value} /></label>;
}
function Metric({ value, label }: { value: string; label: string }) {
  return <div className="card p-5"><strong className="font-mono text-2xl text-[#fd7803]">{value}</strong><p className="mt-2 text-xs uppercase tracking-wider text-[#777]">{label}</p></div>;
}
function Mini({ value, label }: { value: string | number; label: string }) {
  return <div className="border border-[#333] p-4"><strong className="font-mono text-lg text-[#fd7803]">{value}</strong><p className="mt-1 text-[.65rem] uppercase tracking-wider text-[#777]">{label}</p></div>;
}
function Note({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return <div className="border border-[#333] p-4"><strong className="text-xs uppercase tracking-wider text-[#fd7803]">{label}</strong><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#aaa]">{value}</p></div>;
}
