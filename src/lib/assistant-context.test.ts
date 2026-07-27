import { describe, expect, it } from "vitest";
import {
  applyAutomaticDueDates,
  applyNaturalLanguageContext,
  relativeDueDate,
} from "@/lib/assistant-context";

const friday = new Date("2026-07-24T15:00:00Z");

describe("assistant natural-language date context", () => {
  it("turns next Friday into a real Chicago deadline", () => {
    expect(
      relativeDueDate("Have it due next Friday", friday),
    ).toBe("2026-07-31T17:00:00-05:00");
  });

  it("respects relative days and a supplied time", () => {
    expect(
      relativeDueDate("This is due tomorrow at 3:30 PM", friday),
    ).toBe("2026-07-25T15:30:00-05:00");
    expect(relativeDueDate("Have it due in 2 weeks", friday)).toBe(
      "2026-08-07T17:00:00-05:00",
    );
  });

  it("removes the deadline phrase from a generated task title", () => {
    expect(
      applyNaturalLanguageContext(
        [
          {
            kind: "TASK_CREATE",
            title: "Update the calendar, have it due Next Friday",
            description: "",
            assignee: "Dyshana Torres",
            priority: "NORMAL",
          },
        ],
        "Create a task to update the calendar, have it due Next Friday, and assign it to Dyshana Torres.",
        friday,
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "TASK_CREATE",
        title: "Update the calendar",
        dueAt: "2026-07-31T17:00:00-05:00",
        assignee: "Dyshana Torres",
      }),
    ]);
  });

  it("chooses practical business-day deadlines when work has no date", () => {
    expect(
      applyAutomaticDueDates(
        [
          {
            kind: "TASK_CREATE",
            title: "Document the lift decision",
            description: "",
            priority: "NORMAL",
          },
          {
            kind: "TASK_CREATE",
            title: "Fix the failed intake",
            description: "",
            priority: "URGENT",
          },
          {
            kind: "ENGINEERING_RECORD_CREATE",
            recordType: "ENGINEERING_QUESTION",
            title: "Choose the lift count",
            description: "",
            priority: "NORMAL",
          },
          {
            kind: "PURCHASE_CREATE",
            item: "Aluminum plate",
            quantity: 2,
            vendor: "",
            notes: "",
          },
        ],
        friday,
      ),
    ).toEqual([
      expect.objectContaining({ dueAt: "2026-07-31T17:00:00-05:00" }),
      expect.objectContaining({ dueAt: "2026-07-27T17:00:00-05:00" }),
      expect.objectContaining({ dueAt: "2026-08-04T17:00:00-05:00" }),
      expect.objectContaining({ neededBy: "2026-08-07T17:00:00-05:00" }),
    ]);
  });

  it("never replaces an explicit deadline", () => {
    const explicit = "2026-09-10T12:00:00-05:00";
    expect(
      applyAutomaticDueDates(
        [
          {
            kind: "TASK_CREATE",
            title: "Review the notebook",
            description: "",
            priority: "HIGH",
            dueAt: explicit,
          },
        ],
        friday,
      )[0],
    ).toMatchObject({ dueAt: explicit });
  });
});
