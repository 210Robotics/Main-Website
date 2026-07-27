import "server-only";
import ExcelJS from "exceljs";
import type {
  engineeringParts,
  financeEntries,
  financePlans,
  financeSponsorCommitments,
  manufacturingSteps,
} from "@/db/schema";

type Plan = typeof financePlans.$inferSelect;
type Entry = typeof financeEntries.$inferSelect;
type Sponsor = typeof financeSponsorCommitments.$inferSelect;
type Part = typeof engineeringParts.$inferSelect;
type Step = typeof manufacturingSteps.$inferSelect;

const ORANGE = "FD7803";
const BLACK = "090909";
const CHARCOAL = "202020";
const CREAM = "F5F2EA";
const WHITE = "FFFFFF";
const GREEN = "D9EAD3";
const RED = "F4CCCC";
const AMBER = "FCE5CD";
const VALIDATION_ROWS = 2000;

function titleSheet(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  columns: number,
) {
  sheet.mergeCells(1, 1, 1, columns);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: "Aptos Display",
    size: 22,
    bold: true,
    color: { argb: WHITE },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BLACK },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 38;
  sheet.mergeCells(2, 1, 2, columns);
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Aptos", size: 10, color: { argb: BLACK } };
  subtitleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ORANGE },
  };
  subtitleCell.alignment = { vertical: "middle" };
  sheet.getRow(2).height = 23;
  sheet.views = [
    {
      state: "frozen",
      ySplit: 4,
      activeCell: "A5",
      showGridLines: false,
      zoomScale: 90,
    },
  ];
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
  sheet.headerFooter.oddFooter =
    "&L210 Robotics&CConfidential team record&RPage &P of &N";
  sheet.pageSetup.printTitlesRow = "1:4";
}

function header(row: ExcelJS.Row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: CHARCOAL },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: ORANGE } } };
  });
}

function finishTable(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  rowCount: number,
  columns: number,
) {
  if (rowCount > 0)
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + rowCount, column: columns },
    };
  for (
    let rowIndex = headerRow + 1;
    rowIndex <= headerRow + rowCount;
    rowIndex++
  ) {
    const row = sheet.getRow(rowIndex);
    if ((rowIndex - headerRow) % 2 === 0)
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: CREAM },
        };
      });
    row.eachCell((cell) => {
      cell.font = { name: "Aptos", size: 10, color: { argb: BLACK } };
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }
  sheet.properties.defaultRowHeight = 20;
}

function addListValidation(
  sheet: ExcelJS.Worksheet,
  column: string,
  values: readonly string[],
  endRow = 4 + VALIDATION_ROWS,
) {
  for (let row = 5; row <= endRow; row++) {
    sheet.getCell(`${column}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${values.join(",")}"`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Choose a listed value",
      error: "Select a valid status or record type from the list.",
    };
  }
}

function addStatusFormatting(
  sheet: ExcelJS.Worksheet,
  column: string,
  endRow = 4 + VALIDATION_ROWS,
) {
  const ref = `${column}5:${column}${endRow}`;
  const statusFill = (argb: string) => ({
    type: "pattern" as const,
    pattern: "solid" as const,
    bgColor: { argb },
  });
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [
          `OR($${column}5="PAID",$${column}5="RECEIVED",$${column}5="APPROVED",$${column}5="COMPLETE",$${column}5="READY")`,
        ],
        style: { fill: statusFill(GREEN), font: { color: { argb: "274E13" } } },
      },
      {
        type: "expression",
        priority: 2,
        formulae: [
          `OR($${column}5="PLANNED",$${column}5="PLEDGED",$${column}5="IN_PROGRESS",$${column}5="IN_REVIEW",$${column}5="PENDING",$${column}5="READY_FOR_REVIEW")`,
        ],
        style: { fill: statusFill(AMBER), font: { color: { argb: "7F3F00" } } },
      },
      {
        type: "expression",
        priority: 3,
        formulae: [
          `OR($${column}5="CANCELED",$${column}5="BLOCKED",$${column}5="REJECTED",$${column}5="OBSOLETE")`,
        ],
        style: { fill: statusFill(RED), font: { color: { argb: "990000" } } },
      },
    ],
  });
}

