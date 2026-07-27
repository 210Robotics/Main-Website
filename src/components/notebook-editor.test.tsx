// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotebookEditor } from "@/components/notebook-editor";

vi.mock("@/app/upload-actions", () => ({
  finalizeNotebookImageUpload: vi.fn(),
}));

Range.prototype.getBoundingClientRect = () => new DOMRect();
Range.prototype.getClientRects = () => ({
  item: () => null,
  length: 0,
  [Symbol.iterator]: function* iterator() {},
}) as DOMRectList;

describe("NotebookEditor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads a structured starter without creating a fake page inside one record", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<NotebookEditor name="contentHtml" />);

    fireEvent.change(await screen.findByLabelText("Page starter"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load starter layout" }));

    const hidden = container.querySelector<HTMLInputElement>(
      'input[name="contentHtml"]',
    );
    await waitFor(() => {
      expect(hidden?.value).toContain("Test and verification record");
      expect(hidden?.value).not.toContain('data-page-break="true"');
    });
    expect(screen.queryByRole("button", { name: "New notebook page" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/1 page/)).toHaveLength(2);
  });
});
