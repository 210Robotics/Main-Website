import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseGeminiCommands } from "@/lib/assistant-planner";

describe("Gemini assistant planner output", () => {
  it("keeps multiple valid actions in execution order", () => {
    expect(
      parseGeminiCommands(
        JSON.stringify({
          commands: [
            {
              kind: "TASK_CREATE",
              title: "Inspect the intake",
              description: "Record any damaged rollers.",
              assignee: "Dyshana",
            },
            {
              kind: "INVENTORY_UPSERT",
              sku: "210-BRG-001",
              quantityOnHand: 12,
            },
            {
              kind: "BUDGET_ADD",
              entryKind: "EXPENSE",
              description: "Replacement bearings",
              amount: 125,
            },
          ],
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "TASK_CREATE",
        assignee: "Dyshana",
      }),
      expect.objectContaining({
        kind: "INVENTORY_UPSERT",
        sku: "210-BRG-001",
      }),
      expect.objectContaining({
        kind: "BUDGET_ADD",
        amount: 125,
      }),
    ]);
  });

  it("discards unsupported or malformed actions without losing valid ones", () => {
    expect(
      parseGeminiCommands(
        '{"commands":[{"kind":"DELETE_EVERYTHING"},{"kind":"DONATION_STATUS"}]}',
      ),
    ).toEqual([{ kind: "DONATION_STATUS" }]);
  });
});