export async function buildFinanceWorkbook(data: {
  plans: Plan[];
  entries: Entry[];
  sponsors: Sponsor[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "210 Robotics";
  workbook.company = "210 Robotics";
  workbook.subject = "Budget plan and expense ledger";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const planName = new Map(data.plans.map((plan) => [plan.id, plan.name]));
  const ledgerEnd = Math.max(4 + VALIDATION_ROWS, 4 + data.entries.length);
  const sponsorEnd = Math.max(4 + VALIDATION_ROWS, 4 + data.sponsors.length);
  const planEnd = Math.max(4 + VALIDATION_ROWS, 4 + data.plans.length);
  const expenseTotal =
    data.entries
      .filter(
        (entry) => entry.kind === "EXPENSE" && entry.status !== "CANCELED",
      )
      .reduce((sum, entry) => sum + entry.amountCents, 0) / 100;
  const incomeTotal =
    data.entries
      .filter((entry) => entry.kind === "INCOME" && entry.status !== "CANCELED")
      .reduce((sum, entry) => sum + entry.amountCents, 0) / 100;
  const plannedTotal =
    data.entries
      .filter(
        (entry) =>
          ["BUDGET_ITEM", "BOM_ITEM"].includes(entry.kind) &&
          entry.status !== "CANCELED",
      )
      .reduce((sum, entry) => sum + entry.amountCents, 0) / 100;
  const sponsorTotal =
    data.sponsors
      .filter((sponsor) => sponsor.status !== "PROSPECT")
      .reduce((sum, sponsor) => sum + sponsor.amountCents, 0) / 100;
  const maximumBudgetTotal =
    data.plans.reduce((sum, plan) => sum + plan.maximumBudgetCents, 0) / 100;
  const summary = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: ORANGE } },
  });
  titleSheet(
    summary,
    "210 ROBOTICS · FINANCE PLAN",
    `Budget, expense, BOM, and sponsor workbook · Generated ${new Date().toLocaleString()}`,
    6,
  );
  summary.columns = [
    { width: 28 },
    { width: 22 },
    { width: 4 },
    { width: 28 },
    { width: 22 },
    { width: 18 },
  ];
  summary.getCell("A4").value = "Financial snapshot";
  summary.getCell("A4").font = { size: 15, bold: true, color: { argb: BLACK } };
  const metrics: [string, ExcelJS.CellFormulaValue][] = [
    [
      "Recorded expenses",
      {
        formula: `SUMIFS('Ledger'!$I$5:$I$${ledgerEnd},'Ledger'!$B$5:$B$${ledgerEnd},"EXPENSE",'Ledger'!$J$5:$J$${ledgerEnd},"<>CANCELED")`,
        result: expenseTotal,
      },
    ],
    [
      "Recorded income",
      {
        formula: `SUMIFS('Ledger'!$I$5:$I$${ledgerEnd},'Ledger'!$B$5:$B$${ledgerEnd},"INCOME",'Ledger'!$J$5:$J$${ledgerEnd},"<>CANCELED")`,
        result: incomeTotal,
      },
    ],
    [
      "Planned / BOM items",
      {
        formula: `SUMIFS('Ledger'!$I$5:$I$${ledgerEnd},'Ledger'!$B$5:$B$${ledgerEnd},"BUDGET_ITEM",'Ledger'!$J$5:$J$${ledgerEnd},"<>CANCELED")+SUMIFS('Ledger'!$I$5:$I$${ledgerEnd},'Ledger'!$B$5:$B$${ledgerEnd},"BOM_ITEM",'Ledger'!$J$5:$J$${ledgerEnd},"<>CANCELED")`,
        result: plannedTotal,
      },
    ],
    [
      "Sponsor commitments",
      {
        formula: `SUMIFS('Sponsor Funding'!$D$5:$D$${sponsorEnd},'Sponsor Funding'!$E$5:$E$${sponsorEnd},"<>PROSPECT")`,
        result: sponsorTotal,
      },
    ],
    [
      "Net available funding",
      {
        formula: "B8+B10-B7",
        result: incomeTotal + sponsorTotal - expenseTotal,
      },
    ],
  ];
  metrics.forEach(([label, formula], index) => {
    const row = 7 + index;
    summary.getCell(row, 1).value = label;
    summary.getCell(row, 2).value = formula;
    summary.getCell(row, 2).numFmt = "$#,##0.00;[Red]-$#,##0.00";
  });
  summary.getCell("D7").value = "Plans";
  summary.getCell("E7").value = data.plans.length;
  summary.getCell("D8").value = "Ledger items";
  summary.getCell("E8").value = data.entries.length;
  summary.getCell("D9").value = "Sponsor records";
  summary.getCell("E9").value = data.sponsors.length;
  summary.getCell("D10").value = "Combined max budget";
  summary.getCell("E10").value = {
    formula: `SUM('Budget Plan'!$F$5:$F$${planEnd})`,
    result: maximumBudgetTotal,
  };
  summary.getCell("E10").numFmt = "$#,##0.00;[Red]-$#,##0.00";
  summary.getCell("D11").value = "Funding vs. max budget";
  summary.getCell("E11").value = {
    formula: "B11-E10",
    result: incomeTotal + sponsorTotal - expenseTotal - maximumBudgetTotal,
  };
  summary.getCell("E11").numFmt = "$#,##0.00;[Red]-$#,##0.00";
  for (let row = 7; row <= 11; row++) {
    [1, 2, 4, 5].forEach((col) => {
      const cell = summary.getCell(row, col);
      cell.border = { bottom: { style: "thin", color: { argb: "D0D0D0" } } };
      cell.font = { bold: col === 1 || col === 4, color: { argb: BLACK } };
      if (col === 2 || col === 5) cell.alignment = { horizontal: "right" };
    });
  }
  summary.getCell("B11").font = {
    bold: true,
    color: { argb: ORANGE },
    size: 12,
  };
  summary.getCell("A14").value = "How to use this workbook";
  summary.getCell("A14").font = { size: 14, bold: true };
  summary.mergeCells("A15:F18");
  summary.getCell("A15").value =
    "Use Ledger for actual and planned transactions, Budget Plan for approved ranges and assumptions, and Sponsor Funding for prospective, pledged, invoiced, and received support. Orange bands identify 210 Robotics records; formulas recalculate when rows are edited in Excel.";
  summary.getCell("A15").alignment = { wrapText: true, vertical: "top" };

  const ledger = workbook.addWorksheet("Ledger", {
    properties: { tabColor: { argb: ORANGE } },
  });
  titleSheet(
    ledger,
    "210 ROBOTICS · FINANCE LEDGER",
    "Expenses, income, budget items, and purchasing BOM records",
    12,
  );
  ledger.columns = [
    { width: 13 },
    { width: 16 },
    { width: 24 },
    { width: 18 },
    { width: 36 },
    { width: 22 },
    { width: 10 },
    { width: 15 },
    { width: 16 },
    { width: 15 },
    { width: 30 },
    { width: 38 },
  ];
  ledger.getRow(4).values = [
    "Date",
    "Type",
    "Plan",
    "Category",
    "Description",
    "Vendor / Supplier",
    "Quantity",
    "Unit Cost",
    "Amount",
    "Status",
    "Receipt / Evidence",
    "Notes",
  ];
  header(ledger.getRow(4));
  data.entries.forEach((entry, index) => {
    const row = ledger.getRow(5 + index);
    row.values = [
      entry.occurredAt,
      entry.kind,
      entry.planId
        ? (planName.get(entry.planId) ?? "Unknown plan")
        : "Unassigned",
      entry.category,
      entry.description,
      entry.vendor,
      entry.quantity,
      entry.unitCostCents / 100,
      entry.amountCents / 100,
      entry.status,
      entry.receiptUrl
        ? { text: "Open evidence", hyperlink: entry.receiptUrl }
        : "",
      entry.notes,
    ];
    row.getCell(1).numFmt = "mmm d, yyyy";
    row.getCell(8).numFmt = row.getCell(9).numFmt = "$#,##0.00;[Red]-$#,##0.00";
  });
  finishTable(ledger, 4, data.entries.length, 12);
  addListValidation(
    ledger,
    "B",
    ["EXPENSE", "INCOME", "BUDGET_ITEM", "BOM_ITEM"],
    ledgerEnd,
  );
  addListValidation(
    ledger,
    "J",
    ["PLANNED", "APPROVED", "ORDERED", "PAID", "RECEIVED", "CANCELED"],
    ledgerEnd,
  );
  addStatusFormatting(ledger, "J", ledgerEnd);

  const plans = workbook.addWorksheet("Budget Plan", {
    properties: { tabColor: { argb: "7F7F7F" } },
  });
  titleSheet(
    plans,
    "210 ROBOTICS · BUDGET PLANS",
    "Fiscal ranges, status, project ownership, and planning assumptions",
    8,
  );
  plans.columns = [
    { width: 32 },
    { width: 13 },
    { width: 24 },
    { width: 14 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 55 },
  ];
  plans.getRow(4).values = [
    "Plan",
    "Fiscal Year",
    "Project",
    "Status",
    "Minimum Budget",
    "Maximum Budget",
    "Range",
    "Notes / Assumptions",
  ];
  header(plans.getRow(4));
  data.plans.forEach((plan, index) => {
    const row = plans.getRow(5 + index);
    row.values = [
      plan.name,
      plan.fiscalYear,
      plan.project,
      plan.status,
      plan.minimumBudgetCents / 100,
      plan.maximumBudgetCents / 100,
      { formula: `F${5 + index}-E${5 + index}` },
      plan.notes,
    ];
    [5, 6, 7].forEach((col) => (row.getCell(col).numFmt = "$#,##0.00"));
  });
  finishTable(plans, 4, data.plans.length, 8);
  addListValidation(plans, "D", ["DRAFT", "ACTIVE", "ARCHIVED"], planEnd);
  addStatusFormatting(plans, "D", planEnd);

  const sponsors = workbook.addWorksheet("Sponsor Funding", {
    properties: { tabColor: { argb: ORANGE } },
  });
  titleSheet(
    sponsors,
    "210 ROBOTICS · SPONSOR FUNDING",
    "Prospects, commitments, invoices, receipts, restrictions, and contacts",
    10,
  );
  sponsors.columns = [
    { width: 25 },
    { width: 28 },
    { width: 18 },
    { width: 17 },
    { width: 16 },
    { width: 22 },
    { width: 30 },
    { width: 16 },
    { width: 42 },
    { width: 16 },
  ];
  sponsors.getRow(4).values = [
    "Plan",
    "Sponsor",
    "Tier",
    "Amount",
    "Status",
    "Contact",
    "Email",
    "Received",
    "Restrictions",
    "Recorded",
  ];
  header(sponsors.getRow(4));
  data.sponsors.forEach((sponsor, index) => {
    const row = sponsors.getRow(5 + index);
    row.values = [
      sponsor.planId
        ? (planName.get(sponsor.planId) ?? "Unknown plan")
        : "Unassigned",
      sponsor.sponsorName,
      sponsor.tier,
      sponsor.amountCents / 100,
      sponsor.status,
      sponsor.contactName,
      sponsor.contactEmail
        ? {
            text: sponsor.contactEmail,
            hyperlink: `mailto:${sponsor.contactEmail}`,
          }
        : "",
      sponsor.receivedAt,
      sponsor.restrictions,
      sponsor.createdAt,
    ];
    row.getCell(4).numFmt = "$#,##0.00";
    row.getCell(8).numFmt = row.getCell(10).numFmt = "mmm d, yyyy";
  });
  finishTable(sponsors, 4, data.sponsors.length, 10);
  addListValidation(
    sponsors,
    "E",
    ["PROSPECT", "PLEDGED", "INVOICED", "RECEIVED"],
    sponsorEnd,
  );
  addStatusFormatting(sponsors, "E", sponsorEnd);
  return workbook;
}

