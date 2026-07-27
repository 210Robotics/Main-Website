import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  buildEngineeringWorkbook,
  buildFinanceWorkbook,
} from "../src/lib/exports/workbooks";
import { buildMeetingDocument } from "../src/lib/exports/meeting-document";

async function main() {
  const now = new Date("2026-07-20T18:00:00-05:00");
  const planId = "11111111-1111-4111-8111-111111111111";
  const memberId = "22222222-2222-4222-8222-222222222222";
  const meetingId = "33333333-3333-4333-8333-333333333333";
  const partId = "44444444-4444-4444-8444-444444444444";
  const common = { createdAt: now, updatedAt: now };

  const finance = await buildFinanceWorkbook({
    plans: [
      {
        id: planId,
        seasonId: null,
        engineeringProjectId: null,
        name: "2026 Competition Robot",
        fiscalYear: 2026,
        project: "VEX U",
        status: "ACTIVE",
        minimumBudgetCents: 500000,
        maximumBudgetCents: 1250000,
        notes: "Prioritize drivetrain, controls, and event spares.",
        createdByMemberId: memberId,
        ...common,
      },
    ],
    entries: [
      {
        id: crypto.randomUUID(),
        planId,
        subsystemId: null,
        kind: "EXPENSE",
        category: "Mechanical",
        description: "6061 aluminum plate",
        vendor: "Sample Metals",
        quantity: 2,
        unitCostCents: 8500,
        amountCents: 17000,
        status: "PAID",
        occurredAt: now,
        receiptUrl: "https://example.com/receipt",
        notes: "Prototype and competition stock",
        createdByMemberId: memberId,
        ...common,
      },
    ],
    sponsors: [
      {
        id: crypto.randomUUID(),
        planId,
        sponsorName: "Sample Sponsor",
        tier: "Gold",
        amountCents: 250000,
        status: "PLEDGED",
        contactName: "Alex Partner",
        contactEmail: "alex@example.com",
        receivedAt: null,
        restrictions: "Competition robot materials",
        createdByMemberId: memberId,
        ...common,
      },
    ],
  });

  const engineering = await buildEngineeringWorkbook({
    memberNames: new Map([[memberId, "Jordan Builder"]]),
    parts: [
      {
        id: partId,
        seasonId: null,
        engineeringProjectId: null,
        subsystemId: null,
        project: "RoboRowdy",
        partNumber: "210-DR-001",
        name: "Drive rail",
        description: "Left/right mirrored rail",
        subsystem: "Drivetrain",
        revision: "B",
        quantity: 2,
        makeBuy: "MAKE",
        material: "6061-T6",
        stockSize: "0.25 x 3 x 24 in",
        manufacturingMethod: "3-axis CNC mill",
        supplier: "",
        unitCostCents: 4200,
        leadTimeDays: 2,
        cadStatus: "APPROVED",
        camStatus: "READY_FOR_REVIEW",
        caeStatus: "NOT_REQUIRED",
        drawingStatus: "APPROVED",
        verificationStatus: "IN_REVIEW",
        lifecycleStatus: "IN_MANUFACTURING",
        cadUrl: "https://example.com/cad",
        drawingUrl: "https://example.com/drawing",
        sourceUrl: null,
        assignedToMemberId: memberId,
        dueAt: now,
        notes: "Verify bearing bore after op 20.",
        createdByMemberId: memberId,
        ...common,
      },
    ],
    steps: [
      {
        id: crypto.randomUUID(),
        partId,
        sequence: 10,
        process: "Mill profile and pockets",
        machine: "Haas VF-2",
        setup: "Soft jaws, WCS on lower-left corner",
        instructions: "Face stock, rough pockets, finish contour.",
        inspectionCriteria: "Profile ±0.005 in; bores +0.0005/-0.0000 in",
        status: "IN_PROGRESS",
        assignedToMemberId: memberId,
        completedAt: null,
        ...common,
      },
    ],
  });

  const meeting = {
    id: meetingId,
    activityId: null,
    title: "Robot Design Review",
    heldAt: now,
    location: "Makerspace",
    facilitator: "Engineering Director",
    agenda: "Review drivetrain release and assign manufacturing actions.",
    discussion:
      "The team reviewed rail rigidity, stock availability, and CAM readiness.",
    summary:
      "Approved the rail geometry pending bore verification. Manufacturing begins after CAM review.",
    nextMeeting: "Manufacturing review on July 23",
    status: "FINAL",
    createdByMemberId: memberId,
    ...common,
  };
  const decisions = [
    {
      id: crypto.randomUUID(),
      meetingId,
      decision: "Release drive rail revision B",
      rationale: "CAE and packaging review passed.",
      impact: "Manufacturing can start after CAM sign-off.",
      createdByMemberId: memberId,
      createdAt: now,
    },
  ];
  const tasks = [
    {
      id: crypto.randomUUID(),
      meetingId,
      engineeringProjectId: null,
      subsystemId: null,
      assignedToMemberId: memberId,
      createdByMemberId: memberId,
      title: "Complete CAM peer review",
      description: "Review toolpaths and post-processing.",
      project: "RoboRowdy",
      priority: "HIGH",
      status: "IN_REVIEW",
      dueAt: now,
      completedAt: null,
      completionRequestedAt: now,
      completionRequestedByMemberId: memberId,
      approvedAt: null,
      approvedByMemberId: null,
      approvalNote: "",
      archivedAt: null,
      ...common,
    },
  ];
  const doc = await buildMeetingDocument({
    meeting,
    decisions,
    tasks,
    attendees: ["Jordan Builder", "Taylor Programmer", "Morgan Lead"],
    memberNames: new Map([[memberId, "Jordan Builder"]]),
  });

  const output = join(tmpdir(), "210-operations-export-qa");
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "finance-sample.xlsx"),
    Buffer.from(await finance.xlsx.writeBuffer()),
  );
  await writeFile(
    join(output, "engineering-sample.xlsx"),
    Buffer.from(await engineering.xlsx.writeBuffer()),
  );
  await writeFile(join(output, "meeting-sample.docx"), doc);

  for (const [name, workbook] of [
    ["finance", finance],
    ["engineering", engineering],
  ] as const) {
    const roundTrip = new ExcelJS.Workbook();
    await roundTrip.xlsx.load(await workbook.xlsx.writeBuffer());
    if (
      !roundTrip.worksheets.length ||
      roundTrip.worksheets.some((sheet) => !sheet.getCell("A1").value)
    )
      throw new Error(`${name} workbook validation failed.`);
    if (
      roundTrip.worksheets.some((sheet) => {
        const view = sheet.views[0];
        return (
          view?.showGridLines !== false ||
          !("ySplit" in view) ||
          view.ySplit !== 4 ||
          sheet.pageSetup.printTitlesRow !== "1:4"
        );
      })
    )
      throw new Error(`${name} workbook navigation or print setup failed.`);
    const formulas = roundTrip.worksheets.flatMap((sheet) => {
      const found: string[] = [];
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          const value = cell.value;
          if (value && typeof value === "object" && "formula" in value)
            found.push(String(value.formula));
        }),
      );
      return found;
    });
    if (formulas.some((formula) => /\$[A-Z]+:\$[A-Z]+/.test(formula)))
      throw new Error(`${name} workbook contains an unbounded formula range.`);

    if (name === "finance") {
      if (
        roundTrip.worksheets.map((sheet) => sheet.name).join("|") !==
        "Summary|Ledger|Budget Plan|Sponsor Funding"
      )
        throw new Error("Finance workbook sheet structure changed.");
      const summary = roundTrip.getWorksheet("Summary")!;
      const ledger = roundTrip.getWorksheet("Ledger")!;
      const net = summary.getCell("B11").value;
      if (
        !net ||
        typeof net !== "object" ||
        !("formula" in net) ||
        net.formula !== "B8+B10-B7" ||
        net.result !== 2330
      )
        throw new Error(
          "Finance net funding formula or cached value is incorrect.",
        );
      if (
        ledger.getCell("A4").fill.type !== "pattern" ||
        ledger.getCell("A4").font.color?.argb !== "FFFFFF" ||
        ledger.getCell("H5").numFmt !== "$#,##0.00;[Red]-$#,##0.00" ||
        ledger.getCell("B5").dataValidation.formulae?.[0] !==
          '"EXPENSE,INCOME,BUDGET_ITEM,BOM_ITEM"'
      )
        throw new Error(
          "Finance workbook styling, validation, or status rules failed.",
        );
    } else {
      if (
        roundTrip.worksheets.map((sheet) => sheet.name).join("|") !==
        "Part Master|BOM|Manufacturing Router|Verification Matrix"
      )
        throw new Error("Engineering workbook sheet structure changed.");
      const parts = roundTrip.getWorksheet("Part Master")!;
      const extended = parts.getCell("M5").value;
      if (
        !extended ||
        typeof extended !== "object" ||
        !("formula" in extended) ||
        extended.formula !== "F5*L5" ||
        parts.getCell("G5").dataValidation.formulae?.[0] !== '"MAKE,BUY"'
      )
        throw new Error(
          "Engineering formulas, validation, or status rules failed.",
        );
    }
  }
  console.log(output);
}

void main();
