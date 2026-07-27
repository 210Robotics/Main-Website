import { and, desc, eq, isNull, or } from "drizzle-orm";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { getDb } from "@/db";
import {
  auditEvents,
  contributions,
  designChanges,
  engineeringNotebookEntries,
  hourEntries,
  memberTasks,
  operationsHubRecords,
} from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORANGE = "FD7803";
const DARK = "111111";
const GRAY = "666666";

export async function GET(request: Request) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (member.status !== "ACTIVE") return Response.json({ error: "Active membership required." }, { status: 403 });
  const format = new URL(request.url).searchParams.get("format") === "resume" ? "resume" : "portfolio";
  const db = getDb();
  const [work, tasks, notebook, changes, hours, recognition, github] = await Promise.all([
    db.select().from(contributions).where(and(eq(contributions.memberId, member.id), isNull(contributions.deletedAt))).orderBy(desc(contributions.contributionDate)),
    db.select().from(memberTasks).where(and(eq(memberTasks.assignedToMemberId, member.id), eq(memberTasks.status, "DONE"))).orderBy(desc(memberTasks.completedAt)),
    db.select().from(engineeringNotebookEntries).where(or(eq(engineeringNotebookEntries.createdByMemberId, member.id), eq(engineeringNotebookEntries.updatedByMemberId, member.id))).orderBy(desc(engineeringNotebookEntries.entryDate)),
    db.select().from(designChanges).where(eq(designChanges.requestedByMemberId, member.id)).orderBy(desc(designChanges.createdAt)),
    db.select().from(hourEntries).where(and(eq(hourEntries.memberId, member.id), isNull(hourEntries.deletedAt))).orderBy(desc(hourEntries.workDate)),
    db.select().from(operationsHubRecords).where(and(eq(operationsHubRecords.kind, "RECOGNITION"), eq(operationsHubRecords.subjectMemberId, member.id), isNull(operationsHubRecords.archivedAt))),
    db.select().from(operationsHubRecords).where(and(eq(operationsHubRecords.kind, "GITHUB_ACCOUNT"), eq(operationsHubRecords.subjectMemberId, member.id), isNull(operationsHubRecords.archivedAt))),
  ]);
  const totalHours = Math.round(hours.reduce((sum, item) => sum + item.minutes, 0) / 60);
  const children = format === "resume"
    ? resumeSections({ member, work, tasks, notebook, changes, recognition, github, totalHours })
    : portfolioSections({ member, work, tasks, notebook, changes, recognition, github, totalHours });
  const document = new Document({
    creator: "210 Robotics",
    title: `${member.displayName} · ${format === "resume" ? "Résumé" : "Contribution Portfolio"}`,
    description: "Verified member work exported from the 210 Robotics member portal",
    styles: { default: { document: { run: { font: "Aptos", size: 21, color: DARK }, paragraph: { spacing: { after: 120 } } } }, paragraphStyles: [{ id: "Title210", name: "210 Title", basedOn: "Normal", next: "Normal", run: { font: "Aptos Display", size: 46, bold: true, color: DARK }, paragraph: { spacing: { after: 100 } } }] },
    sections: [{
      properties: { page: { margin: { top: 720, right: 760, bottom: 720, left: 760 } } },
      headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE, space: 5 } }, children: [new TextRun({ text: "210 ROBOTICS", bold: true, color: ORANGE, size: 18 }), new TextRun({ text: `   ·   VERIFIED MEMBER ${format.toUpperCase()}`, color: GRAY, size: 16 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "210ROBOTICS.COM   ·   ", color: GRAY, size: 15 }), new TextRun({ children: ["PAGE ", PageNumber.CURRENT], color: GRAY, size: 15 })] })] }) },
      children,
    }],
  });
  const buffer = await Packer.toBuffer(document);
  const safeName = member.displayName.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "Member";
  const filename = `210-Robotics-${safeName}-${format === "resume" ? "Resume" : "Portfolio"}.docx`;
  await db.insert(auditEvents).values({ actorMemberId: member.id, action: `member.${format}_exported`, entityType: "member", entityId: member.id, details: { filename, work: work.length, tasks: tasks.length, notebook: notebook.length } });
  return new Response(new Uint8Array(buffer), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}

type ExportData = {
  member: {
    displayName: string;
    organizationRole: string;
    email: string;
    bio: string;
  };
  work: (typeof contributions.$inferSelect)[];
  tasks: (typeof memberTasks.$inferSelect)[];
  notebook: (typeof engineeringNotebookEntries.$inferSelect)[];
  changes: (typeof designChanges.$inferSelect)[];
  recognition: (typeof operationsHubRecords.$inferSelect)[];
  github: (typeof operationsHubRecords.$inferSelect)[];
  totalHours: number;
};

