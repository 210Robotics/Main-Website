import "server-only";
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
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { meetingDecisions, meetingNotes, memberTasks } from "@/db/schema";

type Meeting = typeof meetingNotes.$inferSelect;
type Decision = typeof meetingDecisions.$inferSelect;
type Task = typeof memberTasks.$inferSelect;
const ORANGE = "FD7803";
const BLACK = "111111";
const GRAY = "666666";

function heading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    children: [new TextRun({ text, bold: true, color: BLACK, size: 28 })],
  });
}
function body(text: string) {
  return new Paragraph({
    spacing: { after: 140, line: 320 },
    children: [
      new TextRun({ text: text || "Not recorded.", color: BLACK, size: 21 }),
    ],
  });
}
function headerCell(text: string) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: BLACK, color: "auto" },
    margins: { top: 110, bottom: 110, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: true, color: "FFFFFF", size: 18 }),
        ],
      }),
    ],
  });
}
function valueCell(text: string) {
  return new TableCell({
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || "—", size: 18, color: BLACK })],
      }),
    ],
  });
}

export async function buildMeetingDocument(data: {
  meeting: Meeting;
  decisions: Decision[];
  tasks: Task[];
  attendees: string[];
  memberNames: Map<string, string>;
}) {
  const { meeting } = data;
  const actionRows = data.tasks.length
    ? data.tasks.map(
        (task) =>
          new TableRow({
            children: [
              valueCell(task.title),
              valueCell(
                data.memberNames.get(task.assignedToMemberId) ?? "Unassigned",
              ),
              valueCell(task.project),
              valueCell(task.dueAt?.toLocaleDateString() ?? "No deadline"),
              valueCell(task.status.replaceAll("_", " ")),
            ],
          }),
      )
    : [
        new TableRow({
          children: [
            valueCell("No actions recorded."),
            valueCell("—"),
            valueCell("—"),
            valueCell("—"),
            valueCell("—"),
          ],
        }),
      ];
  const decisionRows = data.decisions.length
    ? data.decisions.map(
        (decision) =>
          new TableRow({
            children: [
              valueCell(decision.decision),
              valueCell(decision.rationale),
              valueCell(decision.impact),
            ],
          }),
      )
    : [
        new TableRow({
          children: [
            valueCell("No decisions recorded."),
            valueCell("—"),
            valueCell("—"),
          ],
        }),
      ];
  const document = new Document({
    creator: "210 Robotics",
    title: `${meeting.title} Meeting Record`,
    description:
      "210 Robotics meeting notes, decisions, attendance, and assigned actions",
    styles: {
      default: {
        document: {
          run: { font: "Aptos", size: 21, color: BLACK },
          paragraph: { spacing: { after: 120 } },
        },
      },
      paragraphStyles: [
        {
          id: "Title210",
          name: "210 Title",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Aptos Display", size: 44, bold: true, color: BLACK },
          paragraph: { spacing: { after: 160 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 12,
                    color: ORANGE,
                    space: 5,
                  },
                },
                children: [
                  new TextRun({
                    text: "210 ROBOTICS",
                    bold: true,
                    color: ORANGE,
                    size: 18,
                  }),
                  new TextRun({
                    text: "   ·   MEETING-TO-ACTION RECORD",
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
                  new TextRun({
                    text: "210 Robotics · Internal record · Page ",
                    color: GRAY,
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: GRAY,
                    size: 16,
                  }),
                  new TextRun({ text: " of ", color: GRAY, size: 16 }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
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
            style: "Title210",
            children: [new TextRun(meeting.title)],
          }),
          new Paragraph({
            spacing: { after: 260 },
            children: [
              new TextRun({
                text: "MEETING RECORD",
                bold: true,
                color: "FFFFFF",
                size: 18,
                shading: {
                  type: ShadingType.CLEAR,
                  fill: ORANGE,
                  color: "auto",
                },
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell("Held"),
                  valueCell(meeting.heldAt.toLocaleString()),
                  headerCell("Status"),
                  valueCell(meeting.status),
                ],
              }),
              new TableRow({
                children: [
                  headerCell("Location"),
                  valueCell(meeting.location),
                  headerCell("Facilitator"),
                  valueCell(meeting.facilitator),
                ],
              }),
              new TableRow({
                children: [
                  headerCell("Attendance"),
                  valueCell(`${data.attendees.length} linked attendees`),
                  headerCell("Next meeting"),
                  valueCell(meeting.nextMeeting),
                ],
              }),
            ],
          }),
          heading("Executive summary"),
          body(meeting.summary),
          heading("Agenda"),
          body(meeting.agenda),
          heading("Discussion notes"),
          body(meeting.discussion),
          heading("Attendance"),
          body(
            data.attendees.length
              ? data.attendees.join(" · ")
              : "No attendance activity was linked to this meeting.",
          ),
          heading("Decisions"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  headerCell("Decision"),
                  headerCell("Rationale"),
                  headerCell("Impact"),
                ],
              }),
              ...decisionRows,
            ],
          }),
          heading("Assigned actions and deadlines"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  headerCell("Action"),
                  headerCell("Owner"),
                  headerCell("Project"),
                  headerCell("Deadline"),
                  headerCell("Status"),
                ],
              }),
              ...actionRows,
            ],
          }),
          heading("Follow-up"),
          body(meeting.nextMeeting),
          new Paragraph({
            spacing: { before: 420 },
            border: {
              top: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: ORANGE,
                space: 10,
              },
            },
            children: [
              new TextRun({
                text: `Generated ${new Date().toLocaleString()} from the 210 Robotics Operations workspace.`,
                italics: true,
                color: GRAY,
                size: 16,
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
