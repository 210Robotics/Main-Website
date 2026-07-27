import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildEngineeringNotebookPdf,
  type NotebookPdfInput,
} from "@/lib/exports/notebook-pdf";

const now = new Date("2026-07-20T18:00:00-05:00");
const memberId = "00000000-0000-4000-8000-000000000210";
const seasonId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const subsystemId = "00000000-0000-4000-8000-000000000003";
const partId = "00000000-0000-4000-8000-000000000004";
const planId = "00000000-0000-4000-8000-000000000005";
const meetingId = "00000000-0000-4000-8000-000000000006";

const input = {
  season: {
    id: seasonId,
    name: "2026-27 Override",
    competition: "VEX U",
    gameName: "Override",
    gameManualVersion: "1.0",
    status: "ACTIVE",
    startsAt: now,
    endsAt: new Date("2027-06-30T23:59:59-05:00"),
    isDefault: true,
    createdByMemberId: memberId,
    createdAt: now,
    updatedAt: now,
  },
  project: {
    id: projectId,
    seasonId,
    code: "VEXU",
    name: "Override Competition Robots",
    description: "Integrated design and competition program for both VEX U robots.",
    status: "ACTIVE",
    leadMemberId: memberId,
    startsAt: now,
    dueAt: new Date("2027-04-01T18:00:00-05:00"),
    createdByMemberId: memberId,
    createdAt: now,
    updatedAt: now,
  },
  projects: [],
  subsystems: [
    {
      id: subsystemId,
      projectId,
      code: "SCORE",
      name: "Scoring Mechanism",
      description: "Pin acquisition, stacking, and Goal interaction.",
      status: "ACTIVE",
      leadMemberId: memberId,
      createdByMemberId: memberId,
      createdAt: now,
      updatedAt: now,
    },
  ],
  entries: [
    {
      id: "00000000-0000-4000-8000-000000000007",
      seasonId,
      projectId,
      subsystemId,
      title: "Loader cycle prototype verification",
      entryType: "TESTING",
      status: "PUBLISHED",
      entryDate: now,
      contentHtml:
        "<h2>Test procedure</h2><p>Completed twelve repeatable loader cycles with both robots and recorded transfer time.</p><ul><li>Inspect alignment</li><li>Measure cycle time</li><li>Record failures</li></ul>",
      objective: "Verify reliable Loader throughput before design freeze.",
      decisions: "Retain the revised guide geometry and add a wear insert.",
      results: "11 of 12 cycles passed; average cycle time was 4.2 seconds.",
      nextSteps: "Run a 50-cycle endurance test and attach video evidence.",
      tags: ["testing", "loader", "verification"],
      currentVersion: 3,
      createdByMemberId: memberId,
      updatedByMemberId: memberId,
      createdAt: now,
      updatedAt: now,
    },
  ],
  parts: [
    {
      id: partId,
      partNumber: "210-SCR-014",
      name: "Pin transfer guide",
      subsystem: "Scoring",
      quantity: 2,
      makeBuy: "MAKE",
      revision: "C",
      lifecycleStatus: "IN_MANUFACTURING",
      verificationStatus: "IN_REVIEW",
      cadStatus: "APPROVED",
      camStatus: "READY_FOR_REVIEW",
      caeStatus: "NOT_REQUIRED",
      drawingStatus: "APPROVED",
      notes: "Endurance verification pending.",
    },
  ],
  steps: [
    {
      id: "00000000-0000-4000-8000-000000000008",
      partId,
      sequence: 10,
      process: "CNC mill",
      machine: "Tormach 1100MX",
      status: "IN_PROGRESS",
      inspectionCriteria: "Profile within 0.005 in and all edges deburred.",
    },
  ],
  inventory: [
    {
      sku: "AL-6061-025",
      name: "6061 plate, 0.25 in",
      category: "Raw material",
      location: "Stock rack A",
      quantityOnHand: 6,
      quantityReserved: 2,
      reorderPoint: 3,
      unitCostCents: 4200,
    },
  ],
  purchases: [
    {
      item: "Timing belts",
      category: "Robot parts",
      quantity: 8,
      vendor: "VEX Robotics",
      status: "APPROVED",
      priority: "HIGH",
      estimatedUnitCostCents: 1299,
    },
  ],
  changes: [
    {
      changeNumber: "ECO-026",
      title: "Increase transfer-guide lead-in",
      status: "APPROVED",
      risk: "LOW",
      revisionFrom: "B",
      revisionTo: "C",
      costImpactCents: 1600,
      scheduleImpactDays: 1,
      reason: "Reduce jams observed during loader testing.",
      description: "Widen the lead-in by 0.08 in and add a replaceable wear insert.",
      impact: "Requires two replacement parts; no frame or controls changes.",
      verificationPlan: "Complete 50 loader cycles with fewer than two failed transfers.",
      verificationResults: "Pending endurance run.",
    },
  ],
  financePlans: [
    {
      id: planId,
      name: "Competition-ready scenario",
      fiscalYear: 2026,
      minimumBudgetCents: 800000,
      maximumBudgetCents: 1250000,
    },
  ],
  financeEntries: [
    {
      planId,
      kind: "EXPENSE",
      category: "Robot parts",
      description: "Timing belts",
      quantity: 8,
      amountCents: 10392,
      status: "PLANNED",
    },
    {
      planId,
      kind: "INCOME",
      category: "University funding",
      description: "Engineering program allocation",
      quantity: 1,
      amountCents: 500000,
      status: "RECEIVED",
    },
  ],
  sponsors: [
    {
      planId,
      amountCents: 250000,
      status: "RECEIVED",
    },
  ],
  meetings: [
    {
      id: meetingId,
      heldAt: now,
      title: "Scoring design review",
      summary: "Reviewed loader evidence, change request, budget impact, and manufacturing readiness.",
      discussion: "The revised guide is ready for an endurance test.",
    },
  ],
  decisions: [
    {
      meetingId,
      decision: "Approve revision C after the endurance acceptance criteria pass.",
    },
  ],
  tasks: [
    {
      title: "Run 50-cycle loader endurance test",
      assignedToMemberId: memberId,
      priority: "HIGH",
      status: "IN_REVIEW",
      dueAt: new Date("2026-07-23T18:00:00-05:00"),
      approvedAt: null,
    },
  ],
  hours: [
    {
      workDate: now,
      memberId,
      project: "Override Robot",
      category: "Testing",
      minutes: 150,
      description: "Loader-cycle setup, measurement, and review.",
    },
  ],
  scouting: [
    {
      eventName: "210 Practice Scrimmage",
      matchNumber: "Q4",
      observedTeam: "210Z",
      score: 84,
      autoPinsScored: 12,
      alliancePinsScored: 10,
      yellowPinsOwned: 2,
      togglesOwned: 2,
      robotsMidfield: 2,
      autonomousWinPoint: true,
      reliabilityRating: 5,
    },
  ],
  names: new Map([[memberId, "210 Robotics QA Member"]]),
  options: {
    includeEngineering: true,
    includeTesting: true,
    includeLogistics: true,
    includeChanges: true,
    includeFinance: true,
    includeOperations: true,
    includeScouting: true,
  },
} as unknown as NotebookPdfInput;

async function main() {
  input.projects = [input.project!];
  const outputPath = path.join(process.cwd(), ".codex", "notebook-qa.pdf");
  const buffer = await buildEngineeringNotebookPdf(input);
  await writeFile(outputPath, buffer);
  console.log(JSON.stringify({ outputPath, bytes: buffer.length }));
}

void main();
