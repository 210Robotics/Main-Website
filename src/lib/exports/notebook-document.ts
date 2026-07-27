import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IRunOptions,
} from "docx";
import { DomUtils, parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";
import type { NotebookPdfInput } from "@/lib/exports/notebook-pdf";
import { centsToMoney, summarizeBudget } from "@/lib/operations";

const ORANGE = "FD7803";
const BLACK = "151515";
const INK = "262626";
const GRAY = "666666";
const LIGHT_GRAY = "F2F4F7";
const LIGHT_ORANGE = "FFF4E8";
const WHITE = "FFFFFF";
const CONTENT_WIDTH = 9360;
const TABLE_INDENT = 120;
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 };
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
  insideHorizontal: {
    style: BorderStyle.SINGLE,
    size: 2,
    color: "E5E5E5",
  },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "E5E5E5" },
};

type Block = Paragraph | Table;

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function textRun(
  text: string,
  options: IRunOptions = {},
) {
  return new TextRun({ text, font: "Calibri", color: INK, size: 22, ...options });
}

function body(text: string, options: { italic?: boolean; color?: string } = {}) {
  return new Paragraph({
    style: "NotebookBody",
    children: [
      textRun(text || "Not recorded.", {
        italics: options.italic,
        color: options.color || INK,
      }),
    ],
  });
}

function sectionHeading(title: string, subtitle?: string): Paragraph[] {
  const result = [
    new Paragraph({
      style: "NotebookSection",
      children: [textRun(title, { bold: true, color: BLACK, size: 36 })],
    }),
  ];
  if (subtitle)
    result.push(
      new Paragraph({
        spacing: { after: 220 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 14,
            color: ORANGE,
            space: 10,
          },
        },
        children: [textRun(subtitle, { color: GRAY, size: 20 })],
      }),
    );
  return result;
}

function subheading(title: string) {
  return new Paragraph({
    style: "NotebookSubheading",
    children: [textRun(title, { bold: true, color: BLACK, size: 27 })],
  });
}

function keyValue(label: string, value: string) {
  return new Paragraph({
    style: "NotebookBody",
    children: [
      textRun(`${label}: `, { bold: true, color: BLACK }),
      textRun(value || "Not recorded.", { color: GRAY }),
    ],
  });
}

function cell(
  value: string | number,
  width: number,
  options: { header?: boolean; center?: boolean; fill?: string } = {},
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlignTable.CENTER,
    shading: options.header
      ? { type: ShadingType.CLEAR, fill: BLACK, color: "auto" }
      : options.fill
        ? { type: ShadingType.CLEAR, fill: options.fill, color: "auto" }
        : undefined,
    children: [
      new Paragraph({
        alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 20, after: 20, line: 280 },
        children: [
          textRun(value === "" ? "-" : String(value), {
            bold: options.header,
            color: options.header ? WHITE : INK,
            size: options.header ? 17 : 18,
          }),
        ],
      }),
    ],
  });
}

function dataTable(
  headers: string[],
  rows: (string | number)[][],
  widths: number[],
  centeredColumns: number[] = [],
) {
  const safeRows = rows.length ? rows : [["No records", ...headers.slice(1).map(() => "-")]];
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    indent: { size: TABLE_INDENT, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) =>
          cell(header, widths[index], {
            header: true,
            center: centeredColumns.includes(index),
          }),
        ),
      }),
      ...safeRows.map(
        (row, rowIndex) =>
          new TableRow({
            children: headers.map((_, index) =>
              cell(row[index] ?? "-", widths[index], {
                center: centeredColumns.includes(index),
                fill: rowIndex % 2 === 0 ? LIGHT_GRAY : WHITE,
              }),
            ),
          }),
      ),
    ],
  });
}

type Marks = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  underline?: boolean;
};

