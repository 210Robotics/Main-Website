import { describe, expect, it } from "vitest";
import {
  centsToMoney,
  memberTaskStatuses,
  moneyToCents,
  summarizeBudget,
  taskStatuses,
} from "@/lib/operations";

describe("operations workflow helpers", () => {
  it("requires admin approval before assignees can reach done", () => {
    expect(taskStatuses).toContain("DONE");
    expect(memberTaskStatuses).toContain("IN_REVIEW");
    expect(memberTaskStatuses).not.toContain("DONE");
  });

  it("rounds entered currency to cents and formats totals", () => {
    expect(moneyToCents("1234.567")).toBe(123457);
    expect(centsToMoney(123457)).toBe("$1,234.57");
  });

  it("totals itemized budget lines without canceled records or prospects", () => {
    expect(
      summarizeBudget(
        [
          { kind: "BUDGET_ITEM", status: "PLANNED", amountCents: 50000 },
          { kind: "BOM_ITEM", status: "APPROVED", amountCents: 25000 },
          { kind: "EXPENSE", status: "PAID", amountCents: 12000 },
          { kind: "EXPENSE", status: "CANCELED", amountCents: 9000 },
          { kind: "INCOME", status: "RECEIVED", amountCents: 40000 },
        ],
        [
          { status: "PLEDGED", amountCents: 30000 },
          { status: "PROSPECT", amountCents: 99000 },
        ],
      ),
    ).toEqual({
      expenses: 12000,
      planned: 75000,
      income: 40000,
      sponsorFunding: 30000,
      totalFunding: 70000,
      availableCash: 58000,
    });
  });
});
