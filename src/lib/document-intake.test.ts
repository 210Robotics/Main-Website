import { describe, expect, it } from "vitest";
import {
  documentRouteSignals,
  extractBudgetPlanHint,
  extractDecisionMatrices,
  extractPricedMaterialCommands,
} from "@/lib/document-intake";

describe("priced material document intake", () => {
  it("finds the intended destination budget in natural instructions", () => {
    expect(
      extractBudgetPlanHint(
        "Import every finance row into the 2026 Competition budget plan.",
      ),
    ).toBe("2026 Competition");
    expect(
      extractBudgetPlanHint('Use budget plan named "Travel Scenario"'),
    ).toBe("Travel Scenario");
    expect(extractBudgetPlanHint("Classify this file for me")).toBeUndefined();
  });

  it("extracts conventional Excel-style itemized expenses", () => {
    expect(
      extractPricedMaterialCommands({
        filename: "robot-materials.xlsx",
        sourceText: [
          "=== SHEET: Materials ===",
          "Part Number,Item,Qty,Unit Cost,Supplier,Category",
          '210-001,"Bearing, flanged",4,$3.25,VEX Robotics,Robot parts',
          "210-002,Shaft collar,2,$5.00,McMaster,Robot parts",
        ].join("\n"),
      }),
    ).toEqual([
      expect.objectContaining({
        kind: "BUDGET_ADD",
        description: "210-001 — Bearing, flanged",
        quantity: 4,
        amount: 13,
        vendor: "VEX Robotics",
      }),
      expect.objectContaining({
        description: "210-002 — Shaft collar",
        amount: 10,
      }),
    ]);
  });

  it("uses explicit line totals and honors BOM-only instructions", () => {
    expect(
      extractPricedMaterialCommands({
        filename: "purchase-list.csv",
        sourceText: "Item,Quantity,Line Total\nAluminum plate,3,$72.50",
      }),
    ).toEqual([
      expect.objectContaining({
        description: "Aluminum plate",
        amount: 72.5,
        quantity: 3,
      }),
    ]);
    expect(
      extractPricedMaterialCommands({
        filename: "priced-bom.xlsx",
        instructions: "Only put these parts in the BOM",
        sourceText: "Part,Qty,Unit Cost\n210-003,2,$4",
      }),
    ).toEqual([]);
  });

  it("extracts tab-separated tables converted from DOCX", () => {
    expect(
      extractPricedMaterialCommands({
        filename: "purchase-request.docx",
        sourceText:
          "Item\tQty\tUnit Price\tVendor\nPolycarbonate sheet\t2\t$18.75\tLocal Plastics",
      }),
    ).toEqual([
      expect.objectContaining({
        description: "Polycarbonate sheet",
        amount: 37.5,
        vendor: "Local Plastics",
      }),
    ]);
  });

  it("does not mistake a budget table for a decision matrix", () => {
    const sourceText = [
      "2026 Competition Budget Plan",
      "Item,Quantity,Unit Cost,Amount,Category",
      "Registration,1,$1200,$1200,Events",
      "Aluminum,4,$30,$120,Robot parts",
      "Sponsor income,1,$2500,$2500,Income",
    ].join("\n");
    expect(
      documentRouteSignals({
        filename: "competition-budget.xlsx",
        sourceText,
      }),
    ).toMatchObject({ decision: false, finance: true });
    expect(
      extractDecisionMatrices({
        filename: "competition-budget.xlsx",
        sourceText,
      }),
    ).toEqual([]);
  });

  it("preserves and imports a DOCX decision matrix with merged headers", () => {
    const matrices = extractDecisionMatrices({
      filename: "lift-decision.docx",
      sourceText: [
        "210 Robotics Lift Subsystem Decision Matrix",
        "Primary lift concept selected: Cascade Lift",
        "Key concerns raised: verify lift count",
      ].join("\n"),
      contentHtml: [
        "<table><thead>",
        '<tr><th>Criteria</th><th>Weight</th><th colspan="2">Cascade Lift</th><th colspan="2">Continuous Lift</th><th colspan="2">DR4B</th></tr>',
        "<tr><th></th><th></th><th>Score (1-5)</th><th>Weighted</th><th>Score (1-5)</th><th>Weighted</th><th>Score (1-5)</th><th>Weighted</th></tr>",
        "<tr><th>Reach</th><th>60%</th><th>5</th><th>3</th><th>4</th><th>2.4</th><th>3</th><th>1.8</th></tr>",
        "<tr><th>Reliability</th><th>40%</th><th>4</th><th>1.6</th><th>5</th><th>2</th><th>2</th><th>.8</th></tr>",
        "</thead></table>",
      ].join(""),
    });
    expect(matrices).toHaveLength(1);
    expect(matrices[0]).toMatchObject({
      title: "210 Robotics Lift Subsystem Decision Matrix",
      criteria: [
        { name: "Reach", weight: 60 },
        { name: "Reliability", weight: 40 },
      ],
      concepts: [
        { name: "Cascade Lift", values: [5, 4] },
        { name: "Continuous Lift", values: [4, 5] },
        { name: "DR4B", values: [3, 2] },
      ],
    });
    expect(matrices[0]?.recommendation).toContain(
      "Primary concept selected: Cascade Lift",
    );
  });
});
