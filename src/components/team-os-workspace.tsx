import Link from "next/link";
import type {
  designChanges,
  engineeringNotebookEntries,
  engineeringProjects,
  engineeringSeasons,
  engineeringSubsystems,
  memberTasks,
  operationsHubRecords,
} from "@/db/schema";
import type { GitHubRepoAnalytics } from "@/lib/github-analytics";
import { ActionForm } from "@/components/action-form";
import { CalendarInput } from "@/components/calendar-input";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { TeamSearchAssistant } from "@/components/team-search-assistant";
import { AssistantConsole } from "@/components/assistant-console";
import {
  archiveHubRecord,
  rolloverEngineeringSeason,
  saveHubRecord,
  setHubRecordStatus,
} from "@/app/admin/control-center/actions";

type HubRecord = typeof operationsHubRecords.$inferSelect;
type Person = { id: string; name: string; role: string };
type View =
  | "competition"
  | "engineering"
  | "approvals"
  | "training"
  | "assistant"
  | "season"
  | "github";

const views: { value: View; label: string }[] = [
  { value: "competition", label: "Competition" },
  { value: "engineering", label: "Engineering controls" },
  { value: "approvals", label: "Approvals" },
  { value: "training", label: "Skills & training" },
  { value: "assistant", label: "Team assistant" },
  { value: "season", label: "Season rollover" },
  { value: "github", label: "GitHub" },
];

export function TeamOsWorkspace(props: {
  view?: string;
  records: HubRecord[];
  people: Person[];
  seasons: (typeof engineeringSeasons.$inferSelect)[];
  projects: (typeof engineeringProjects.$inferSelect)[];
  subsystems: (typeof engineeringSubsystems.$inferSelect)[];
  tasks: (typeof memberTasks.$inferSelect)[];
  notebook: (typeof engineeringNotebookEntries.$inferSelect)[];
  changes: (typeof designChanges.$inferSelect)[];
  names: Map<string, string>;
  github: GitHubRepoAnalytics[];
  uploaderId: string;
}) {
  const view = views.some((item) => item.value === props.view)
    ? (props.view as View)
    : "competition";
  return (
    <div className="grid gap-7">
      <section className="card overflow-hidden p-6 md:p-8">
        <p className="eyebrow">Team OS</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Plan, operate, approve, learn</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">
              One focused workspace for competition operations, engineering
              controls, team knowledge, approvals, season setup, and software.
            </p>
          </div>
          <Link className="button secondary" href="/admin/operations?tool=scouting">
            Open scouting
          </Link>
        </div>
      </section>
      <DashboardNavigation
        current={view}
        label="Team OS tools"
        items={views.map((item) => ({
          ...item,
          href: `/admin/control-center?tab=team-os&view=${item.value}`,
        }))}
      />
      {view === "competition" && <CompetitionWorkspace {...props} />}
      {view === "engineering" && <EngineeringControls {...props} />}
      {view === "approvals" && <ApprovalWorkspace {...props} />}
      {view === "training" && <TrainingWorkspace {...props} />}
      {view === "assistant" && <AssistantWorkspace uploaderId={props.uploaderId} />}
      {view === "season" && <SeasonWorkspace {...props} />}
      {view === "github" && <GitHubWorkspace {...props} />}
    </div>
  );
}