function inlineChildren(nodes: ChildNode[], marks: Marks = {}) {
  const children: (TextRun | ExternalHyperlink)[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      if (!node.data) continue;
      children.push(
        textRun(node.data, {
          bold: marks.bold,
          italics: marks.italics,
          strike: marks.strike,
          underline: marks.underline ? {} : undefined,
          font: marks.code ? "Consolas" : "Calibri",
          color: marks.code ? ORANGE : INK,
        }),
      );
      continue;
    }
    if (node.type !== "tag") continue;
    const element = node as Element;
    const tag = element.name.toLowerCase();
    if (tag === "br") {
      children.push(new TextRun({ break: 1 }));
      continue;
    }
    if (tag === "img") {
      const alt = element.attribs.alt || element.attribs.title || "Notebook image";
      const source = element.attribs.src ? ` (${element.attribs.src})` : "";
      children.push(
        textRun(`[Figure: ${alt}]${source}`, {
          italics: true,
          color: ORANGE,
        }),
      );
      continue;
    }
    const nextMarks: Marks = {
      ...marks,
      bold: marks.bold || tag === "strong" || tag === "b",
      italics: marks.italics || tag === "em" || tag === "i",
      strike: marks.strike || tag === "s" || tag === "strike",
      code: marks.code || tag === "code",
      underline: marks.underline || tag === "u" || tag === "a",
    };
    const nested = inlineChildren(element.children, nextMarks);
    if (tag === "a" && element.attribs.href && nested.length) {
      children.push(
        new ExternalHyperlink({
          link: element.attribs.href,
          children: [
            textRun(DomUtils.textContent(element), {
              color: ORANGE,
              underline: {},
            }),
          ],
        }),
      );
    } else children.push(...nested);
  }
  return children;
}

function descendants(element: Element, tag: string): Element[] {
  const found: Element[] = [];
  for (const node of element.children) {
    if (node.type !== "tag") continue;
    const child = node as Element;
    if (child.name.toLowerCase() === tag) found.push(child);
    else found.push(...descendants(child, tag));
  }
  return found;
}

function htmlTable(element: Element) {
  const rows = descendants(element, "tr").map((row) =>
    row.children
      .filter(
        (node): node is Element =>
          node.type === "tag" &&
          ["th", "td"].includes((node as Element).name.toLowerCase()),
      )
      .map((column) => DomUtils.textContent(column).replace(/\s+/g, " ").trim()),
  );
  const widthCount = Math.max(1, ...rows.map((row) => row.length));
  const widths = Array.from({ length: widthCount }, () =>
    Math.floor(CONTENT_WIDTH / widthCount),
  );
  widths[widths.length - 1] += CONTENT_WIDTH - widths.reduce((sum, width) => sum + width, 0);
  const headers = rows[0] || ["Table"];
  return dataTable(headers, rows.slice(1), widths);
}

function richBlocks(html: string): Block[] {
  const document = parseDocument(html);
  const blocks: Block[] = [];
  const visit = (nodes: ChildNode[], list?: "bullet" | "number") => {
    for (const node of nodes) {
      if (node.type === "text") {
        const value = node.data.replace(/\s+/g, " ").trim();
        if (value) blocks.push(body(value));
        continue;
      }
      if (node.type !== "tag") continue;
      const element = node as Element;
      const tag = element.name.toLowerCase();
      if (["h1", "h2", "h3", "h4"].includes(tag)) {
        const level = tag === "h1" || tag === "h2" ? "NotebookH1" : "NotebookH2";
        blocks.push(
          new Paragraph({
            style: level,
            children: inlineChildren(element.children),
          }),
        );
      } else if (tag === "p") {
        blocks.push(
          new Paragraph({
            style: "NotebookBody",
            children: inlineChildren(element.children),
          }),
        );
      } else if (tag === "blockquote") {
        blocks.push(
          new Paragraph({
            spacing: { before: 100, after: 160, line: 300 },
            indent: { left: 240, right: 120 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 18, color: ORANGE, space: 10 },
            },
            shading: { type: ShadingType.CLEAR, fill: LIGHT_ORANGE, color: "auto" },
            children: inlineChildren(element.children, { italics: true }),
          }),
        );
      } else if (tag === "pre") {
        blocks.push(
          new Paragraph({
            spacing: { before: 100, after: 160, line: 280 },
            shading: { type: ShadingType.CLEAR, fill: "F3F3F3", color: "auto" },
            children: [
              new TextRun({
                text: DomUtils.textContent(element),
                font: "Consolas",
                size: 18,
                color: BLACK,
              }),
            ],
          }),
        );
      } else if (tag === "ul" || tag === "ol") {
        visit(element.children, tag === "ul" ? "bullet" : "number");
      } else if (tag === "li") {
        const inlineNodes = element.children.filter(
          (child) =>
            child.type !== "tag" ||
            !["ul", "ol"].includes((child as Element).name.toLowerCase()),
        );
        blocks.push(
          new Paragraph({
            spacing: { after: 80, line: 300 },
            bullet: list === "bullet" ? { level: 0 } : undefined,
            numbering:
              list === "number"
                ? { reference: "notebook-numbering", level: 0 }
                : undefined,
            children: inlineChildren(inlineNodes),
          }),
        );
        const nestedLists = element.children.filter(
          (child): child is Element =>
            child.type === "tag" &&
            ["ul", "ol"].includes((child as Element).name.toLowerCase()),
        );
        nestedLists.forEach((nested) =>
          visit(nested.children, nested.name === "ul" ? "bullet" : "number"),
        );
      } else if (tag === "table") blocks.push(htmlTable(element));
      else if (tag === "hr") {
        if (element.attribs["data-page-break"] === "true") blocks.push(pageBreak());
        else
          blocks.push(
            new Paragraph({
              spacing: { before: 160, after: 160 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 8, color: "D9D9D9", space: 4 },
              },
            }),
          );
      } else visit(element.children, list);
    }
  };
  visit(document.children);
  return blocks.length ? blocks : [body("No narrative content was recorded.")];
}

