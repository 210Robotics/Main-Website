import { Building2, Mail, Search, Sheet, Sparkles } from "lucide-react";
import Link from "next/link";
import type { operationsHubRecords } from "@/db/schema";
import {
  archiveHubRecord,
  logSponsorOutreach,
  promoteSponsorProspect,
  researchSponsorCompanies,
  saveHubRecord,
  syncSponsorMaster,
} from "@/app/admin/control-center/actions";
import { ActionForm } from "@/components/action-form";
import { CalendarInput } from "@/components/calendar-input";

type HubRecord = typeof operationsHubRecords.$inferSelect;
type View = "pipeline" | "analytics" | "prospects" | "templates";
const text = (record: HubRecord, key: string) => String(record.data[key] ?? "");
const bool = (record: HubRecord, key: string) => Boolean(record.data[key]);

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function SponsorWorkspace({
  records,
  view = "pipeline",
}: {
  records: HubRecord[];
  view?: string;
}) {
  const selected: View = [
    "pipeline",
    "analytics",
    "prospects",
    "templates",
  ].includes(view)
    ? (view as View)
    : "pipeline";
  const companies = records.filter(
    (record) => record.kind === "SPONSOR_ENGAGEMENT",
  );
  const prospects = records.filter(
    (record) => record.kind === "SPONSOR_PROSPECT",
  );
  const templates = records.filter(
    (record) => record.kind === "SPONSOR_TEMPLATE",
  );
  const reached = companies.filter(
    (record) => text(record, "lastContactedAt") || record.occurredAt,
  ).length;
  const responses = companies.filter(
    (record) =>
      bool(record, "responseReceived") || /respond/i.test(record.status),
  ).length;
  const bounced = companies.filter(
    (record) => bool(record, "bounced") || /bounce/i.test(record.status),
  ).length;
  const waiting = companies.filter((record) =>
    /wait|pending|sent|no_response/i.test(
      `${record.status} ${text(record, "responseStatus")}`,
    ),
  ).length;
  const tabs: Array<[View, string]> = [
    ["pipeline", "Companies"],
    ["analytics", "Analytics"],
    ["prospects", "Company research"],
    ["templates", "Email templates"],
  ];
  return (
    <div className="grid gap-6">
      <nav
        className="flex gap-2 overflow-x-auto border-b border-[#333] pb-3"
        aria-label="Sponsor tracker sections"
      >
        {tabs.map(([value, label]) => (
          <Link
            className={`min-w-fit border px-4 py-3 text-sm ${selected === value ? "border-[#fd7803] bg-[#fd7803]/10 text-white" : "border-[#333] text-[#999]"}`}
            href={`/admin/control-center?tab=sponsors&view=${value}`}
            key={value}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [companies.length, "Companies"],
          [reached, "Reached out"],
          [waiting, "Waiting"],
          [responses, "Responses"],
          [bounced, "Bounced"],
        ].map(([value, label]) => (
          <div className="border border-[#333] bg-[#0d0d0d] p-4" key={label}>
            <strong className="text-2xl">{value}</strong>
            <p className="mt-1 text-xs uppercase tracking-wider text-[#777]">
              {label}
            </p>
          </div>
        ))}
      </div>

      {selected === "pipeline" && (
        <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
          <div className="grid content-start gap-6">
            <section className="border border-[#333] bg-[#0d0d0d] p-5">
              <p className="eyebrow">Google Drive master</p>
              <h2 className="mt-3 text-xl font-bold">Workbook sync</h2>
              <p className="mt-2 text-sm leading-6 text-[#888]">
                Imports the Organization Master, Email Log, Applications, and
                Responses & Outcomes tabs while preserving edits made here.
              </p>
              <ActionForm
                action={syncSponsorMaster}
                successMessage="All sponsor workbook tabs synced."
                className="mt-5 grid gap-3"
              >
                <a
                  className="button secondary"
                  href="https://docs.google.com/spreadsheets/d/19wJQVwm0WEGP6r5Gqf8rMm7f8iRPO5wgChOammI9TbY"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Sheet className="size-4" /> Open master workbook
                </a>
                <button className="button">
                  <Sparkles className="size-4" /> Sync all tracker tabs
                </button>
              </ActionForm>
            </section>
            <section className="border border-[#333] bg-[#0d0d0d] p-5">
              <p className="eyebrow">New company</p>
              <h2 className="mt-3 text-xl font-bold">Add to pipeline</h2>
              <SponsorCompanyForm />
            </section>
          </div>
          <section className="border border-[#333] bg-[#0d0d0d] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Sponsor pipeline</p>
                <h2 className="mt-3 text-2xl font-bold">
                  Companies and outreach
                </h2>
              </div>
              <span className="tag">{companies.length} tracked</span>
            </div>
            <div className="mt-5 divide-y divide-[#2d2d2d]">
              {companies.map((record) => (
                <SponsorCompany key={record.id} record={record} />
              ))}
              {!companies.length && (
                <p className="py-10 text-sm text-[#777]">
                  Add a company or sync the sponsor workbook to begin.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {selected === "analytics" && (
        <SponsorAnalytics
          records={companies}
          reached={reached}
          responses={responses}
          bounced={bounced}
        />
      )}

      {selected === "prospects" && (
        <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
          <section className="border border-[#333] bg-[#0d0d0d] p-5">
            <p className="eyebrow">Public company research</p>
            <h2 className="mt-3 text-2xl font-bold">Generate a contact list</h2>
            <p className="mt-3 text-sm leading-6 text-[#888]">
              Researches public company websites only. It collects published
              business emails, phone numbers, and source pages—never private
              accounts or login-only data.
            </p>
            <ActionForm
              action={researchSponsorCompanies}
              successMessage="Company research saved below."
              className="mt-5 grid gap-4"
            >
              <Field label="Company names (one per line, up to 10)">
                <textarea
                  className="input min-h-36"
                  name="companies"
                  required
                />
              </Field>
              <Field label="Official website (optional for one company)">
                <input
                  className="input"
                  name="website"
                  type="url"
                  placeholder="https://company.com"
                />
              </Field>
              <button className="button w-fit">
                <Search className="size-4" /> Find public contacts
              </button>
            </ActionForm>
          </section>
          <section className="border border-[#333] bg-[#0d0d0d] p-5">
            <p className="eyebrow">Research results</p>
            <h2 className="mt-3 text-2xl font-bold">Sponsor prospects</h2>
            <div className="mt-5 divide-y divide-[#2d2d2d]">
              {prospects.map((record) => (
                <article className="py-5" key={record.id}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{record.title}</h3>
                      <p className="mt-1 text-xs text-[#777]">
                        {text(record, "website")}
                      </p>
                    </div>
                    <span className="tag">{record.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-[#bbb]">
                    <strong>Emails:</strong>{" "}
                    {text(record, "contactEmails") || "None published"}
                  </p>
                  <p className="mt-2 text-sm text-[#bbb]">
                    <strong>Phones:</strong>{" "}
                    {text(record, "contactPhones") || "None published"}
                  </p>
                  <ActionForm
                    action={promoteSponsorProspect}
                    successMessage="Prospect added to the pipeline."
                    className="mt-4 flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="id" value={record.id} />
                    <button className="button secondary">
                      Add to pipeline
                    </button>
                  </ActionForm>
                </article>
              ))}
              {!prospects.length && (
                <p className="py-10 text-sm text-[#777]">
                  Research results will appear here.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {selected === "templates" && (
        <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
          <section className="border border-[#333] bg-[#0d0d0d] p-5">
            <p className="eyebrow">Template library</p>
            <h2 className="mt-3 text-2xl font-bold">Create email template</h2>
            <SponsorTemplateForm />
          </section>
          <section className="border border-[#333] bg-[#0d0d0d] p-5">
            <p className="eyebrow">Ready to use</p>
            <h2 className="mt-3 text-2xl font-bold">Sponsor email templates</h2>
            <div className="mt-5 divide-y divide-[#2d2d2d]">
              {templates.map((record) => (
                <details className="py-5" key={record.id}>
                  <summary className="cursor-pointer font-bold">
                    {record.title}{" "}
                    <span className="tag ml-2">
                      {text(record, "emailStage") || record.status}
                    </span>
                  </summary>
                  <p className="mt-4 text-sm">
                    <strong>Subject:</strong> {text(record, "emailSubject")}
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap border border-[#333] bg-black/30 p-4 text-sm leading-6 text-[#bbb]">
                    {text(record, "emailBody")}
                  </pre>
                  <SponsorTemplateForm record={record} />
                </details>
              ))}
              {!templates.length && (
                <p className="py-10 text-sm text-[#777]">
                  No sponsor email templates yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SponsorCompanyForm({ record }: { record?: HubRecord }) {
  return (
    <ActionForm
      action={saveHubRecord}
      successMessage="Sponsor company saved."
      className="mt-5 grid gap-4"
    >
      <input type="hidden" name="kind" value="SPONSOR_ENGAGEMENT" />
      {record && <input type="hidden" name="id" value={record.id} />}
      <Field label="Company">
        <input
          className="input"
          name="title"
          defaultValue={record?.title}
          required
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website">
          <input
            className="input"
            name="website"
            type="url"
            defaultValue={record ? text(record, "website") : ""}
          />
        </Field>
        <Field label="Industry">
          <input
            className="input"
            name="industry"
            defaultValue={record ? text(record, "industry") : ""}
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contact name">
          <input
            className="input"
            name="contactName"
            defaultValue={record ? text(record, "contactName") : ""}
          />
        </Field>
        <Field label="Contact role">
          <input
            className="input"
            name="contactRole"
            defaultValue={record ? text(record, "contactRole") : ""}
          />
        </Field>
      </div>
      <Field label="Email address(es)">
        <input
          className="input"
          name="contactEmails"
          defaultValue={record ? text(record, "contactEmails") : ""}
        />
      </Field>
      <Field label="Phone number(s)">
        <input
          className="input"
          name="contactPhones"
          defaultValue={record ? text(record, "contactPhones") : ""}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Pipeline status">
          <select
            className="input"
            name="status"
            defaultValue={record?.status || "NEW"}
          >
            {[
              "NEW",
              "READY",
              "CONTACTED",
              "WAITING",
              "RESPONDED",
              "UNDER_REVIEW",
              "COMMITTED",
              "DECLINED",
              "BOUNCED",
              "CLOSED",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Response">
          <select
            className="input"
            name="responseStatus"
            defaultValue={
              record ? text(record, "responseStatus") : "NO_RESPONSE"
            }
          >
            {[
              "NO_RESPONSE",
              "RESPONDED",
              "BOUNCED",
              "DECLINED",
              "INTERESTED",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Next action">
        <input
          className="input"
          name="nextAction"
          defaultValue={record ? text(record, "nextAction") : ""}
        />
      </Field>
      <Field label="Next follow-up">
        <CalendarInput
          name="dueAt"
          type="datetime-local"
          defaultValue={record?.dueAt?.toISOString().slice(0, 16) || ""}
        />
      </Field>
      <Field label="Notes">
        <textarea
          className="input min-h-24"
          name="description"
          defaultValue={record?.description}
        />
      </Field>
      <button className="button w-fit">
        <Building2 className="size-4" />{" "}
        {record ? "Save company" : "Add company"}
      </button>
    </ActionForm>
  );
}

function SponsorCompany({ record }: { record: HubRecord }) {
  const history = Array.isArray(record.data.history)
    ? (record.data.history as Record<string, unknown>[])
    : [];
  return (
    <details className="py-5">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{record.title}</h3>
            <p className="mt-1 text-xs text-[#777]">
              {text(record, "contactEmails") || "No email saved"}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="tag">{record.status}</span>
            {bool(record, "bounced") && (
              <span className="tag !text-red-300">Bounced</span>
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-[#888] sm:grid-cols-3">
          <span>
            Last contact:{" "}
            {text(record, "lastContactedAt") ||
              record.occurredAt?.toLocaleDateString() ||
              "Never"}
          </span>
          <span>
            Response: {text(record, "responseStatus") || "Not recorded"}
          </span>
          <span>Next: {text(record, "nextAction") || "Not set"}</span>
        </div>
      </summary>
      <div className="mt-5 grid gap-5 border-t border-[#292929] pt-5 xl:grid-cols-2">
        <div>
          <h4 className="font-bold">Edit company</h4>
          <SponsorCompanyForm record={record} />
        </div>
        <div>
          <h4 className="font-bold">Log outreach or response</h4>
          <ActionForm
            action={logSponsorOutreach}
            successMessage="Outreach added to company history."
            className="mt-5 grid gap-4"
          >
            <input type="hidden" name="id" value={record.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date">
                <CalendarInput name="contactedAt" type="datetime-local" />
              </Field>
              <Field label="Channel">
                <select className="input" name="channel">
                  <option>EMAIL</option>
                  <option>PHONE</option>
                  <option>MEETING</option>
                  <option>APPLICATION</option>
                  <option>SOCIAL</option>
                </select>
              </Field>
            </div>
            <Field label="Recipient">
              <input
                className="input"
                name="recipient"
                defaultValue={text(record, "contactEmails")}
              />
            </Field>
            <Field label="Subject">
              <input className="input" name="subject" />
            </Field>
            <Field label="Outcome">
              <select className="input" name="outcome">
                <option>NO_RESPONSE</option>
                <option>RESPONDED</option>
                <option>BOUNCED</option>
                <option>DECLINED</option>
                <option>INTERESTED</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea className="input min-h-20" name="notes" />
            </Field>
            <button className="button w-fit">
              <Mail className="size-4" /> Log activity
            </button>
          </ActionForm>
          {history.length > 0 && (
            <div className="mt-6">
              <h4 className="font-bold">Activity history</h4>
              <div className="mt-3 max-h-64 divide-y divide-[#292929] overflow-y-auto">
                {history.map((item, index) => (
                  <div
                    className="py-3 text-xs text-[#aaa]"
                    key={String(item.id || index)}
                  >
                    <strong>{String(item.outcome || "Activity")}</strong> ·{" "}
                    {new Date(String(item.contactedAt)).toLocaleString()}
                    <p className="mt-1 text-[#777]">
                      {String(item.subject || item.notes || "")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <ActionForm
        action={archiveHubRecord}
        successMessage="Company archived."
        className="mt-5"
      >
        <input type="hidden" name="id" value={record.id} />
        <button className="text-xs text-red-300">Archive company</button>
      </ActionForm>
    </details>
  );
}

function SponsorAnalytics({
  records,
  reached,
  responses,
  bounced,
}: {
  records: HubRecord[];
  reached: number;
  responses: number;
  bounced: number;
}) {
  const statuses = [...new Set(records.map((record) => record.status))].sort();
  const rate = (part: number, total: number) =>
    total ? Math.round((part / total) * 100) : 0;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="border border-[#333] bg-[#0d0d0d] p-6">
        <p className="eyebrow">Performance</p>
        <h2 className="mt-3 text-2xl font-bold">Outreach analytics</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            [rate(reached, records.length), "Coverage"],
            [rate(responses, reached), "Response rate"],
            [rate(bounced, reached), "Bounce rate"],
          ].map(([value, label]) => (
            <div className="border border-[#333] p-5 text-center" key={label}>
              <strong className="text-3xl">{value}%</strong>
              <p className="mt-2 text-xs uppercase tracking-wider text-[#777]">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="border border-[#333] bg-[#0d0d0d] p-6">
        <p className="eyebrow">Pipeline</p>
        <h2 className="mt-3 text-2xl font-bold">Companies by status</h2>
        <div className="mt-6 grid gap-4">
          {statuses.map((status) => {
            const count = records.filter(
              (record) => record.status === status,
            ).length;
            return (
              <div key={status}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{status}</span>
                  <strong>{count}</strong>
                </div>
                <div className="h-2 bg-[#222]">
                  <div
                    className="h-full bg-[#fd7803]"
                    style={{ width: `${rate(count, records.length)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SponsorTemplateForm({ record }: { record?: HubRecord }) {
  return (
    <ActionForm
      action={saveHubRecord}
      successMessage="Email template saved."
      className="mt-5 grid gap-4"
    >
      <input type="hidden" name="kind" value="SPONSOR_TEMPLATE" />
      {record && <input type="hidden" name="id" value={record.id} />}
      <Field label="Template name">
        <input
          className="input"
          name="title"
          defaultValue={record?.title}
          required
        />
      </Field>
      <Field label="Stage">
        <select
          className="input"
          name="emailStage"
          defaultValue={record ? text(record, "emailStage") : "INTRODUCTION"}
        >
          <option>INTRODUCTION</option>
          <option>FOLLOW_UP</option>
          <option>THANK_YOU</option>
          <option>RENEWAL</option>
          <option>DELIVERABLE</option>
        </select>
      </Field>
      <Field label="Email subject">
        <input
          className="input"
          name="emailSubject"
          defaultValue={record ? text(record, "emailSubject") : ""}
          required
        />
      </Field>
      <Field label="Email body">
        <textarea
          className="input min-h-64"
          name="emailBody"
          defaultValue={record ? text(record, "emailBody") : ""}
          required
        />
      </Field>
      <button className="button w-fit">
        <Mail className="size-4" /> Save template
      </button>
    </ActionForm>
  );
}