function CompetitionWorkspace(props: Parameters<typeof TeamOsWorkspace>[0]) {
  const events = ofKind(props.records, "COMPETITION_EVENT");
  const batteries = ofKind(props.records, "BATTERY");
  const configs = ofKind(props.records, "ROBOT_CONFIG");
  const checks = ofKind(props.records, "PIT_CHECK");
  const openChecks = checks.filter((item) => item.status !== "DONE");
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Competition events" value={events.length} />
        <Metric label="Batteries tracked" value={batteries.length} />
        <Metric label="Robot configurations" value={configs.length} />
        <Metric label="Open pit checks" value={openChecks.length} warn={!!openChecks.length} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Competition command center" subtitle="Event status, next match, pit location, and owner.">
          <RecordForm kind="COMPETITION_EVENT" submit="Add competition event" people={props.people} seasons={props.seasons}>
            <OptionalRecordDetails>
              <Text name="matchNumber" label="Next match" placeholder="Q12" />
              <Text name="pitLocation" label="Pit location" placeholder="Pit 210" />
            </OptionalRecordDetails>
          </RecordForm>
          <RecordList records={events} names={props.names} completeLabel="Close event" />
        </Panel>
        <Panel title="Pit and inspection checklist" subtitle="Make the pre-match handoff visible and auditable.">
          <RecordForm kind="PIT_CHECK" submit="Add checklist item" people={props.people} seasons={props.seasons}>
            <OptionalRecordDetails>
              <Text name="checklistGroup" label="Checklist" placeholder="Pre-match / inspection / pack-out" />
            </OptionalRecordDetails>
          </RecordForm>
          <RecordList records={checks} names={props.names} completeLabel="Mark checked" />
        </Panel>
        <Panel title="Battery tracking" subtitle="Log charge state, voltage, cycles, and readiness.">
          <RecordForm kind="BATTERY" submit="Add battery" people={props.people} seasons={props.seasons}>
            <OptionalRecordDetails>
              <Text name="batteryVoltage" label="Voltage / charge" placeholder="12.6 V / 100%" />
              <Text name="batteryCycles" label="Cycle count" placeholder="18" />
            </OptionalRecordDetails>
          </RecordForm>
          <RecordList records={batteries} names={props.names} completeLabel="Retire" />
        </Panel>
        <Panel title="Robot configuration log" subtitle="Record competition-ready hardware and firmware combinations.">
          <RecordForm kind="ROBOT_CONFIG" submit="Save configuration" people={props.people} seasons={props.seasons}>
            <OptionalRecordDetails>
              <Text name="configuration" label="Configuration" placeholder="Skills intake + match clamp" />
              <Text name="firmwareVersion" label="Software version" placeholder="v2.4.1 / commit" />
            </OptionalRecordDetails>
          </RecordForm>
          <RecordList records={configs} names={props.names} completeLabel="Supersede" />
        </Panel>
      </div>
    </div>
  );
}

function EngineeringControls(props: Parameters<typeof TeamOsWorkspace>[0]) {
  const sections = [
    { kind: "ENGINEERING_QUESTION", title: "Open questions & assumptions", submit: "Add question", extra: <OptionalRecordDetails><Text name="assumption" label="Current assumption" /><Text name="answer" label="Validated answer" /></OptionalRecordDetails> },
    { kind: "TECH_DEBT", title: "Technical debt", submit: "Log technical debt", extra: <OptionalRecordDetails><Text name="impact" label="Impact if deferred" /></OptionalRecordDetails> },
    { kind: "CORRECTIVE_ACTION", title: "Corrective actions", submit: "Add corrective action", extra: <OptionalRecordDetails><Text name="rootCause" label="Root cause" /><Text name="correctiveAction" label="Corrective action" /></OptionalRecordDetails> },
    { kind: "DEPENDENCY", title: "Cross-subsystem dependencies", submit: "Add dependency", extra: <OptionalRecordDetails><Text name="blockedBy" label="Depends on" /><Text name="dependencyType" label="Dependency type" placeholder="Interface / schedule / decision" /></OptionalRecordDetails> },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {sections.map((section) => (
        <Panel key={section.kind} title={section.title} subtitle="Assign an owner, priority, scope, and due date.">
          <RecordForm kind={section.kind} submit={section.submit} people={props.people} seasons={props.seasons} projects={props.projects} subsystems={props.subsystems}>
            {section.extra}
          </RecordForm>
          <RecordList records={ofKind(props.records, section.kind)} names={props.names} completeLabel="Resolve" />
        </Panel>
      ))}
    </div>
  );
}

function ApprovalWorkspace(props: Parameters<typeof TeamOsWorkspace>[0]) {
  const approvals = ofKind(props.records, "APPROVAL");
  const taskReviews = props.tasks.filter((item) => item.completionRequestedAt && item.status !== "DONE");
  const notebookReviews = props.notebook.filter((item) => item.status === "IN_REVIEW");
  const designReviews = props.changes.filter((item) => ["IN_REVIEW", "SUBMITTED"].includes(item.status));
  return (
    <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <Panel title="Request an approval" subtitle="Route a decision with an owner and deadline.">
        <RecordForm kind="APPROVAL" submit="Request approval" people={props.people} seasons={props.seasons} projects={props.projects} subsystems={props.subsystems}>
          <OptionalRecordDetails>
            <Text name="approvalType" label="Approval type" placeholder="Budget / design / document / task" />
            <Text name="approvalNote" label="Decision needed" />
          </OptionalRecordDetails>
        </RecordForm>
      </Panel>
      <Panel title="Approval inbox" subtitle="Pending items from Team OS, tasks, notebook reviews, and design changes.">
        <RecordList records={approvals.filter((item) => !["APPROVED", "REJECTED", "DONE"].includes(item.status))} names={props.names} completeLabel="Approve" completeStatus="APPROVED" />
        <div className="mt-5 grid gap-3">
          {taskReviews.map((item) => <InboxItem key={item.id} title={item.title} meta={`Task completion from ${props.names.get(item.assignedToMemberId) || "member"}`} href="/admin/operations?tab=tasks" />)}
          {notebookReviews.map((item) => <InboxItem key={item.id} title={item.title} meta="Notebook review" href="/admin/operations?tab=notebook" />)}
          {designReviews.map((item) => <InboxItem key={item.id} title={`${item.changeNumber} · ${item.title}`} meta="Design-change review" href="/admin/operations?tab=engineering" />)}
          {!approvals.length && !taskReviews.length && !notebookReviews.length && !designReviews.length && <Empty text="Nothing is waiting for approval." />}
        </div>
      </Panel>
    </div>
  );
}

