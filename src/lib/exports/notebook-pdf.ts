import "server-only";

import path from "node:path";
import PDFDocument from "pdfkit";
import sanitizeHtml from "sanitize-html";
import type {
  designChanges,
  engineeringNotebookEntries,
  engineeringParts,
  engineeringProjects,
  engineeringSeasons,
  engineeringSubsystems,
  financeEntries,
  financePlans,
  financeSponsorCommitments,
  hourEntries,
  inventoryItems,
  manufacturingSteps,
  meetingDecisions,
  meetingNotes,
  memberTasks,
  purchaseRequests,
  scoutingMatches,
} from "@/db/schema";
import { centsToMoney, summarizeBudget } from "@/lib/operations";

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];

export type NotebookPdfInput = {
  season: Row<typeof engineeringSeasons>;
  project?: Row<typeof engineeringProjects> | null;
  projects: Row<typeof engineeringProjects>[];
  subsystems: Row<typeof engineeringSubsystems>[];
  entries: Row<typeof engineeringNotebookEntries>[];
  parts: Row<typeof engineeringParts>[];
  steps: Row<typeof manufacturingSteps>[];
  inventory: Row<typeof inventoryItems>[];
  purchases: Row<typeof purchaseRequests>[];
  changes: Row<typeof designChanges>[];
  financePlans: Row<typeof financePlans>[];
  financeEntries: Row<typeof financeEntries>[];
  sponsors: Row<typeof financeSponsorCommitments>[];
  meetings: Row<typeof meetingNotes>[];
  decisions: Row<typeof meetingDecisions>[];
  tasks: Row<typeof memberTasks>[];
  hours: Row<typeof hourEntries>[];
  scouting: Row<typeof scoutingMatches>[];
  names: Map<string, string>;
  options: {
    includeEngineering: boolean;
    includeTesting: boolean;
    includeLogistics: boolean;
    includeChanges: boolean;
    includeFinance: boolean;
    includeOperations: boolean;
    includeScouting: boolean;
  };
};

const orange = "#FD7803";
const ink = "#171717";
const gray = "#666666";
const light = "#F3F3F3";

