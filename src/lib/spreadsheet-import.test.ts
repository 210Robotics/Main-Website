import { describe, expect, it } from "vitest";
import {
  parseDecisionMatrixRows,
  parseFinanceSheets,
} from "@/lib/spreadsheet-import";

describe("spreadsheet imports", () => {
  it("imports a wide decision matrix with weights and goals", () => {
    const result = parseDecisionMatrixRows([
      ["Design", "Requirement fit", "Cost", "Weight"],
      ["Weight", "50", "30", "20"],
      ["Goal", "Score", "Lower", "Lower"],
      ["Concept A", "8", "900", "12.5"],
      ["Concept B", "9", "1200", "10.2"],
    ]);
    expect(result.criteria).toEqual([
      { name: "Requirement fit", weight: 50, goal: "SCORE" },
      { name: "Cost", weight: 30, goal: "LOWER" },
      { name: "Weight", weight: 20, goal: "LOWER" },
    ]);
    expect(result.concepts).toEqual([
      { name: "Concept A", values: [8, 900, 12.5] },
      { name: "Concept B", values: [9, 1200, 10.2] },
    ]);
  });

  it("imports long-form decision matrix rows", () => {
    const result = parseDecisionMatrixRows([
      ["Concept", "Criterion", "Weight", "Score", "Direction"],
      ["A", "Cost", "40", "500", "Lower"],
      ["A", "Fit", "60", "8", "Score"],
      ["B", "Cost", "40", "650", "Lower"],
      ["B", "Fit", "60", "9", "Score"],
    ]);
    expect(result.criteria).toHaveLength(2);
    expect(result.concepts).toEqual([
      { name: "A", values: [500, 8] },
      { name: "B", values: [650, 9] },
    ]);
  });

  it("imports criteria-first matrices with paired score columns", () => {
    const result = parseDecisionMatrixRows([
      [
        "Criteria",
        "Weight",
        "Cascade Lift",
        "Cascade Lift",
        "Continuous Lift",
        "Continuous Lift",
        "DR4B",
        "DR4B",
      ],
      ["", "", "Score (1-5)", "Weighted", "Score (1-5)", "Weighted", "Score (1-5)", "Weighted"],
      ["Scoring reach", "20%", "5", "1", "5", "1", "3", ".6"],
      ["Reliability", "20%", "4.5", ".9", "4", ".8", "2", ".4"],
      ["TOTAL (weighted)", "100%", "", "1.9", "", "1.8", "", "1"],
    ]);
    expect(result.criteria).toEqual([
      { name: "Scoring reach", weight: 20, goal: "SCORE" },
      { name: "Reliability", weight: 20, goal: "SCORE" },
    ]);
    expect(result.concepts).toEqual([
      { name: "Cascade Lift", values: [5, 4.5] },
      { name: "Continuous Lift", values: [5, 4] },
      { name: "DR4B", values: [3, 2] },
    ]);
  });

  it("maps finance headers and calculates line totals", () => {
    const result = parseFinanceSheets(
      [
        {
          name: "Budget",
          rows: [
            ["Item", "Qty", "Unit Cost", "Type", "Vendor", "Status"],
            ["Aluminum stock", "3", "$25.50", "BOM", "Metal Co", "Approved"],
            ["Team donation", "1", "$210", "Income", "", "Paid"],
          ],
        },
      ],
      { kind: "EXPENSE", status: "PLANNED" },
    );
    expect(result.rows).toMatchObject([
      {
        description: "Aluminum stock",
        quantity: 3,
        unitCost: 25.5,
        amount: 76.5,
        kind: "BOM_ITEM",
        status: "APPROVED",
      },
      {
        description: "Team donation",
        amount: 210,
        kind: "INCOME",
        status: "PAID",
      },
    ]);
  });

  it("keeps mixed budget rows assigned to their correct type and status", () => {
    const result = parseFinanceSheets(
      [
        {
          name: "Competition Plan",
          rows: [
            ["Description", "Amount", "Type", "Category", "Status"],
            ["Registration", "$1,200", "Expense", "Events", "Approved"],
            ["Sponsor pledge", "$2,500", "Income", "Sponsorship", "Paid"],
            ["Travel allowance", "$900", "Budget item", "Travel", "Planned"],
          ],
        },
      ],
      { kind: "EXPENSE", status: "PLANNED" },
    );
    expect(result.rows).toMatchObject([
      { description: "Registration", kind: "EXPENSE", status: "APPROVED" },
      { description: "Sponsor pledge", kind: "INCOME", status: "PAID" },
      {
        description: "Travel allowance",
        kind: "BUDGET_ITEM",
        status: "PLANNED",
      },
    ]);
  });
});
