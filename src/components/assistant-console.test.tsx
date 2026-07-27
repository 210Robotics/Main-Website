// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantConsole } from "@/components/assistant-console";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(async () => ({ status: "success" as const, message: "Assigned the task.", href: "/admin/operations?tool=tasks" })),
  processDocument: vi.fn(),
}));

vi.mock("@/app/admin/assistant-actions", () => ({
  executeAssistantCommand: mocks.execute,
  processAssistantDocument: mocks.processDocument,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AssistantConsole", () => {
  it("sends an operational prompt with recent conversation context", async () => {
    render(<AssistantConsole uploaderId="member-1" />);
    fireEvent.change(screen.getByLabelText("Assistant prompt"), { target: { value: "Assign task Inspect intake chain to Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Send command" }));
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledWith({
      prompt: "Assign task Inspect intake chain to Alex",
      conversation: expect.stringContaining(
        "Tell me what should happen in ordinary language.",
      ),
    }));
    expect(await screen.findByText("Assigned the task.")).toBeVisible();
    expect(screen.getByRole("link", { name: /View updated area/ })).toHaveAttribute("href", "/admin/operations?tool=tasks");
  });
});