export function notebookHtmlToText(html: string) {
  const withBreaks = html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function buildEngineeringNotebookPdf(input: NotebookPdfInput) {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 62, right: 48, bottom: 58, left: 48 },
    bufferPages: true,
    info: {
      Title: `210 Robotics Engineering Notebook - ${input.season.name}`,
      Author: "210 Robotics",
      Subject: `${input.season.competition} ${input.season.gameName}`,
      Keywords: "210 Robotics, engineering notebook, VEX U",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  function header() {
    doc
      .save()
      .rect(0, 0, doc.page.width, 34)
      .fill(ink)
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("210 ROBOTICS", 48, 12, { continued: true })
      .fillColor(orange)
      .text("  ENGINEERING NOTEBOOK")
      .restore();
    doc.y = 58;
  }

  doc.on("pageAdded", header);

  doc.rect(0, 0, doc.page.width, doc.page.height).fill(ink);
  const bannerPath = path.join(process.cwd(), "public", "media", "brand", "210-banner.png");
  try {
    doc.image(bannerPath, 0, 0, { width: doc.page.width, height: 210, cover: [doc.page.width, 210] });
    doc.rect(0, 0, doc.page.width, 210).fillColor("#000000", 0.46).fill();
  } catch {
    doc.rect(0, 0, doc.page.width, 210).fill(orange);
  }
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(44)
    .text("ENGINEERING", 48, 255)
    .fillColor(orange)
    .text("NOTEBOOK")
    .moveDown(0.6)
    .fillColor("#FFFFFF")
    .fontSize(18)
    .text(input.season.name)
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#CFCFCF")
    .text(`${input.season.competition} ${input.season.gameName}`)
    .text(`Game Manual Version ${input.season.gameManualVersion}`)
    .text(input.project ? `${input.project.code} | ${input.project.name}` : "Full season record")
    .moveDown(2)
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .text("210 ROBOTICS | THE UNIVERSITY OF TEXAS AT SAN ANTONIO")
    .font("Helvetica")
    .fillColor("#AFAFAF")
    .text(`Compiled ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT`);

  function addPage() {
    doc.addPage();
  }
  function ensureSpace(height: number) {
    if (doc.y + height > doc.page.height - 62) addPage();
  }
  function section(title: string, subtitle?: string) {
    addPage();
    doc.fillColor(orange).font("Helvetica-Bold").fontSize(11).text("210 ROBOTICS");
    doc.fillColor(ink).fontSize(25).text(title);
    if (subtitle)
      doc.fillColor(gray).font("Helvetica").fontSize(10).text(subtitle, { lineGap: 2 });
    doc.moveDown(0.8).strokeColor(orange).lineWidth(2).moveTo(48, doc.y).lineTo(564, doc.y).stroke().moveDown(0.8);
  }
  function heading(title: string) {
    ensureSpace(45);
    doc.moveDown(0.5).fillColor(ink).font("Helvetica-Bold").fontSize(15).text(title).moveDown(0.35);
  }
  function paragraph(text: string) {
    if (!text) return;
    ensureSpace(40);
    doc.fillColor("#333333").font("Helvetica").fontSize(9.5).text(text, { lineGap: 3 }).moveDown(0.7);
  }
  function keyValue(label: string, value: string) {
    ensureSpace(24);
    doc.font("Helvetica-Bold").fillColor(ink).fontSize(9).text(`${label}: `, { continued: true }).font("Helvetica").fillColor(gray).text(value || "Not recorded");
  }
  function table(headers: string[], rows: (string | number)[][], widths: number[]) {
    const startX = 48;
    const rowHeight = 24;
    ensureSpace(rowHeight * 2);
    const headerY = doc.y;
    let x = startX;
    headers.forEach((headerValue, index) => {
      doc.rect(x, headerY, widths[index], rowHeight).fill(ink);
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(7).text(headerValue, x + 5, headerY + 8, { width: widths[index] - 10, height: 9, ellipsis: true, lineBreak: false });
      x += widths[index];
    });
    doc.x = startX;
    doc.y = headerY + rowHeight;
    rows.forEach((row, rowIndex) => {
      ensureSpace(rowHeight + 2);
      x = startX;
      const y = doc.y;
      row.forEach((value, index) => {
        doc.rect(x, y, widths[index], rowHeight).fill(rowIndex % 2 ? "#FFFFFF" : light).stroke("#D9D9D9");
        doc.fillColor(ink).font("Helvetica").fontSize(7).text(String(value), x + 5, y + 7, { width: widths[index] - 10, height: 12, ellipsis: true });
        x += widths[index];
      });
      doc.x = startX;
      doc.y = y + rowHeight;
    });
    doc.x = startX;
    doc.moveDown(0.7);
  }

  section("Notebook plan", "Scope, structure, and documentation coverage");
  keyValue("Season", input.season.name);
  keyValue("Competition", `${input.season.competition} ${input.season.gameName}`);
  keyValue("Project", input.project ? `${input.project.code} | ${input.project.name}` : "All projects");
  keyValue("Coverage", `${input.entries.length} notebook entries, ${input.projects.length} projects, ${input.subsystems.length} subsystems`);
  heading("Project structure");
  table(
    ["Project", "Status", "Subsystems", "Description"],
    input.projects.map((project) => [
      `${project.code} | ${project.name}`,
      project.status,
      input.subsystems.filter((subsystem) => subsystem.projectId === project.id).map((subsystem) => subsystem.code).join(", ") || "-",
      project.description || "-",
    ]),
    [130, 70, 100, 216],
  );

  section("Engineering notebook entries", "Version-controlled design, build, test, and decision record");
  if (!input.entries.length) paragraph("No notebook entries matched this compilation scope.");
  for (const entry of input.entries) {
    ensureSpace(130);
    doc.fillColor(orange).font("Helvetica-Bold").fontSize(9).text(`${entry.entryDate.toLocaleDateString()} | ${entry.entryType} | ${entry.status} | v${entry.currentVersion}`);
    doc.fillColor(ink).fontSize(18).text(entry.title).moveDown(0.25);
    keyValue("Author / last editor", input.names.get(entry.updatedByMemberId || entry.createdByMemberId || "") || "Former member");
    keyValue("Tags", entry.tags.join(", ") || "None");
    const contentPages = entry.contentHtml.split(
      /<hr[^>]*data-page-break=["']true["'][^>]*>/gi,
    );
    contentPages.forEach((contentPage, pageIndex) => {
      paragraph(notebookHtmlToText(contentPage));
      if (pageIndex < contentPages.length - 1) {
        addPage();
        doc
          .fillColor(orange)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(`${entry.entryType} | PAGE ${pageIndex + 2} | CONTINUED`);
        doc.fillColor(ink).fontSize(15).text(entry.title).moveDown(0.5);
      }
    });
    if (entry.objective) keyValue("Objective", entry.objective);
    if (entry.decisions) keyValue("Decisions", entry.decisions);
    if (entry.results) keyValue("Results", entry.results);
    if (entry.nextSteps) keyValue("Next steps", entry.nextSteps);
    doc.moveDown(0.8).strokeColor("#D8D8D8").lineWidth(0.5).moveTo(48, doc.y).lineTo(564, doc.y).stroke().moveDown(0.8);
  }

  if (input.options.includeEngineering) {
    section("BOM and manufacturing", "Live master parts and manufacturing readiness");
    table(
      ["Part", "Name", "Subsystem", "Qty", "Make/Buy", "Revision", "Lifecycle", "Verification"],
      input.parts.map((part) => [part.partNumber, part.name, part.subsystem, part.quantity, part.makeBuy, part.revision, part.lifecycleStatus, part.verificationStatus]),
      [65, 105, 75, 35, 55, 45, 65, 71],
    );
    heading("Manufacturing operations");
    table(
      ["Part", "Seq", "Process", "Machine", "Status", "Inspection"],
      input.steps.map((step) => [input.parts.find((part) => part.id === step.partId)?.partNumber || "-", step.sequence, step.process, step.machine || "-", step.status, step.inspectionCriteria || "-"]),
      [65, 35, 110, 85, 75, 146],
    );
  }

  if (input.options.includeTesting) {
    section("Testing and verification", "Verification status, evidence, and unresolved review work");
    const testParts = input.parts.filter((part) => part.verificationStatus !== "NOT_REQUIRED" || part.caeStatus !== "NOT_REQUIRED");
    table(
      ["Part", "CAD", "CAM", "CAE", "Drawing", "Verification", "Notes"],
      testParts.map((part) => [part.partNumber, part.cadStatus, part.camStatus, part.caeStatus, part.drawingStatus, part.verificationStatus, part.notes || "-"]),
      [65, 60, 60, 60, 65, 80, 126],
    );
  }

  if (input.options.includeLogistics) {
    section("Inventory and purchasing", "Available stock, reorder exposure, and procurement status");
    table(
      ["SKU", "Item", "Category", "Location", "On hand", "Reserved", "Reorder", "Value"],
      input.inventory.map((item) => [item.sku, item.name, item.category, item.location, item.quantityOnHand, item.quantityReserved, item.reorderPoint, centsToMoney(item.quantityOnHand * item.unitCostCents)]),
      [60, 105, 85, 65, 45, 45, 45, 66],
    );
    heading("Purchase requests");
    table(
      ["Item", "Category", "Qty", "Vendor", "Status", "Priority", "Estimated"],
      input.purchases.map((request) => [request.item, request.category, request.quantity, request.vendor || "TBD", request.status, request.priority, centsToMoney(request.quantity * request.estimatedUnitCostCents)]),
      [125, 95, 35, 80, 70, 55, 56],
    );
  }

  if (input.options.includeChanges) {
    section("Design-change control", "Controlled revision decisions and verification evidence");
    for (const change of input.changes) {
      heading(`${change.changeNumber} | ${change.title}`);
      keyValue("Status / risk", `${change.status} / ${change.risk}`);
      keyValue("Revision", `${change.revisionFrom || "-"} -> ${change.revisionTo || "-"}`);
      keyValue("Cost / schedule", `${centsToMoney(change.costImpactCents)} / ${change.scheduleImpactDays} days`);
      keyValue("Reason", change.reason);
      paragraph(change.description);
      keyValue("Impact", change.impact);
      keyValue("Verification plan", change.verificationPlan);
      keyValue("Verification results", change.verificationResults);
    }
  }

  if (input.options.includeFinance) {
    section("Finance", "Budget scenarios, expenses, income, and sponsor support");
    for (const plan of input.financePlans) {
      const planEntries = input.financeEntries.filter((entry) => entry.planId === plan.id);
      const planSponsors = input.sponsors.filter((sponsor) => sponsor.planId === plan.id);
      const totals = summarizeBudget(planEntries, planSponsors);
      heading(`${plan.name} | FY ${plan.fiscalYear}`);
      keyValue("Budget range", `${centsToMoney(plan.minimumBudgetCents)} - ${centsToMoney(plan.maximumBudgetCents)}`);
      keyValue("Planned / expenses", `${centsToMoney(totals.planned)} / ${centsToMoney(totals.expenses)}`);
      keyValue("Income + sponsors / available", `${centsToMoney(totals.totalFunding)} / ${centsToMoney(totals.availableCash)}`);
      table(
        ["Type", "Category", "Item", "Qty", "Amount", "Status"],
        planEntries.map((entry) => [entry.kind, entry.category, entry.description, entry.quantity, centsToMoney(entry.amountCents), entry.status]),
        [60, 100, 170, 35, 75, 76],
      );
    }
  }

  if (input.options.includeOperations) {
    section("Project operations", "Meetings, decisions, assignments, and documented work");
    heading("Meetings and decisions");
    for (const meeting of input.meetings) {
      ensureSpace(60);
      doc.font("Helvetica-Bold").fillColor(ink).fontSize(11).text(`${meeting.heldAt.toLocaleDateString()} | ${meeting.title}`);
      paragraph(meeting.summary || meeting.discussion);
      const meetingDecisions = input.decisions.filter((decision) => decision.meetingId === meeting.id);
      meetingDecisions.forEach((decision) => keyValue("Decision", decision.decision));
    }
    heading("Assignments");
    table(
      ["Task", "Owner", "Priority", "Status", "Due", "Approval"],
      input.tasks.map((task) => [task.title, input.names.get(task.assignedToMemberId) || "Former member", task.priority, task.status, task.dueAt?.toLocaleDateString() || "-", task.approvedAt ? "Approved" : task.status === "IN_REVIEW" ? "Pending" : "-"]),
      [165, 95, 55, 75, 65, 61],
    );
    const totalMinutes = input.hours.reduce((sum, entry) => sum + entry.minutes, 0);
    heading("Documented engineering work");
    keyValue("Total recorded hours", (totalMinutes / 60).toFixed(1));
    table(
      ["Date", "Member", "Project", "Category", "Hours", "Description"],
      input.hours.slice(0, 100).map((entry) => [entry.workDate.toLocaleDateString(), input.names.get(entry.memberId) || "Former member", entry.project, entry.category, (entry.minutes / 60).toFixed(1), entry.description]),
      [65, 85, 75, 70, 45, 176],
    );
  }

  if (input.options.includeScouting) {
    section("VEX U Override scouting", "Observed scoring patterns and match performance");
    paragraph("Override v1.0 scouting tracks the VEX U 30-second autonomous period, 12-Pin / four-Goal AWP criteria, Loader throughput, 5-point alliance-color Pins, 10-point owned yellow Pins, Toggles, two-Robot Midfield control, cycle performance, and reliability.");
    table(
      ["Event / match", "Team", "Score", "Auto Pins", "Pins", "Yellow", "Toggles", "Midfield", "AWP", "Reliability"],
      input.scouting.map((record) => [`${record.eventName} ${record.matchNumber}`, record.observedTeam, record.score, record.autoPinsScored, record.alliancePinsScored, record.yellowPinsOwned, record.togglesOwned, record.robotsMidfield, record.autonomousWinPoint ? "Yes" : "No", `${record.reliabilityRating}/5`]),
      [90, 50, 40, 48, 40, 43, 43, 48, 38, 76],
    );
  }

  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    const footerY = doc.page.height - 70;
    doc
      .save()
      .fillColor(pageIndex === 0 ? "#AFAFAF" : gray)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`210 Robotics | ${input.season.name}`, 48, footerY, {
        width: 400,
        lineBreak: false,
      })
      .text(`${pageIndex + 1} / ${range.count}`, 480, footerY, {
        width: 84,
        align: "right",
        lineBreak: false,
      })
      .restore();
  }
  doc.end();
  return completed;
}