function TrainingWorkspace(props: Parameters<typeof TeamOsWorkspace>[0]) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Knowledge gaps" subtitle="Record missing knowledge before it becomes schedule risk.">
        <RecordForm kind="KNOWLEDGE_GAP" submit="Add knowledge gap" people={props.people}>
          <OptionalRecordDetails>
            <Text name="currentLevel" label="Current level" placeholder="New / developing / independent" />
            <Text name="targetLevel" label="Target level" />
          </OptionalRecordDetails>
        </RecordForm>
        <RecordList records={ofKind(props.records, "KNOWLEDGE_GAP")} names={props.names} completeLabel="Close gap" />
      </Panel>
      <Panel title="Cross-training plan" subtitle="Pair trainers and learners with a concrete outcome.">
        <RecordForm kind="CROSS_TRAINING" submit="Schedule training" people={props.people}>
          <OptionalRecordDetails>
            <Text name="trainer" label="Trainer / mentor" />
            <Text name="targetLevel" label="Completion standard" />
          </OptionalRecordDetails>
        </RecordForm>
        <RecordList records={ofKind(props.records, "CROSS_TRAINING")} names={props.names} completeLabel="Complete training" />
      </Panel>
    </div>
  );
}

export function AssistantWorkspace({ uploaderId }: { uploaderId: string }) {
  return (
    <div className="grid gap-6">
      <AssistantConsole uploaderId={uploaderId} />
      <div className="grid gap-6 xl:grid-cols-2"><Panel title="Ask the team" subtitle="Search approved team knowledge and get linked sources."><TeamSearchAssistant /></Panel>
      <Panel title="Engineering import assistant" subtitle="Review an Onshape BOM mapping, then safely merge parts into the master list.">
        <p className="text-sm leading-7 text-[#999]">The guided importer detects common Onshape columns, previews changes, flags incomplete mappings, and can ask the 210 Assistant for cleanup guidance without inventing part data.</p>
        <Link className="button mt-5 w-fit" href="/admin/operations?tool=engineering">Open Onshape BOM import</Link>
      </Panel>
      <Panel title="Your connected accounts" subtitle="Link GitHub to the signed-in member account and view personal repository analytics.">
        <p className="text-sm leading-7 text-[#999]">The 210 Assistant already uses your team identity and permissions. GitHub uses an account-specific OAuth connection, with provider tokens kept on the server.</p>
        <Link className="button mt-5 w-fit" href="/portal?tab=connections">Manage connections</Link>
      </Panel>
      </div>
    </div>
  );
}

function SeasonWorkspace(props: Parameters<typeof TeamOsWorkspace>[0]) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
    <Panel title="Season rollover assistant" subtitle="Create the next season and optionally clone the project and subsystem structure. Historical records stay unchanged.">
      <ActionForm action={rolloverEngineeringSeason} successMessage="New season created." className="grid gap-4 md:grid-cols-2">
        <Select label="Source season" name="sourceSeasonId" required options={props.seasons.map((item) => ({ value: item.id, label: `${item.name} · ${item.gameName}` }))} />
        <Text name="name" label="New season name" required placeholder="2027–28 season" />
        <Text name="competition" label="Competition" placeholder="VEX U" />
        <Text name="gameName" label="Game name" required />
        <label className="field"><span>Starts</span><CalendarInput name="startsAt" required /></label>
        <label className="field"><span>Ends</span><CalendarInput name="endsAt" required /></label>
        <label className="flex items-center gap-3 border border-[#333] p-4 text-sm"><input type="checkbox" name="cloneStructure" defaultChecked /> Clone projects and subsystems</label>
        <label className="flex items-center gap-3 border border-[#333] p-4 text-sm"><input type="checkbox" name="isDefault" defaultChecked /> Make this the current season</label>
        <button className="button w-fit">Create next season</button>
      </ActionForm>
    </Panel>
    <Panel title="Annual impact milestone" subtitle="Add a public, verified outcome that complements the automatically generated annual report.">
      <RecordForm kind="IMPACT_METRIC" submit="Add impact metric" people={props.people}>
        <Text name="reportYear" label="Report year" required placeholder={String(new Date().getFullYear())} />
        <Text name="metricValue" label="Value" required placeholder="12" />
        <Text name="metricUnit" label="Unit" placeholder="awards / workshops / students served" />
      </RecordForm>
      <RecordList records={ofKind(props.records, "IMPACT_METRIC")} names={props.names} completeLabel="Publish" completeStatus="PUBLISHED" />
      <Link className="button secondary mt-5 w-fit" href="/impact">Preview public report</Link>
    </Panel>
    </div>
  );
}