export async function buildEngineeringWorkbook(data: {
  parts: Part[];
  steps: Step[];
  memberNames: Map<string, string>;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "210 Robotics";
  workbook.company = "210 Robotics";
  workbook.subject = "Engineering BOM and manufacturing control";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const partById = new Map(data.parts.map((part) => [part.id, part]));
  const parts = workbook.addWorksheet("Part Master", {
    properties: { tabColor: { argb: ORANGE } },
  });
  titleSheet(
    parts,
    "210 ROBOTICS · PART MASTER",
    `BOM, sourcing, ownership, and release control · Generated ${new Date().toLocaleString()}`,
    25,
  );
  parts.columns = [
    16, 22, 28, 18, 10, 10, 12, 18, 18, 18, 22, 14, 14, 12, 18, 16, 16, 16, 16,
    18, 16, 22, 16, 40, 18,
  ].map((width) => ({ width }));
  parts.getRow(4).values = [
    "Project",
    "Part Number",
    "Name",
    "Subsystem",
    "Rev",
    "Qty",
    "Make/Buy",
    "Material",
    "Stock Size",
    "Manufacturing",
    "Supplier",
    "Unit Cost",
    "Extended Cost",
    "Lead Days",
    "CAD",
    "CAM",
    "CAE",
    "Drawing",
    "Verification",
    "Lifecycle",
    "Owner",
    "Due",
    "Links",
    "Notes",
    "Updated",
  ];
  header(parts.getRow(4));
  data.parts.forEach((part, index) => {
    const n = 5 + index;
    const row = parts.getRow(n);
    row.values = [
      part.project,
      part.partNumber,
      part.name,
      part.subsystem,
      part.revision,
      part.quantity,
      part.makeBuy,
      part.material,
      part.stockSize,
      part.manufacturingMethod,
      part.supplier,
      part.unitCostCents / 100,
      { formula: `F${n}*L${n}` },
      part.leadTimeDays,
      part.cadStatus,
      part.camStatus,
      part.caeStatus,
      part.drawingStatus,
      part.verificationStatus,
      part.lifecycleStatus,
      part.assignedToMemberId
        ? (data.memberNames.get(part.assignedToMemberId) ?? "Unknown")
        : "Unassigned",
      part.dueAt,
      [part.cadUrl, part.drawingUrl, part.sourceUrl].filter(Boolean).join("\n"),
      part.notes,
      part.updatedAt,
    ];
    row.getCell(12).numFmt = row.getCell(13).numFmt = "$#,##0.00";
    [22, 25].forEach((col) => (row.getCell(col).numFmt = "mmm d, yyyy"));
  });
  finishTable(parts, 4, data.parts.length, 25);
  const partEnd = Math.max(4 + VALIDATION_ROWS, 4 + data.parts.length);
  addListValidation(parts, "G", ["MAKE", "BUY"], partEnd);
  addListValidation(
    parts,
    "O",
    [
      "NOT_STARTED",
      "IN_PROGRESS",
      "READY_FOR_REVIEW",
      "APPROVED",
      "BLOCKED",
      "NOT_REQUIRED",
    ],
    partEnd,
  );
  for (const column of ["P", "Q", "R"])
    addListValidation(
      parts,
      column,
      [
        "NOT_STARTED",
        "IN_PROGRESS",
        "READY_FOR_REVIEW",
        "APPROVED",
        "BLOCKED",
        "NOT_REQUIRED",
      ],
      partEnd,
    );
  addListValidation(
    parts,
    "S",
    ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "NOT_REQUIRED"],
    partEnd,
  );
  addListValidation(
    parts,
    "T",
    ["DESIGN", "RELEASED", "IN_MANUFACTURING", "READY", "OBSOLETE"],
    partEnd,
  );
  for (const column of ["O", "P", "Q", "R", "S", "T"])
    addStatusFormatting(parts, column, partEnd);

  const bom = workbook.addWorksheet("BOM", {
    properties: { tabColor: { argb: ORANGE } },
  });
  titleSheet(
    bom,
    "210 ROBOTICS · ROBOT BOM",
    "Purchasing and assembly-focused bill of materials",
    12,
  );
  bom.columns = [20, 18, 26, 20, 10, 12, 20, 18, 15, 16, 18, 18].map(
    (width) => ({ width }),
  );
  bom.getRow(4).values = [
    "Project",
    "Part Number",
    "Description",
    "Subsystem",
    "Qty",
    "Make/Buy",
    "Supplier / Method",
    "Material",
    "Unit Cost",
    "Extended Cost",
    "Lifecycle",
    "Verification",
  ];
  header(bom.getRow(4));
  data.parts.forEach((part, index) => {
    const n = 5 + index;
    const row = bom.getRow(n);
    row.values = [
      part.project,
      part.partNumber,
      part.name,
      part.subsystem,
      part.quantity,
      part.makeBuy,
      part.makeBuy === "BUY" ? part.supplier : part.manufacturingMethod,
      part.material,
      part.unitCostCents / 100,
      { formula: `E${n}*I${n}` },
      part.lifecycleStatus,
      part.verificationStatus,
    ];
    row.getCell(9).numFmt = row.getCell(10).numFmt = "$#,##0.00";
  });
  finishTable(bom, 4, data.parts.length, 12);
  addStatusFormatting(bom, "K", partEnd);
  addStatusFormatting(bom, "L", partEnd);

  const router = workbook.addWorksheet("Manufacturing Router", {
    properties: { tabColor: { argb: "7F7F7F" } },
  });
  titleSheet(
    router,
    "210 ROBOTICS · MANUFACTURING ROUTER",
    "Sequenced work instructions, assignments, and inspection gates",
    12,
  );
  router.columns = [18, 18, 28, 10, 22, 22, 30, 55, 45, 18, 22, 18].map(
    (width) => ({ width }),
  );
  router.getRow(4).values = [
    "Project",
    "Part Number",
    "Part",
    "Sequence",
    "Process",
    "Machine",
    "Setup",
    "Instructions",
    "Inspection Criteria",
    "Status",
    "Assigned",
    "Completed",
  ];
  header(router.getRow(4));
  data.steps.forEach((step, index) => {
    const part = partById.get(step.partId);
    const row = router.getRow(5 + index);
    row.values = [
      part?.project ?? "Unknown",
      part?.partNumber ?? "Unknown",
      part?.name ?? "Unknown",
      step.sequence,
      step.process,
      step.machine,
      step.setup,
      step.instructions,
      step.inspectionCriteria,
      step.status,
      step.assignedToMemberId
        ? (data.memberNames.get(step.assignedToMemberId) ?? "Unknown")
        : "Unassigned",
      step.completedAt,
    ];
    row.getCell(12).numFmt = "mmm d, yyyy";
  });
  finishTable(router, 4, data.steps.length, 12);
  const stepEnd = Math.max(4 + VALIDATION_ROWS, 4 + data.steps.length);
  addListValidation(
    router,
    "J",
    ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "READY_FOR_REVIEW", "COMPLETE"],
    stepEnd,
  );
  addStatusFormatting(router, "J", stepEnd);

  const verification = workbook.addWorksheet("Verification Matrix", {
    properties: { tabColor: { argb: ORANGE } },
  });
  titleSheet(
    verification,
    "210 ROBOTICS · VERIFICATION MATRIX",
    "CAD, CAM, CAE, drawing, manufacturing, and release readiness",
    13,
  );
  verification.columns = [
    18, 18, 28, 18, 16, 16, 16, 16, 18, 18, 18, 22, 45,
  ].map((width) => ({ width }));
  verification.getRow(4).values = [
    "Project",
    "Part Number",
    "Part",
    "Subsystem",
    "CAD",
    "CAM",
    "CAE",
    "Drawing",
    "Verification",
    "Lifecycle",
    "Router Complete",
    "Owner",
    "Notes",
  ];
  header(verification.getRow(4));
  data.parts.forEach((part, index) => {
    const partSteps = data.steps.filter((step) => step.partId === part.id);
    const row = verification.getRow(5 + index);
    row.values = [
      part.project,
      part.partNumber,
      part.name,
      part.subsystem,
      part.cadStatus,
      part.camStatus,
      part.caeStatus,
      part.drawingStatus,
      part.verificationStatus,
      part.lifecycleStatus,
      partSteps.length
        ? partSteps.every((step) => step.status === "COMPLETE")
          ? "YES"
          : "NO"
        : "N/A",
      part.assignedToMemberId
        ? (data.memberNames.get(part.assignedToMemberId) ?? "Unknown")
        : "Unassigned",
      part.notes,
    ];
  });
  finishTable(verification, 4, data.parts.length, 13);
  for (const column of ["E", "F", "G", "H", "I", "J"])
    addStatusFormatting(verification, column, partEnd);
  return workbook;
}
