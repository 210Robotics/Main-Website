// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotebookPageOrganizer } from "@/components/notebook-page-organizer";

const mocks = vi.hoisted(() => ({
  reorderNotebookPages: vi.fn(async (pageIds: string[]) => {
    void pageIds;
    return { status: "success" as const, message: "Notebook page order saved." };
  }),
  refresh: vi.fn(),
}));

vi.mock("@/app/admin/operations/engineering-actions", () => ({
  reorderNotebookPages: mocks.reorderNotebookPages,
  deleteNotebookPage: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NotebookPageOrganizer", () => {
  it("stages an accessible reorder and persists the resulting page ids", async () => {
    render(<NotebookPageOrganizer pages={[
      { id: "page-a", title: "Concept", entryType: "DESIGN", currentVersion: 1 },
      { id: "page-b", title: "Prototype", entryType: "BUILD", currentVersion: 2 },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Prototype up" }));
    const pageLinks = screen.getAllByRole("link");
    expect(within(pageLinks[0]).getByText("Prototype")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save page order" }));
    await waitFor(() => expect(mocks.reorderNotebookPages).toHaveBeenCalledWith(["page-b", "page-a"]));
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