function GitHubWorkspace(props: Parameters<typeof TeamOsWorkspace>[0]) {
  const repos = ofKind(props.records, "GITHUB_REPO");
  const accounts = ofKind(props.records, "GITHUB_ACCOUNT");
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Link repository" subtitle="Public repositories update automatically. A server GitHub token enables private repositories and higher limits.">
          <RecordForm kind="GITHUB_REPO" submit="Link repository" people={props.people} projects={props.projects} subsystems={props.subsystems}>
            <Text name="repoUrl" label="GitHub repository" required placeholder="https://github.com/organization/repository" />
          </RecordForm>
          <RecordList records={repos} names={props.names} completeLabel="Archive link" />
        </Panel>
        <Panel title="Link member GitHub account" subtitle="Associate a GitHub username with a team member for contribution reporting.">
          <RecordForm kind="GITHUB_ACCOUNT" submit="Link account" people={props.people}>
            <Text name="githubUsername" label="GitHub username" required placeholder="octocat" />
          </RecordForm>
          <RecordList records={accounts} names={props.names} completeLabel="Unlink" />
        </Panel>
      </div>
      <Panel title="Repository analytics" subtitle="A current 30-day engineering activity snapshot from GitHub.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {props.github.map((repo) => <article className="border border-[#333] p-5" key={repo.fullName}>
            <div className="flex items-start justify-between gap-3"><a className="font-bold text-[#fd7803] hover:underline" href={repo.url} target="_blank" rel="noreferrer">{repo.fullName}</a><span className="tag">{repo.language || "Repository"}</span></div>
            {repo.error ? <p className="mt-3 text-sm text-red-300">{repo.error}</p> : <><p className="mt-3 min-h-10 text-sm leading-6 text-[#999]">{repo.description || "No repository description."}</p><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Mini value={repo.recentCommits} label="30d commits" /><Mini value={repo.contributors} label="Contributors" /><Mini value={repo.openIssues} label="Open issues" /></div><p className="mt-4 text-xs text-[#666]">{repo.stars} stars · {repo.forks} forks · last push {repo.pushedAt ? new Date(repo.pushedAt).toLocaleDateString() : "unknown"}</p></>}
          </article>)}
          {!props.github.length && <Empty text="Link a repository to begin analytics." />}
        </div>
      </Panel>
    </div>
  );
}

function RecordForm(props: {
  kind: string;
  submit: string;
  people: Person[];
  seasons?: (typeof engineeringSeasons.$inferSelect)[];
  projects?: (typeof engineeringProjects.$inferSelect)[];
  subsystems?: (typeof engineeringSubsystems.$inferSelect)[];
  children?: React.ReactNode;
}) {
  return (
    <details className="border border-[#333] bg-[#0d0d0d] p-4">
      <summary className="cursor-pointer font-semibold text-[#fd7803]">{props.submit}</summary>
      <ActionForm action={saveHubRecord} successMessage="Saved." className="mt-5 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="kind" value={props.kind} />
        <input type="hidden" name="status" value="ACTIVE" />
        <Text name="title" label="Title" required />
        <Select label="Owner" name="ownerMemberId" options={[{ value: "", label: "Unassigned" }, ...props.people.map((item) => ({ value: item.id, label: item.name }))]} />
        {props.kind === "GITHUB_ACCOUNT" && <Select label="Team member" name="subjectMemberId" required options={props.people.map((item) => ({ value: item.id, label: item.name }))} />}
        <label className="field"><span>Due date</span><CalendarInput name="dueAt" type="datetime-local" /></label>
        {props.children}
        <details className="sm:col-span-2 border border-[#2f2f2f] bg-[#111] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#aaa]">
            Add notes, priority, or scope
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select label="Priority" name="priority" options={["NORMAL", "HIGH", "CRITICAL", "LOW"].map((value) => ({ value, label: value }))} />
            {props.seasons?.length ? <Select label="Season" name="seasonId" options={[{ value: "", label: "No season" }, ...props.seasons.map((item) => ({ value: item.id, label: item.name }))]} /> : null}
            {props.projects?.length ? <Select label="Project" name="projectId" options={[{ value: "", label: "No project" }, ...props.projects.map((item) => ({ value: item.id, label: item.name }))]} /> : null}
            {props.subsystems?.length ? <Select label="Subsystem" name="subsystemId" options={[{ value: "", label: "No subsystem" }, ...props.subsystems.map((item) => ({ value: item.id, label: item.name }))]} /> : null}
            <label className="field sm:col-span-2"><span>Notes</span><textarea className="input min-h-20" name="description" /></label>
          </div>
        </details>
        <button className="button w-fit">{props.submit}</button>
      </ActionForm>
    </details>
  );
}