function resumeSections(data: ExportData): (Paragraph | Table)[] {
  const githubName = data.github
    .map((item) => String(item.data.githubUsername || ""))
    .filter(Boolean)
    .join(", ");
  return [
    title(data.member.displayName),
    new Paragraph({ children: [new TextRun({ text: `${data.member.organizationRole} · 210 Robotics`, bold: true, color: ORANGE, size: 23 })] }),
    new Paragraph({ children: [new TextRun({ text: data.member.email, color: GRAY }), ...(githubName ? [new TextRun({ text: `  ·  GitHub: ${githubName}`, color: GRAY })] : [])] }),
    ...(data.member.bio ? [body(data.member.bio)] : []),
    heading("Verified experience"),
    summaryTable([["Documented hours", String(data.totalHours)], ["Completed assignments", String(data.tasks.length)], ["Notebook entries", String(data.notebook.length)], ["Design changes", String(data.changes.length)]]),
    heading("Selected contributions"),
    ...entries(data.work.slice(0, 8).map((item) => ({ title: item.title, meta: `${item.project} · ${date(item.contributionDate)}`, text: item.description }))),
    heading("Engineering and leadership work"),
    ...entries([...data.tasks.slice(0, 6).map((item) => ({ title: item.title, meta: `${item.project} · completed ${date(item.completedAt)}`, text: item.description })), ...data.notebook.slice(0, 4).map((item) => ({ title: item.title, meta: `Engineering notebook · ${date(item.entryDate)}`, text: item.objective || item.results }))]),
    ...(data.recognition.length ? [heading("Recognition and certifications"), ...entries(data.recognition.map((item) => ({ title: item.title, meta: String(item.data.category || "Recognition"), text: item.description })))] : []),
  ];
}

function portfolioSections(data: ExportData): (Paragraph | Table)[] {
  return [
    title(data.member.displayName),
    new Paragraph({ children: [new TextRun({ text: "CONTRIBUTION PORTFOLIO", bold: true, color: ORANGE, size: 22 })] }),
    body(`${data.member.organizationRole} · ${data.totalHours} documented hours · ${data.tasks.length} completed assignments · ${data.notebook.length} notebook entries`),
    ...(data.member.bio ? [body(data.member.bio)] : []),
    heading("Verified contributions"),
    ...entries(data.work.map((item) => ({ title: item.title, meta: `${item.category} · ${item.project} · ${date(item.contributionDate)}`, text: item.description, link: item.evidenceUrl }))),
    heading("Completed team assignments"),
    ...entries(data.tasks.map((item) => ({ title: item.title, meta: `${item.project} · ${date(item.completedAt)}`, text: item.description || item.approvalNote }))),
    heading("Engineering notebook work"),
    ...entries(data.notebook.map((item) => ({ title: item.title, meta: `${item.entryType} · ${item.status} · ${date(item.entryDate)}`, text: [item.objective, item.decisions, item.results].filter(Boolean).join(" ") }))),
    heading("Design-change control"),
    ...entries(data.changes.map((item) => ({ title: `${item.changeNumber} · ${item.title}`, meta: `${item.status} · risk ${item.risk}`, text: `${item.reason} ${item.impact}` }))),
    ...(data.recognition.length ? [heading("Recognition"), ...entries(data.recognition.map((item) => ({ title: item.title, meta: String(item.data.category || "Recognition"), text: item.description })))] : []),
  ];
}

function title(text: string) { return new Paragraph({ style: "Title210", children: [new TextRun({ text })] }); }
function heading(text: string) { return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ORANGE, space: 5 } }, children: [new TextRun({ text, bold: true, color: DARK, size: 28 })] }); }
function body(text: string) { return new Paragraph({ spacing: { after: 150, line: 300 }, children: [new TextRun({ text, color: DARK, size: 20 })] }); }
function entries(items: { title: string; meta: string; text?: string; link?: string | null }[]) { return items.length ? items.flatMap((item) => [new Paragraph({ spacing: { before: 140, after: 30 }, children: [new TextRun({ text: item.title, bold: true, color: DARK, size: 21 })] }), new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: item.meta, bold: true, color: ORANGE, size: 16 })] }), body(`${item.text || "Verified contribution."}${item.link ? ` Evidence: ${item.link}` : ""}`)]) : [body("No verified records in this section yet.")]; }
function summaryTable(rows: [string, string][]) { return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(([label, value]) => new TableRow({ children: [new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })] }), new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: value, bold: true, color: ORANGE, size: 24 })] })] })] })) }); }
function date(value: Date | null | undefined) { return value ? value.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Date not recorded"; }