function notebookEntryBlocks(input: NotebookPdfInput) {
  const blocks: Block[] = [];
  input.entries.forEach((entry, index) => {
    if (index) blocks.push(pageBreak());
    blocks.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          textRun(`${entry.entryType.replaceAll("_", " ")}  `, {
            bold: true,
            color: WHITE,
            size: 17,
            shading: { type: ShadingType.CLEAR, fill: ORANGE, color: "auto" },
          }),
          textRun(`  ${entry.status.replaceAll("_", " ")} | VERSION ${entry.currentVersion}`, {
            bold: true,
            color: GRAY,
            size: 17,
          }),
        ],
      }),
      new Paragraph({
        style: "NotebookPageTitle",
        children: [textRun(entry.title, { bold: true, color: BLACK, size: 42 })],
      }),
      keyValue("Entry date", entry.entryDate.toLocaleDateString()),
      keyValue(
        "Author / last editor",
        input.names.get(entry.updatedByMemberId || entry.createdByMemberId || "") ||
          "Former member",
      ),
      keyValue("Tags", entry.tags.join(", ") || "None"),
      ...richBlocks(entry.contentHtml),
    );
    if (entry.objective) blocks.push(subheading("Objective / question"), body(entry.objective));
    if (entry.decisions) blocks.push(subheading("Decision and rationale"), body(entry.decisions));
    if (entry.results) blocks.push(subheading("Results and evidence"), body(entry.results));
    if (entry.nextSteps) blocks.push(subheading("Next steps"), body(entry.nextSteps));
  });
  return blocks.length ? blocks : [body("No notebook pages matched this export scope.")];
}