function OptionalRecordDetails({ children }: { children: React.ReactNode }) {
  return (
    <details className="sm:col-span-2 border border-[#2f2f2f] bg-[#111] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#aaa]">
        Add tracking details
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </details>
  );
}

function RecordList({ records, names, completeLabel, completeStatus = "DONE" }: { records: HubRecord[]; names: Map<string, string>; completeLabel: string; completeStatus?: string }) {
  if (!records.length) return <Empty text="No records yet." />;
  return <div className="mt-5 grid gap-3">{records.map((item) => <article className="border border-[#303030] p-4" key={item.id}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="tag">{item.status}</span><span className="tag">{item.priority}</span></div><h3 className="mt-3 font-bold">{item.title}</h3>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#999]">{item.description}</p>}<p className="mt-3 text-xs text-[#666]">{item.ownerMemberId ? `Owner: ${names.get(item.ownerMemberId) || "Team member"}` : "Unassigned"}{item.dueAt ? ` · due ${item.dueAt.toLocaleDateString()}` : ""}</p><RecordData data={item.data} /></div><div className="flex flex-wrap gap-2">{item.status !== completeStatus && <ActionForm action={setHubRecordStatus} successMessage="Status updated."><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value={completeStatus} /><button className="button secondary text-xs">{completeLabel}</button></ActionForm>}<ActionForm action={archiveHubRecord} successMessage="Archived."><input type="hidden" name="id" value={item.id} /><button className="text-xs text-red-300">Archive</button></ActionForm></div></div>
  </article>)}</div>;
}

function RecordData({ data }: { data: Record<string, unknown> }) {
  const hidden = new Set(["originalPrompt"]);
  const values = Object.entries(data).filter(([key, value]) => !hidden.has(key) && value !== "" && value != null && typeof value !== "object");
  if (!values.length) return null;
  return <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{values.map(([key, value]) => <div className="border-l border-[#444] pl-3" key={key}><dt className="text-[#666]">{labelize(key)}</dt><dd className="mt-1 text-[#bbb]">{String(value)}</dd></div>)}</dl>;
}

function InboxItem({ title, meta, href }: { title: string; meta: string; href: string }) { return <Link className="flex items-center justify-between gap-3 border border-[#333] p-4 hover:border-[#fd7803]" href={href}><span><strong>{title}</strong><small className="mt-1 block text-[#777]">{meta}</small></span><span aria-hidden="true">→</span></Link>; }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="card p-5 md:p-7"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#888]">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function Text({ label, name, placeholder, required = false }: { label: string; name: string; placeholder?: string; required?: boolean }) { return <label className="field"><span>{label}</span><input className="input" name={name} placeholder={placeholder} required={required} /></label>; }
function Select({ label, name, options, required = false }: { label: string; name: string; options: { value: string; label: string }[]; required?: boolean }) { return <label className="field"><span>{label}</span><select className="input" name={name} required={required}>{options.map((item) => <option key={`${name}-${item.value}`} value={item.value}>{item.label}</option>)}</select></label>; }
function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) { return <div className="card p-5"><strong className={`font-mono text-3xl ${warn ? "text-amber-400" : "text-[#fd7803]"}`}>{value}</strong><p className="mt-2 text-xs uppercase tracking-wider text-[#777]">{label}</p></div>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="bg-[#141414] p-3"><strong className="font-mono text-lg text-[#fd7803]">{value}</strong><small className="mt-1 block text-[.6rem] uppercase text-[#777]">{label}</small></div>; }
function Empty({ text }: { text: string }) { return <p className="py-7 text-center text-sm text-[#777]">{text}</p>; }
function ofKind(records: HubRecord[], kind: string) { return records.filter((item) => item.kind === kind); }
function labelize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
