import { describe, expect, it } from "vitest";
import {
  assistantCommandSchema,
  inferAssistantCommand,
  isUuidReference,
} from "@/lib/assistant-commands";

describe("assistant command fallback", () => {
  it("only treats actual UUIDs as database identifiers", () => {
    expect(
      isUuidReference("f0e20e46-efc9-4daa-a7c8-582052510a03"),
    ).toBe(true);
    expect(isUuidReference("Inspect intake chain")).toBe(false);
    expect(isUuidReference("210-001")).toBe(false);
  });

  it("understands task completion", () => {
    expect(inferAssistantCommand("Complete task Inspect intake chain")).toEqual({ kind: "TASK_COMPLETE", task: "Inspect intake chain" });
  });

  it("creates and assigns tasks from conversational shorthand", () => {
    expect(
      inferAssistantCommand(
        "Assign Task, Update google Calendar, to Dyshana",
      ),
    ).toEqual({
      kind: "TASK_CREATE",
      title: "Update google Calendar",
      description: "",
      assignee: "Dyshana",
      priority: "NORMAL",
    });
    expect(
      inferAssistantCommand(
        "Give Dyshana a task to update the Google Calendar",
      ),
    ).toEqual({
      kind: "TASK_CREATE",
      title: "update the Google Calendar",
      description: "",
      assignee: "Dyshana",
      priority: "NORMAL",
    });
  });

  it("understands BOM quantity updates", () => {
    expect(inferAssistantCommand("Update part 210-001 quantity to 4")).toEqual(expect.objectContaining({ kind: "BOM_UPDATE", part: "210-001", quantity: 4 }));
  });

  it("understands financial entries", () => {
    expect(inferAssistantCommand("Add expense: new bearings $125")).toEqual(expect.objectContaining({ kind: "BUDGET_ADD", entryKind: "EXPENSE", amount: 125 }));
    expect(
      inferAssistantCommand(
        "Add expense: competition registration $1,200 to the Travel budget plan",
      ),
    ).toEqual(
      expect.objectContaining({
        kind: "BUDGET_ADD",
        plan: "Travel",
        entryKind: "EXPENSE",
        amount: 1_200,
      }),
    );
  });

  it("uses softer ownership language as task intent", () => {
    expect(
      inferAssistantCommand(
        "Dyshana Torres needs to update the sponsor calendar by next Friday",
      ),
    ).toEqual(
      expect.objectContaining({
        kind: "TASK_CREATE",
        title: "update the sponsor calendar",
        assignee: "Dyshana Torres",
      }),
    );
  });

  it("understands budget line edits", () => {
    expect(inferAssistantCommand("Change expense replacement bearings amount to $150")).toEqual(expect.objectContaining({ kind: "BUDGET_UPDATE", entry: "replacement bearings", amount: 150 }));
  });

  it("understands task comments and status changes", () => {
    expect(inferAssistantCommand("Add comment Waiting on the new sprocket to task Inspect intake chain")).toEqual({
      kind: "TASK_COMMENT",
      task: "Inspect intake chain",
      comment: "Waiting on the new sprocket",
      isDeliverable: false,
    });
    expect(inferAssistantCommand("Set task Inspect intake chain status to blocked")).toEqual(
      expect.objectContaining({ kind: "TASK_UPDATE", task: "Inspect intake chain", status: "BLOCKED" }),
    );
  });

  it("understands fundraising changes", () => {
    expect(inferAssistantCommand("Set the donation campaign goal to $15,000")).toEqual(
      expect.objectContaining({ kind: "DONATION_CAMPAIGN", goal: 15_000 }),
    );
  });

  it("recognizes live donation-total questions", () => {
    expect(
      inferAssistantCommand("What is the current donations raised."),
    ).toEqual({ kind: "DONATION_STATUS" });
    expect(inferAssistantCommand("How much have we raised in donations?")).toEqual({
      kind: "DONATION_STATUS",
    });
  });

  it("recognizes remaining-budget questions", () => {
    expect(
      inferAssistantCommand("How much money is left in the budget"),
    ).toEqual({ kind: "BUDGET_STATUS", plan: undefined });
    expect(
      inferAssistantCommand("What is the remaining budget for Competition?"),
    ).toEqual({ kind: "BUDGET_STATUS", plan: "Competition" });
  });

  it("recognizes next-event questions", () => {
    expect(inferAssistantCommand("When is the next event?")).toEqual({
      kind: "NEXT_EVENT",
    });
  });

  it("understands explicit Discord actions without command syntax", () => {
    expect(
      inferAssistantCommand(
        "Send a Discord message to #general: The meeting starts at 6 PM.",
      ),
    ).toEqual({
      kind: "DISCORD_SEND",
      channel: "general",
      message: "The meeting starts at 6 PM.",
      mentions: [],
      mentionEveryone: false,
    });
    expect(
      inferAssistantCommand(
        "Send a Discord message to #general: Practice moved to 7 PM, and tag everyone.",
      ),
    ).toEqual({
      kind: "DISCORD_SEND",
      channel: "general",
      message: "Practice moved to 7 PM",
      mentions: [],
      mentionEveryone: true,
    });
    expect(
      inferAssistantCommand(
        "DM Dyshana Torres on Discord: Please review the intake task.",
      ),
    ).toEqual({
      kind: "DISCORD_DM",
      member: "Dyshana Torres",
      message: "Please review the intake task.",
    });
    expect(
      inferAssistantCommand("Sync the Discord server and message log"),
    ).toEqual({
      kind: "DISCORD_SYNC",
      includeMessages: true,
    });
    expect(
      inferAssistantCommand("Send the Discord monthly calendar digest"),
    ).toEqual({ kind: "DISCORD_MONTHLY_DIGEST" });
    expect(
      inferAssistantCommand(
        "Timeout Dyshana Torres on Discord for 6 hours because spam",
      ),
    ).toEqual({
      kind: "DISCORD_TIMEOUT",
      member: "Dyshana Torres",
      durationMinutes: 360,
      reason: "spam",
    });
  });

  it("understands notebook to-do lists", () => {
    expect(
      inferAssistantCommand(
        "Notebook to-do for page Drivetrain Review: add test photos, document gear ratio",
      ),
    ).toEqual({
      kind: "NOTEBOOK_TODO",
      entry: "Drivetrain Review",
      items: ["add test photos", "document gear ratio"],
    });
  });

  it("accepts natural-language planner results for admin work areas", () => {
    expect(
      assistantCommandSchema.parse({
        kind: "HOUR_LOG",
        member: "Dyshana",
        hours: 2.5,
        description: "Programming and drivetrain testing",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "HOUR_LOG",
        project: "Team operations",
      }),
    );
    expect(
      assistantCommandSchema.parse({
        kind: "NEWS_CREATE",
        title: "Competition recap",
        body: "The team completed inspection and qualification matches.",
      }),
    ).toEqual(
      expect.objectContaining({ kind: "NEWS_CREATE", status: "DRAFT" }),
    );
    expect(
      assistantCommandSchema.parse({
        kind: "INVENTORY_UPSERT",
        sku: "210-BRG-001",
        quantityOnHand: 24,
        reorderPoint: 8,
      }),
    ).toEqual(
      expect.objectContaining({ kind: "INVENTORY_UPSERT" }),
    );
    expect(
      assistantCommandSchema.parse({
        kind: "SPONSOR_FUNDING",
        sponsorName: "Example Manufacturing",
        amount: 2100,
        status: "COMMITTED",
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "SPONSOR_FUNDING",
        tier: "Partner",
      }),
    );
  });
});
