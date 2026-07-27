import { describe, expect, it } from "vitest";
import {
  filterActivityRecords,
  type ActivityLogRecord,
} from "@/lib/activity-log";

const records: ActivityLogRecord[] = [
  {
    id: "hour-1",
    type: "hour",
    memberId: "member-1",
    memberName: "Alex Builder",
    memberRole: "Member",
    date: "2026-07-10",
    project: "VEX U",
    category: "Programming",
    description: "Autonomous testing",
    createdAt: "2026-07-10T12:00:00.000Z",
    minutes: 120,
  },
  {
    id: "contribution-1",
    type: "contribution",
    memberId: "member-2",
    memberName: "Riley Designer",
    memberRole: "Officer",
    date: "2026-07-12",
    project: "RoboRowdy",
    category: "Design",
    description: "Completed the intake model",
    title: "CAD release",
    createdAt: "2026-07-12T12:00:00.000Z",
  },
];

const defaults = {
  person: "",
  type: "all" as const,
  from: "",
  to: "",
  search: "",
};

describe("filterActivityRecords", () => {
  it("filters by person and record type", () => {
    expect(
      filterActivityRecords(records, {
        ...defaults,
        person: "member-2",
        type: "contribution",
      }).map((record) => record.id),
    ).toEqual(["contribution-1"]);
  });

  it("applies inclusive date ranges", () => {
    expect(
      filterActivityRecords(records, {
        ...defaults,
        from: "2026-07-11",
        to: "2026-07-12",
      }).map((record) => record.id),
    ).toEqual(["contribution-1"]);
  });

  it("searches titles, projects, categories, descriptions, and members", () => {
    expect(
      filterActivityRecords(records, { ...defaults, search: "autonomous" })
        .map((record) => record.id),
    ).toEqual(["hour-1"]);
    expect(
      filterActivityRecords(records, { ...defaults, search: "cad release" })
        .map((record) => record.id),
    ).toEqual(["contribution-1"]);
  });
});
