import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildEngineeringNotebookDocument } from "@/lib/exports/notebook-document";
import type { NotebookPdfInput } from "@/lib/exports/notebook-pdf";

const now = new Date("2026-07-20T18:00:00-05:00");
const memberId = "00000000-0000-4000-8000-000000000210";
const seasonId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";

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
      id: "00000000-0000-4000-8000-000000000003",
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
      subsystemId: "00000000-0000-4000-8000-000000000003",
      title: "Loader cycle prototype verification",
      entryType: "TESTING",
      status: "PUBLISHED",
      entryDate: now,
      contentHtml:
        "<h2>Engineering question</h2><p>Can the revised guide complete Loader cycles reliably without a transfer jam?</p><h3>Procedure</h3><ol><li>Inspect alignment and preload.</li><li>Run twelve controlled cycles.</li><li>Measure time and record failures.</li></ol><table><tbody><tr><th>Metric</th><th>Target</th><th>Observed</th></tr><tr><td>Successful cycles</td><td>12</td><td>11</td></tr><tr><td>Average time</td><td>Under 5 s</td><td>4.2 s</td></tr></tbody></table><blockquote><p><strong>Decision:</strong> Retain the guide geometry and add a wear insert.</p></blockquote><hr data-page-break=\"true\"><h2>Endurance follow-up</h2><p>This second live-editor page records the planned 50-cycle endurance verification.</p><ul><li>Capture video evidence</li><li>Inspect wear after the final cycle</li></ul>",
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
  parts: [],
  steps: [],
  inventory: [],
  purchases: [],
  changes: [],
  financePlans: [],
  financeEntries: [],
  sponsors: [],
  meetings: [],
  decisions: [],
  tasks: [],
  hours: [],
  scouting: [],
  names: new Map([[memberId, "210 Robotics QA Member"]]),
  options: {
    includeEngineering: false,
    includeTesting: true,
    includeLogistics: false,
    includeChanges: false,
    includeFinance: false,
    includeOperations: false,
    includeScouting: false,
  },
} as unknown as NotebookPdfInput;

async function main() {
  input.projects = [input.project!];
  const outputPath = path.join(process.cwd(), ".codex", "notebook-docx-qa.docx");
  const buffer = await buildEngineeringNotebookDocument(input);
  await writeFile(outputPath, buffer);
  console.log(JSON.stringify({ outputPath, bytes: buffer.length }));
}

void main();