export async function buildEngineeringNotebookDocument(input: NotebookPdfInput) {
  const banner = await readFile(
    path.join(process.cwd(), "public", "media", "brand", "210-banner.png"),
  );
  const children: Block[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 260, after: 500 },
      children: [
        new ImageRun({
          type: "png",
          data: banner,
          transformation: { width: 430, height: 103 },
          altText: {
            title: "210 Robotics",
            description: "210 Robotics team banner",
            name: "210 Robotics banner",
          },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        textRun("ENGINEERING NOTEBOOK", {
          bold: true,
          color: ORANGE,
          size: 24,
          characterSpacing: 80,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [
        textRun(input.season.name, { bold: true, color: BLACK, size: 56 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 460 },
      children: [
        textRun(`${input.season.competition} ${input.season.gameName}`, {
          color: GRAY,
          size: 28,
        }),
      ],
    }),
    dataTable(
      ["DOCUMENT SCOPE", "RECORD"],
      [
        ["Project", input.project ? `${input.project.code} | ${input.project.name}` : "Full season record"],
        ["Manual version", input.season.gameManualVersion],
        ["Notebook pages", input.entries.length],
        ["Compiled", new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }) + " CT"],
      ],
      [2500, 6860],
    ),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 520 },
      children: [
        textRun("THE UNIVERSITY OF TEXAS AT SAN ANTONIO", {
          bold: true,
          color: GRAY,
          size: 18,
        }),
      ],
    }),
    pageBreak(),
    ...sectionHeading("Notebook plan", "Scope, structure, and documentation coverage"),
    keyValue("Season", input.season.name),
    keyValue("Competition", `${input.season.competition} ${input.season.gameName}`),
    keyValue("Project", input.project ? `${input.project.code} | ${input.project.name}` : "All projects"),
    keyValue("Coverage", `${input.entries.length} notebook pages, ${input.projects.length} projects, ${input.subsystems.length} subsystems`),
    subheading("Project structure"),
    dataTable(
      ["Project", "Status", "Subsystems", "Description"],
      input.projects.map((project) => [
        `${project.code} | ${project.name}`,
        project.status,
        input.subsystems.filter((subsystem) => subsystem.projectId === project.id).map((subsystem) => subsystem.code).join(", ") || "-",
        project.description || "-",
      ]),
      [2200, 1200, 1900, 4060],
      [1],
    ),
    pageBreak(),
    ...sectionHeading("Engineering notebook pages", "Version-controlled planning, design, build, test, and decision record"),
    ...notebookEntryBlocks(input),
  ];

  if (input.options.includeEngineering) {
    children.push(
      pageBreak(),
      ...sectionHeading("BOM and manufacturing", "Live master parts and manufacturing readiness"),
      dataTable(
        ["Part", "Name", "Subsystem", "Qty", "Make/Buy", "Rev", "Lifecycle", "Verification"],
        input.parts.map((part) => [part.partNumber, part.name, part.subsystem, part.quantity, part.makeBuy, part.revision, part.lifecycleStatus, part.verificationStatus]),
        [1000, 1800, 1200, 500, 900, 550, 1700, 1710],
        [3, 5],
      ),
      subheading("Manufacturing operations"),
      dataTable(
        ["Part", "Seq", "Process", "Machine", "Status", "Inspection"],
        input.steps.map((step) => [input.parts.find((part) => part.id === step.partId)?.partNumber || "-", step.sequence, step.process, step.machine || "-", step.status, step.inspectionCriteria || "-"]),
        [1100, 600, 1900, 1500, 1400, 2860],
        [1],
      ),
    );
  }
  if (input.options.includeTesting) {
    const testParts = input.parts.filter((part) => part.verificationStatus !== "NOT_REQUIRED" || part.caeStatus !== "NOT_REQUIRED");
    children.push(
      pageBreak(),
      ...sectionHeading("Testing and verification", "Verification status, evidence, and unresolved review work"),
      dataTable(
        ["Part", "CAD", "CAM", "CAE", "Drawing", "Verification", "Notes"],
        testParts.map((part) => [part.partNumber, part.cadStatus, part.camStatus, part.caeStatus, part.drawingStatus, part.verificationStatus, part.notes || "-"]),
        [1050, 1050, 1050, 1050, 1150, 1500, 2510],
      ),
    );
  }
  if (input.options.includeLogistics) {
    children.push(
      pageBreak(),
      ...sectionHeading("Inventory and purchasing", "Available stock, reorder exposure, and procurement status"),
      dataTable(
        ["SKU", "Item", "Category", "Location", "On hand", "Reserved", "Reorder", "Value"],
        input.inventory.map((item) => [item.sku, item.name, item.category, item.location, item.quantityOnHand, item.quantityReserved, item.reorderPoint, centsToMoney(item.quantityOnHand * item.unitCostCents)]),
        [1000, 1800, 1400, 1250, 900, 900, 850, 1260],
        [4, 5, 6, 7],
      ),
      subheading("Purchase requests"),
      dataTable(
        ["Item", "Category", "Qty", "Vendor", "Status", "Priority", "Estimated"],
        input.purchases.map((request) => [request.item, request.category, request.quantity, request.vendor || "TBD", request.status, request.priority, centsToMoney(request.quantity * request.estimatedUnitCostCents)]),
        [2200, 1600, 600, 1600, 1300, 900, 1160],
        [2, 4, 5, 6],
      ),
    );
  }
  if (input.options.includeChanges) {
    children.push(pageBreak(), ...sectionHeading("Design-change control", "Controlled revision decisions and verification evidence"));
    input.changes.forEach((change) => {
      children.push(
        subheading(`${change.changeNumber} | ${change.title}`),
        keyValue("Status / risk", `${change.status} / ${change.risk}`),
        keyValue("Revision", `${change.revisionFrom || "-"} -> ${change.revisionTo || "-"}`),
        keyValue("Cost / schedule", `${centsToMoney(change.costImpactCents)} / ${change.scheduleImpactDays} days`),
        keyValue("Reason", change.reason),
        body(change.description),
        keyValue("Impact", change.impact),
        keyValue("Verification plan", change.verificationPlan),
        keyValue("Verification results", change.verificationResults),
      );
    });
  }
  if (input.options.includeFinance) {
    children.push(pageBreak(), ...sectionHeading("Finance", "Budget scenarios, expenses, income, and sponsor support"));
    input.financePlans.forEach((plan) => {
      const planEntries = input.financeEntries.filter((entry) => entry.planId === plan.id);
      const planSponsors = input.sponsors.filter((sponsor) => sponsor.planId === plan.id);
      const totals = summarizeBudget(planEntries, planSponsors);
      children.push(
        subheading(`${plan.name} | FY ${plan.fiscalYear}`),
        keyValue("Budget range", `${centsToMoney(plan.minimumBudgetCents)} - ${centsToMoney(plan.maximumBudgetCents)}`),
        keyValue("Planned / expenses", `${centsToMoney(totals.planned)} / ${centsToMoney(totals.expenses)}`),
        keyValue("Income + sponsors / available", `${centsToMoney(totals.totalFunding)} / ${centsToMoney(totals.availableCash)}`),
        dataTable(
          ["Type", "Category", "Item", "Qty", "Amount", "Status"],
          planEntries.map((entry) => [entry.kind, entry.category, entry.description, entry.quantity, centsToMoney(entry.amountCents), entry.status]),
          [1000, 1650, 3000, 600, 1400, 1710],
          [0, 3, 4, 5],
        ),
      );
    });
  }
  if (input.options.includeOperations) {
    children.push(pageBreak(), ...sectionHeading("Project operations", "Meetings, decisions, assignments, and documented work"), subheading("Meetings and decisions"));
    input.meetings.forEach((meeting) => {
      children.push(
        keyValue(meeting.heldAt.toLocaleDateString(), meeting.title),
        body(meeting.summary || meeting.discussion),
        ...input.decisions.filter((decision) => decision.meetingId === meeting.id).map((decision) => keyValue("Decision", decision.decision)),
      );
    });
    children.push(
      subheading("Assignments"),
      dataTable(
        ["Task", "Owner", "Priority", "Status", "Due", "Approval"],
        input.tasks.map((task) => [task.title, input.names.get(task.assignedToMemberId) || "Former member", task.priority, task.status, task.dueAt?.toLocaleDateString() || "-", task.approvedAt ? "Approved" : task.status === "IN_REVIEW" ? "Pending" : "-"]),
        [2800, 1700, 1000, 1300, 1200, 1360],
        [2, 3, 4, 5],
      ),
      subheading("Documented engineering work"),
      keyValue("Total recorded hours", (input.hours.reduce((sum, entry) => sum + entry.minutes, 0) / 60).toFixed(1)),
      dataTable(
        ["Date", "Member", "Project", "Category", "Hours", "Description"],
        input.hours.slice(0, 100).map((entry) => [entry.workDate.toLocaleDateString(), input.names.get(entry.memberId) || "Former member", entry.project, entry.category, (entry.minutes / 60).toFixed(1), entry.description]),
        [1200, 1600, 1300, 1200, 700, 3360],
        [0, 4],
      ),
    );
  }
  if (input.options.includeScouting) {
    children.push(
      pageBreak(),
      ...sectionHeading("VEX U Override scouting", "Observed scoring patterns and match performance"),
      body("Override scouting tracks autonomous execution and AWP criteria, Loader throughput, Pin scoring, yellow Pin ownership, Toggles, two-Robot Midfield control, cycle performance, and reliability."),
      dataTable(
        ["Event / match", "Team", "Score", "Auto Pins", "Pins", "Yellow", "Toggles", "Midfield", "AWP", "Reliability"],
        input.scouting.map((record) => [`${record.eventName} ${record.matchNumber}`, record.observedTeam, record.score, record.autoPinsScored, record.alliancePinsScored, record.yellowPinsOwned, record.togglesOwned, record.robotsMidfield, record.autonomousWinPoint ? "Yes" : "No", `${record.reliabilityRating}/5`]),
        [1900, 800, 700, 850, 650, 700, 750, 850, 600, 1560],
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
      ),
    );
  }

  const document = new Document({
    creator: "210 Robotics",
    title: `210 Robotics Engineering Notebook - ${input.season.name}`,
    description: "Version-controlled 210 Robotics engineering notebook and live project record",
    numbering: {
      config: [
        {
          reference: "notebook-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300 } },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: INK },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        { id: "NotebookBody", name: "Notebook Body", basedOn: "Normal", next: "NotebookBody", run: { font: "Calibri", size: 22, color: INK }, paragraph: { spacing: { before: 0, after: 120, line: 300 } } },
        { id: "NotebookSection", name: "Notebook Section", basedOn: "Normal", next: "NotebookBody", quickFormat: true, run: { font: "Calibri", size: 32, bold: true, color: ORANGE }, paragraph: { spacing: { before: 360, after: 200 }, keepNext: true, outlineLevel: 0 } },
        { id: "NotebookH1", name: "Notebook Heading 1", basedOn: "Normal", next: "NotebookBody", quickFormat: true, run: { font: "Calibri", size: 32, bold: true, color: ORANGE }, paragraph: { spacing: { before: 360, after: 200 }, keepNext: true, outlineLevel: 1 } },
        { id: "NotebookH2", name: "Notebook Heading 2", basedOn: "Normal", next: "NotebookBody", quickFormat: true, run: { font: "Calibri", size: 26, bold: true, color: BLACK }, paragraph: { spacing: { before: 280, after: 140 }, keepNext: true, outlineLevel: 2 } },
        { id: "NotebookSubheading", name: "Notebook Subheading", basedOn: "Normal", next: "NotebookBody", quickFormat: true, run: { font: "Calibri", size: 26, bold: true, color: BLACK }, paragraph: { spacing: { before: 280, after: 140 }, keepNext: true, outlineLevel: 2 } },
        { id: "NotebookPageTitle", name: "Notebook Page Title", basedOn: "Normal", next: "NotebookBody", quickFormat: true, run: { font: "Calibri", size: 42, bold: true, color: BLACK }, paragraph: { spacing: { before: 120, after: 180 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ORANGE, space: 7 } },
                children: [
                  textRun("210 ROBOTICS", { bold: true, color: ORANGE, size: 18 }),
                  textRun(`   |   ENGINEERING NOTEBOOK   |   ${input.season.name}`, { color: GRAY, size: 16 }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  textRun("210 Robotics | Internal engineering record | Page ", { color: GRAY, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", color: GRAY, size: 16 }),
                  textRun(" of ", { color: GRAY, size: 16 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", color: GRAY, size: 16 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

export async function buildInternalDocumentFile({
  title,
  description,
  contentHtml,
}: {
  title: string;
  description: string;
  contentHtml: string;
}) {
  const document = new Document({
    creator: "210 Robotics",
    title,
    description: description || "210 Robotics internal document",
    numbering: {
      config: [
        {
          reference: "notebook-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 540, hanging: 270 },
                  spacing: { after: 80, line: 300 },
                },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: INK },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: "NotebookBody",
          name: "Document Body",
          basedOn: "Normal",
          next: "NotebookBody",
          run: { font: "Calibri", size: 22, color: INK },
          paragraph: { spacing: { before: 0, after: 120, line: 300 } },
        },
        {
          id: "NotebookH1",
          name: "Document Heading 1",
          basedOn: "Normal",
          next: "NotebookBody",
          quickFormat: true,
          run: { font: "Calibri", size: 32, bold: true, color: ORANGE },
          paragraph: {
            spacing: { before: 360, after: 200 },
            keepNext: true,
            outlineLevel: 1,
          },
        },
        {
          id: "NotebookH2",
          name: "Document Heading 2",
          basedOn: "Normal",
          next: "NotebookBody",
          quickFormat: true,
          run: { font: "Calibri", size: 26, bold: true, color: BLACK },
          paragraph: {
            spacing: { before: 280, after: 140 },
            keepNext: true,
            outlineLevel: 2,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
              header: 708,
              footer: 708,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 10,
                    color: ORANGE,
                    space: 7,
                  },
                },
                children: [
                  textRun("210 ROBOTICS", {
                    bold: true,
                    color: ORANGE,
                    size: 18,
                  }),
                  textRun("   |   INTERNAL DOCUMENT", {
                    color: GRAY,
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  textRun("210 Robotics | Internal archive | Page ", {
                    color: GRAY,
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Calibri",
                    color: GRAY,
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { before: 160, after: 140 },
            children: [
              textRun(title, { bold: true, color: BLACK, size: 42 }),
            ],
          }),
          ...(description ? [body(description, { color: GRAY })] : []),
          new Paragraph({
            spacing: { after: 240 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: ORANGE,
                space: 8,
              },
            },
          }),
          ...richBlocks(contentHtml),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
