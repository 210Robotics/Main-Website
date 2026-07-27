import { describe, expect, it } from "vitest";
import { findDuplicateGroups, scoreDecisionMatrix } from "@/lib/control-center";

describe("control center helpers", () => {
  it("computes and ranks weighted concept scores", () => {
    const result = scoreDecisionMatrix(
      "Requirements | 50\nCost | 30\nComplexity | 20",
      "Reliable | 9,6,8\nCheap | 7,10,9",
    );
    expect(result).toEqual([
      { name: "Cheap", score: 8.3 },
      { name: "Reliable", score: 7.9 },
    ]);
  });

  it("caps scores to the zero-to-ten range", () => {
    expect(scoreDecisionMatrix("Fit | 1", "A | 12\nB | -4")).toEqual([
      { name: "A", score: 10 },
      { name: "B", score: 0 },
    ]);
  });

  it("normalizes raw higher-is-better and lower-is-better variables", () => {
    const result = scoreDecisionMatrix(
      "Payload | 60 | HIGHER\nCost | 40 | LOWER",
      "Alpha | 40,1000\nBeta | 30,600",
    );
    expect(result).toEqual([
      { name: "Alpha", score: 6 },
      { name: "Beta", score: 4 },
    ]);
  });

  it("detects normalized duplicate records within a record type", () => {
    const groups = findDuplicateGroups([
      { type: "Task", id: "1", label: "Review drivetrain" },
      { type: "Task", id: "2", label: "Review  drivetrain!" },
      { type: "Part", id: "3", label: "AXLE Rev A" },
      { type: "Part", id: "4", label: "Axle revision B" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.count === 2)).toBe(true);
  });
});
